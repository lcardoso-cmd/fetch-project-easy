import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IndexSchema = z.object({
  document_id: z.string().uuid(),
  force_vision: z.boolean().optional(),
});

/**
 * Indexa um documento já enviado: baixa o arquivo do storage (se PDF, extrai),
 * gera chunks + embeddings via Lovable AI e grava em document_chunks.
 *
 * Se o PDF for escaneado (pouco texto por página) ou force_vision=true,
 * envia o PDF diretamente ao Gemini para transcrição multimodal (OCR + visão).
 */
export const indexDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IndexSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts, chunkText, visionExtractPdf } = await import("./ai.server");

    const { data: doc, error: docErr } = await context.supabase
      .from("documents")
      .select("id, case_id, storage_path, file_type, filename, extracted_text")
      .eq("id", data.document_id)
      .eq("user_id", context.userId)
      .single();
    if (docErr || !doc) throw new Error("Documento não encontrado");

    await context.supabase
      .from("documents")
      .update({ processing_status: "processing" })
      .eq("id", doc.id);

    try {
      const lower = doc.filename.toLowerCase();
      const isPdf = doc.file_type === "application/pdf" || lower.endsWith(".pdf");

      let text = "";
      let visionText = "";
      let pdfBytes: Uint8Array | null = null;
      let pageCount = 0;

      // 1. Baixa e extrai texto
      const { data: blob, error: dlErr } = await context.supabase.storage
        .from("documents")
        .download(doc.storage_path);
      if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");

      if (isPdf) {
        const { extractText, getDocumentProxy } = await import("unpdf");
        pdfBytes = new Uint8Array(await blob.arrayBuffer());
        const pdf = await getDocumentProxy(pdfBytes);
        pageCount = pdf.numPages;
        const { text: pdfText } = await extractText(pdf, { mergePages: true });
        text = Array.isArray(pdfText) ? pdfText.join("\n") : pdfText;
      } else if (
        lower.endsWith(".docx") ||
        doc.file_type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = await import("mammoth");
        const buffer = Buffer.from(await blob.arrayBuffer());
        const { value } = await mammoth.extractRawText({ buffer });
        text = value;
      } else {
        text = await blob.text();
      }

      // 2. Detecta PDF escaneado: texto muito curto por página → usa visão
      const charsPerPage = pageCount > 0 ? text.replace(/\s+/g, "").length / pageCount : Infinity;
      const looksScanned = isPdf && pdfBytes && (charsPerPage < 120 || text.trim().length < 200);
      const doVision = isPdf && pdfBytes && (data.force_vision || looksScanned);

      if (doVision && pdfBytes) {
        try {
          visionText = await visionExtractPdf(pdfBytes, doc.filename);
        } catch (e) {
          // não deixa cair — apenas registra dentro do status
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[vision]", msg);
        }
      }

      // 3. Monta chunks — texto normal + visão marcados separadamente
      const textChunks = chunkText(text, 1800, 200);
      const visionChunks = chunkText(visionText, 1800, 200);

      const allChunks: Array<{ content: string; source_kind: "text" | "vision" }> = [
        ...textChunks.map((c) => ({ content: c, source_kind: "text" as const })),
        ...visionChunks.map((c) => ({ content: c, source_kind: "vision" as const })),
      ];

      if (allChunks.length === 0) {
        await context.supabase
          .from("documents")
          .update({ processing_status: "empty", extracted_text: text })
          .eq("id", doc.id);
        return { ok: true, chunks: 0, vision_used: doVision };
      }

      // 4. Embeddings em batches
      const BATCH = 32;
      const embeddings: number[][] = [];
      for (let i = 0; i < allChunks.length; i += BATCH) {
        const slice = allChunks.slice(i, i + BATCH).map((c) => c.content);
        const embs = await embedTexts(slice);
        embeddings.push(...embs);
      }

      // 5. Substitui chunks
      await context.supabase.from("document_chunks").delete().eq("document_id", doc.id);
      const rows = allChunks.map((c, idx) => ({
        document_id: doc.id,
        case_id: doc.case_id,
        user_id: context.userId,
        chunk_index: idx,
        content: c.content,
        source_kind: c.source_kind,
        embedding: embeddings[idx] as unknown as string,
      }));
      const { error: insErr } = await context.supabase.from("document_chunks").insert(rows);
      if (insErr) throw insErr;

      const combined = [text, visionText].filter(Boolean).join("\n\n[VISÃO]\n\n");
      await context.supabase
        .from("documents")
        .update({
          processing_status: "ready",
          extracted_text: combined.slice(0, 200_000),
        })
        .eq("id", doc.id);

      return {
        ok: true,
        chunks: allChunks.length,
        text_chunks: textChunks.length,
        vision_chunks: visionChunks.length,
        vision_used: Boolean(doVision),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await context.supabase
        .from("documents")
        .update({ processing_status: `error: ${msg.slice(0, 200)}` })
        .eq("id", doc.id);
      throw err;
    }
  });
