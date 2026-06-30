import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Indexa um documento já enviado: baixa o arquivo do storage (se PDF, extrai),
 * gera chunks + embeddings via Lovable AI e grava em document_chunks.
 */
export const indexDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ document_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts, chunkText } = await import("./ai.server");

    // 1. Pega o doc
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
      // 2. Obter o texto
      let text = doc.extracted_text ?? "";
      if (!text) {
        const { data: blob, error: dlErr } = await context.supabase.storage
          .from("documents")
          .download(doc.storage_path);
        if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");

        const lower = doc.filename.toLowerCase();
        if (doc.file_type === "application/pdf" || lower.endsWith(".pdf")) {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const buffer = new Uint8Array(await blob.arrayBuffer());
          const pdf = await getDocumentProxy(buffer);
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
      }

      const chunks = chunkText(text, 1800, 200);
      if (chunks.length === 0) {
        await context.supabase
          .from("documents")
          .update({ processing_status: "empty", extracted_text: text })
          .eq("id", doc.id);
        return { ok: true, chunks: 0 };
      }

      // 3. Embeddings em batches (limite por requisição)
      const BATCH = 32;
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const embs = await embedTexts(slice);
        embeddings.push(...embs);
      }

      // 4. Apaga chunks antigos e insere novos
      await context.supabase.from("document_chunks").delete().eq("document_id", doc.id);
      const rows = chunks.map((content, idx) => ({
        document_id: doc.id,
        case_id: doc.case_id,
        user_id: context.userId,
        chunk_index: idx,
        content,
        embedding: embeddings[idx] as unknown as string, // pgvector aceita array via JS
      }));
      const { error: insErr } = await context.supabase.from("document_chunks").insert(rows);
      if (insErr) throw insErr;

      await context.supabase
        .from("documents")
        .update({
          processing_status: "ready",
          extracted_text: text.slice(0, 200_000), // cap pra não inflar
        })
        .eq("id", doc.id);

      return { ok: true, chunks: chunks.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await context.supabase
        .from("documents")
        .update({ processing_status: `error: ${msg.slice(0, 200)}` })
        .eq("id", doc.id);
      throw err;
    }
  });
