/**
 * Indexação de um documento para consulta pela IA (RAG), executável tanto por
 * uma chamada direta quanto pelo processador de filas.
 *
 * Idempotente: os novos trechos entram antes de os antigos serem removidos,
 * então uma falha no meio do caminho preserva o índice anterior.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocBlock } from "./chunking";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export interface IndexDocumentParams {
  supabase: SupabaseClient;
  documentId: string;
  organizationId: string;
  userId: string;
  forceVision?: boolean;
  chunkProfile?: "structural-sm" | "structural-md" | "structural-lg";
  /** Chamado entre etapas longas — usado pela fila para manter o bloqueio. */
  onProgress?: (stage: string, detail?: Record<string, unknown>) => void | Promise<void>;
}

export interface IndexDocumentResult {
  ok: true;
  format: string;
  chunks: number;
  text_chunks: number;
  vision_chunks: number;
  vision_pages: number;
  failed_pages: number[];
  parser_version: string;
  chunking_version: string;
  embedding_model: string;
}

export async function indexDocumentCore(
  params: IndexDocumentParams,
): Promise<IndexDocumentResult> {
  const { supabase, documentId, organizationId, userId } = params;
  const { embedTexts } = await import("../ai.server");
  const { parseDocument, detectFormat, UnsupportedFormatError, PARSER_VERSION } = await import(
    "./parsers.server"
  );
  const { ocrPdfPages, ocrImage } = await import("./ocr.server");
  const { structuredChunk, CHUNK_PROFILES, DEFAULT_CHUNK_PROFILE } = await import("./chunking");

  const report = async (stage: string, detail?: Record<string, unknown>) => {
    await params.onProgress?.(stage, detail);
  };

  const setStatus = async (status: string) => {
    await supabase.from("documents").update({ processing_status: status }).eq("id", documentId);
  };

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, case_id, storage_path, file_type, filename")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .single();
  if (docErr || !doc) throw new Error("Documento não encontrado");

  const profile = params.chunkProfile
    ? (CHUNK_PROFILES[params.chunkProfile] ?? DEFAULT_CHUNK_PROFILE)
    : DEFAULT_CHUNK_PROFILE;

  try {
    let format: ReturnType<typeof detectFormat>;
    try {
      format = detectFormat(doc.filename as string, doc.file_type as string);
    } catch (e) {
      if (e instanceof UnsupportedFormatError) {
        await setStatus(`error: ${e.detail.slice(0, 180)}`);
      }
      throw e;
    }

    await setStatus("extracting");
    await report("extracting");

    const { data: blob, error: dlErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path as string);
    if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");

    const parsed = await parseDocument({
      blob,
      filename: doc.filename as string,
      fileType: doc.file_type as string,
    });

    let visionBlocks: DocBlock[] = [];
    let ocrFailedPages: number[] = [];
    let ocrPagesRun = 0;

    if (format === "image") {
      await setStatus("ocr_processing");
      await report("ocr_processing", { pages: 1 });
      visionBlocks = await ocrImage({
        blob,
        filename: doc.filename as string,
        fileType: doc.file_type as string,
      });
      ocrPagesRun = 1;
    } else if (format === "pdf") {
      const pages = params.forceVision
        ? Array.from({ length: parsed.pageCount }, (_, i) => i + 1)
        : parsed.ocrPages;
      if (pages.length > 0) {
        await setStatus("ocr_processing");
        await report("ocr_processing", { pages: pages.length });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const out = await ocrPdfPages({
          bytes,
          filename: doc.filename as string,
          pages,
        });
        visionBlocks = out.blocks;
        ocrFailedPages = out.failedPages;
        ocrPagesRun = pages.length;
      }
    }

    await setStatus("chunking");
    await report("chunking");

    const visionPages = new Set(visionBlocks.map((b) => b.page).filter(Boolean) as number[]);
    const textBlocks = parsed.blocks.filter((b) => !b.page || !visionPages.has(b.page));
    const blocks = [...textBlocks, ...visionBlocks];
    const chunks = structuredChunk(blocks, profile);
    if (chunks.length === 0) throw new Error("Nenhum conteúdo indexável encontrado no documento.");

    const plain =
      parsed.plainText ||
      blocks
        .map((b) => b.content)
        .join("\n\n")
        .trim();

    await setStatus("embedding");
    await report("embedding", { chunks: chunks.length });

    const embeddings = await embedTexts(chunks.map((c) => c.content));
    if (embeddings.length !== chunks.length) {
      throw new Error("Embeddings incompletos — índice anterior preservado.");
    }

    const { data: maxRow } = await supabase
      .from("document_chunks")
      .select("chunk_index")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const offset = ((maxRow?.chunk_index as number | undefined) ?? -1) + 1;

    const rows = chunks.map((c, idx) => ({
      document_id: documentId,
      case_id: doc.case_id,
      organization_id: organizationId,
      created_by_user_id: userId,
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

    const { data: inserted, error: insErr } = await supabase
      .from("document_chunks")
      .insert(rows)
      .select("id");
    if (insErr) throw insErr;

    const newIds = new Set(((inserted ?? []) as Array<{ id: string }>).map((r) => r.id));
    const { data: existing } = await supabase
      .from("document_chunks")
      .select("id")
      .eq("document_id", documentId);
    const staleIds = ((existing ?? []) as Array<{ id: string }>)
      .map((r) => r.id)
      .filter((id) => !newIds.has(id));
    if (staleIds.length > 0) {
      await supabase.from("document_chunks").delete().in("id", staleIds);
    }

    const partial = ocrFailedPages.length > 0;
    await supabase
      .from("documents")
      .update({
        processing_status: partial
          ? `partial: OCR falhou nas páginas ${ocrFailedPages.slice(0, 20).join(", ")}`
          : "ready",
        extracted_text: plain.slice(0, 200_000),
      })
      .eq("id", documentId);

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
}
