import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";
import type { DocBlock } from "./rag/chunking";

const IndexSchema = z.object({
  document_id: z.string().uuid(),
  force_vision: z.boolean().optional(),
  chunk_profile: z.enum(["structural-sm", "structural-md", "structural-lg"]).optional(),
});

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Indexação resiliente e idempotente de um documento.
 *
 * Etapas com status próprio em `documents.processing_status`:
 * extracting → ocr_processing → chunking → embedding → ready | partial | error.
 *
 * Os novos chunks são gravados ANTES de remover os antigos: se qualquer etapa
 * falhar, a versão anterior do índice continua consultável.
 */
export const indexDocument = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => IndexSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts } = await import("./ai.server");
    const { parseDocument, detectFormat, UnsupportedFormatError, PARSER_VERSION } = await import(
      "./rag/parsers.server"
    );
    const { ocrPdfPages, ocrImage } = await import("./rag/ocr.server");
    const { structuredChunk, CHUNK_PROFILES, DEFAULT_CHUNK_PROFILE } = await import(
      "./rag/chunking"
    );

    const setStatus = async (status: string) => {
      await context.supabase
        .from("documents")
        .update({ processing_status: status })
        .eq("id", data.document_id);
    };

    const { data: doc, error: docErr } = await context.supabase
      .from("documents")
      .select("id, case_id, storage_path, file_type, filename")
      .eq("id", data.document_id)
      .eq("organization_id", context.organizationId)
      .single();
    if (docErr || !doc) throw new Error("Documento não encontrado");

    const profile = data.chunk_profile
      ? (CHUNK_PROFILES[data.chunk_profile] ?? DEFAULT_CHUNK_PROFILE)
      : DEFAULT_CHUNK_PROFILE;

    try {
      // Formato: recusa explícita em vez de ler binário como texto.
      let format: ReturnType<typeof detectFormat>;
      try {
        format = detectFormat(doc.filename, doc.file_type);
      } catch (e) {
        if (e instanceof UnsupportedFormatError) {
          await setStatus(`error: ${e.detail.slice(0, 180)}`);
          throw e;
        }
        throw e;
      }

      await setStatus("extracting");

      const { data: blob, error: dlErr } = await context.supabase.storage
        .from("documents")
        .download(doc.storage_path);
      if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");

      const parsed = await parseDocument({
        blob,
        filename: doc.filename,
        fileType: doc.file_type,
      });

      // OCR: imagens sempre; PDF apenas nas páginas fracas (ou tudo se forçado).
      let visionBlocks: DocBlock[] = [];
      let ocrFailedPages: number[] = [];
      let ocrPagesRun = 0;

      if (format === "image") {
        await setStatus("ocr_processing");
        visionBlocks = await ocrImage({
          blob,
          filename: doc.filename,
          fileType: doc.file_type,
        });
        ocrPagesRun = 1;
      } else if (format === "pdf") {
        const pages = data.force_vision
          ? Array.from({ length: parsed.pageCount }, (_, i) => i + 1)
          : parsed.ocrPages;
        if (pages.length > 0) {
          await setStatus("ocr_processing");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const out = await ocrPdfPages({ bytes, filename: doc.filename, pages });
          visionBlocks = out.blocks;
          ocrFailedPages = out.failedPages;
          ocrPagesRun = pages.length;
        }
      }

      await setStatus("chunking");

      // Blocos de visão substituem o texto extraído das MESMAS páginas
      // (evita indexar duas vezes a mesma página).
      const ocrPageSet = new Set(visionBlocks.map((b) => b.page).filter((p): p is number => p != null));
      const textBlocks = parsed.blocks.filter((b) => b.page == null || !ocrPageSet.has(b.page));

      const chunks = [
        ...structuredChunk(textBlocks, profile),
        ...structuredChunk(visionBlocks, profile),
      ];

      const plain = [parsed.plainText, visionBlocks.map((b) => b.content).join("\n\n")]
        .filter((s) => s && s.trim().length > 0)
        .join("\n\n[VISÃO]\n\n");

      if (chunks.length === 0) {
        await context.supabase
          .from("documents")
          .update({ processing_status: "empty", extracted_text: plain.slice(0, 200_000) })
          .eq("id", doc.id);
        return { ok: true, chunks: 0, vision_pages: ocrPagesRun, format };
      }

      await setStatus("embedding");

      const BATCH = 32;
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH).map((c) => c.content);
        embeddings.push(...(await embedTexts(slice)));
      }
      if (embeddings.length !== chunks.length) {
        throw new Error("Embeddings incompletos — índice anterior preservado.");
      }

      // Idempotência: chunk_index começa após o máximo atual, os novos entram
      // primeiro e só então os antigos são removidos.
      const { data: maxRow } = await context.supabase
        .from("document_chunks")
        .select("chunk_index")
        .eq("document_id", doc.id)
        .order("chunk_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const offset = ((maxRow?.chunk_index as number | undefined) ?? -1) + 1;

      const rows = chunks.map((c, idx) => ({
        document_id: doc.id,
        case_id: doc.case_id,
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        chunk_index: offset + idx,
        content: c.content,
        source_kind: c.source_kind === "table" ? "text" : c.source_kind,
        embedding: embeddings[idx] as unknown as string,
        page_start: c.page_start,
        page_end: c.page_end,
        section_title: c.section_title,
        sheet_name: c.sheet_name,
        row_start: c.row_start,
        row_end: c.row_end,
        parser_version: PARSER_VERSION,
        chunking_version: c.chunking_version,
        embedding_model: EMBEDDING_MODEL,
        token_count: c.token_count,
        content_hash: c.content_hash,
        metadata: { format, block_kind: c.source_kind },
      }));

      const { data: inserted, error: insErr } = await context.supabase
        .from("document_chunks")
        .insert(rows)
        .select("id");
      if (insErr) throw insErr;

      const newIds = new Set(((inserted ?? []) as Array<{ id: string }>).map((r) => r.id));
      const { data: existing } = await context.supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", doc.id);
      const staleIds = ((existing ?? []) as Array<{ id: string }>)
        .map((r) => r.id)
        .filter((id) => !newIds.has(id));
      if (staleIds.length > 0) {
        await context.supabase.from("document_chunks").delete().in("id", staleIds);
      }

      const partial = ocrFailedPages.length > 0;
      await context.supabase
        .from("documents")
        .update({
          processing_status: partial
            ? `partial: OCR falhou nas páginas ${ocrFailedPages.slice(0, 20).join(", ")}`
            : "ready",
          extracted_text: plain.slice(0, 200_000),
        })
        .eq("id", doc.id);

      return {
        ok: true,
        format,
        chunks: chunks.length,
        text_chunks: chunks.filter((c) => c.source_kind !== "vision").length,
        vision_chunks: chunks.filter((c) => c.source_kind === "vision").length,
        vision_pages: ocrPagesRun,
        failed_pages: ocrFailedPages,
        parser_version: PARSER_VERSION,
        chunking_version: profile.name,
        embedding_model: EMBEDDING_MODEL,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await setStatus(`error: ${msg.slice(0, 200)}`);
      throw err;
    }
  });

/** Reindexa documentos de um caso cujo índice está em versão anterior. */
export const reindexCaseDocuments = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ case_id: z.string().uuid(), limit: z.number().int().min(1).max(20).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename")
      .eq("case_id", data.case_id)
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 5);

    const pending: Array<{ id: string; filename: string }> = [];
    for (const d of (docs ?? []) as Array<{ id: string; filename: string }>) {
      const { data: chunk } = await context.supabase
        .from("document_chunks")
        .select("chunking_version")
        .eq("document_id", d.id)
        .limit(1)
        .maybeSingle();
      const version = (chunk?.chunking_version as string | null) ?? null;
      if (!version || !version.startsWith("structural")) pending.push(d);
    }

    return { pending, total: (docs ?? []).length };
  });
