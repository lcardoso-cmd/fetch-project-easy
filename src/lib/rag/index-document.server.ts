/**
 * Indexação de um documento para consulta pela IA (RAG), executável tanto por
 * uma chamada direta quanto pelo processador de filas.
 *
 * Memória constante: PDFs são lidos por faixas de bytes (HTTP Range), página a
 * página, em janelas. Cada janela é convertida em trechos, indexada e gravada
 * antes de a próxima começar — então nem um processo de 4.000 páginas carrega o
 * arquivo inteiro na memória do servidor.
 *
 * Retomável: se o tempo da execução acabar no meio, o que já foi gravado
 * permanece e a próxima rodada continua da página seguinte.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocBlock } from "./chunking";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Páginas lidas/indexadas por janela. Mantém a memória previsível. */
const PAGE_WINDOW = 20;
/** Acima disso, OCR (que exige o arquivo em memória) não é possível. */
const OCR_MAX_FILE_BYTES = 40 * 1024 * 1024;
/** Formatos que não são PDF são lidos por inteiro; acima disso, recusa clara. */
const DIRECT_DOWNLOAD_MAX_BYTES = 40 * 1024 * 1024;
/** Teto de páginas enviadas para OCR em uma execução. */
const OCR_PAGE_LIMIT = 60;
const MIN_CHARS_PER_PAGE = 120;

export interface IndexDocumentParams {
  supabase: SupabaseClient;
  documentId: string;
  organizationId: string;
  userId: string;
  forceVision?: boolean;
  chunkProfile?: "structural-sm" | "structural-md" | "structural-lg";
  /** Momento (ms epoch) em que a execução deve parar e devolver o progresso. */
  deadlineAt?: number;
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
  /** Verdadeiro quando o tempo acabou e ainda há páginas por ler. */
  incomplete?: boolean;
  pages_done?: number;
  pages_total?: number;
  /** Páginas de imagem que ficaram sem OCR (arquivo grande demais). */
  ocr_skipped_pages?: number[];
}

export class FileTooLargeForMemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeForMemoryError";
  }
}

function weakText(text: string): boolean {
  return text.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE;
}

export async function indexDocumentCore(
  params: IndexDocumentParams,
): Promise<IndexDocumentResult> {
  const { supabase, documentId, organizationId, userId } = params;
  const { embedTexts } = await import("../ai.server");
  const {
    parseDocument,
    detectFormat,
    UnsupportedFormatError,
    PARSER_VERSION,
    splitByHeadings,
  } = await import("./parsers.server");
  const { ocrPdfPages, ocrImage } = await import("./ocr.server");
  const { structuredChunk, CHUNK_PROFILES, DEFAULT_CHUNK_PROFILE } = await import("./chunking");
  const { withStepRetry, describeStepFailure } = await import("./step-retry");

  const STAGE_PCT: Record<string, number> = {
    download: 8,
    parse: 15,
    extracting_text: 30,
    ocr_processing: 85,
    chunking: 60,
    embedding: 70,
    done: 100,
  };

  let currentStage = "extracting";
  let currentPercent: number | null = null;
  const report = async (stage: string, detail?: Record<string, unknown>) => {
    currentStage = stage;
    const percent = (detail?.percent as number | undefined) ?? STAGE_PCT[stage] ?? null;
    currentPercent = percent;
    await params.onProgress?.(stage, { ...(detail ?? {}), percent });
  };

  /** Repete a etapa em falhas transitórias e registra o motivo para o usuário. */
  const step = <T,>(name: string, fn: () => Promise<T>, attempts = 3) =>
    withStepRetry(name, fn, {
      attempts,
      onAttemptFailed: async (info) => {
        await params.onProgress?.(currentStage, {
          percent: currentPercent,
          step: info.step,
          step_attempt: info.attempt,
          step_attempts: info.attempts,
          step_will_retry: info.willRetry,
          step_warning: describeStepFailure(info),
        });
      },
    });

  const setStatus = async (status: string) => {
    await supabase.from("documents").update({ processing_status: status }).eq("id", documentId);
  };

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, case_id, storage_path, file_type, filename, page_offset, file_size, extracted_text")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .single();
  if (docErr || !doc) throw new Error("Documento não encontrado");

  const fileSize = Number((doc as { file_size?: number | null }).file_size ?? 0) || 0;
  const profile = params.chunkProfile
    ? (CHUNK_PROFILES[params.chunkProfile] ?? DEFAULT_CHUNK_PROFILE)
    : DEFAULT_CHUNK_PROFILE;
  const pageOffset = Number((doc as { page_offset?: number | null }).page_offset ?? 0) || 0;
  const shiftPage = (p: number | null | undefined) =>
    typeof p === "number" ? p + pageOffset : p;

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

    // ---------- estado do índice: retomada e limpeza ----------
    const { data: idxRows } = await supabase
      .from("document_chunks")
      .select("chunk_index")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: false })
      .limit(1);
    let nextChunkIndex = ((idxRows?.[0]?.chunk_index as number | undefined) ?? -1) + 1;

    const { data: pageRows } = await supabase
      .from("document_chunks")
      .select("page_end")
      .eq("document_id", documentId)
      .not("page_end", "is", null)
      .order("page_end", { ascending: false })
      .limit(1);
    const indexedUntilPage = params.forceVision
      ? 0
      : Math.max(0, ((pageRows?.[0]?.page_end as number | undefined) ?? 0) - pageOffset);

    const resuming = indexedUntilPage > 0;

    /** Ids anteriores que devem sair quando a reindexação começar do zero. */
    let staleIds: string[] = [];
    if (!resuming) {
      const { data: existing } = await supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", documentId);
      staleIds = ((existing ?? []) as Array<{ id: string }>).map((r) => r.id);
    }

    const insertChunks = async (
      chunks: Array<{
        content: string;
        source_kind: string;
        page_start?: number | null;
        page_end?: number | null;
        section_title?: string | null;
        sheet_name?: string | null;
        row_start?: number | null;
        row_end?: number | null;
        chunking_version: string;
        token_count?: number | null;
        content_hash?: string | null;
      }>,
      embeddings: number[][],
    ) => {
      const rows = chunks.map((c, idx) => ({
        document_id: documentId,
        case_id: doc.case_id,
        organization_id: organizationId,
        created_by_user_id: userId,
        chunk_index: nextChunkIndex + idx,
        content: c.content,
        source_kind: c.source_kind === "table" ? "text" : c.source_kind,
        embedding: embeddings[idx] as unknown as string,
        page_start: shiftPage(c.page_start),
        page_end: shiftPage(c.page_end),
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
      await step("insert", async () => {
        const { error } = await supabase.from("document_chunks").insert(rows);
        if (error) throw error;
      });
      nextChunkIndex += rows.length;
    };

    const embedAndInsert = async (blocks: DocBlock[]) => {
      const chunks = structuredChunk(blocks, profile);
      if (chunks.length === 0) return 0;
      const embeddings = await step("embedding", async () => {
        const out = await embedTexts(chunks.map((c) => c.content));
        if (out.length !== chunks.length) {
          throw new Error("Embeddings incompletos — índice anterior preservado.");
        }
        return out;
      });
      await insertChunks(chunks as never, embeddings);
      return chunks.length;
    };

    let textChunks = 0;
    let visionChunks = 0;
    let ocrPagesRun = 0;
    let ocrFailedPages: number[] = [];
    let ocrSkippedPages: number[] = [];
    let pageCount = 0;
    let pagesDone = indexedUntilPage;
    let incomplete = false;
    let plainAccum = resuming
      ? String((doc as { extracted_text?: string | null }).extracted_text ?? "")
      : "";

    await setStatus("extracting");
    await report("download");

    if (format === "pdf") {
      // ---------- PDF: leitura por faixas de bytes, janela por janela ----------
      const signedUrl = await step("download", async () => {
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.storage_path as string, 3600);
        if (error || !data?.signedUrl) throw new Error("Falha ao acessar o arquivo no storage");
        return data.signedUrl;
      });

      const { openRemotePdf, remoteFileSize } = await import("./pdf-range.server");
      // Tamanho real do arquivo: o cadastro pode estar zerado/desatualizado e é
      // ele que decide se o OCR (que exige o arquivo em memória) é possível.
      let effectiveSize = fileSize;
      if (effectiveSize <= 0) {
        effectiveSize = await remoteFileSize(signedUrl).catch(() => 0);
      }
      const pdf = await step("parse", () =>
        openRemotePdf(signedUrl, effectiveSize || undefined),
      );

      pageCount = pdf.numPages;
      const weakPages: number[] = [];

      try {
        await report("extracting_text", {
          pages: pageCount,
          pages_done: pagesDone,
          pages_total: pageCount,
          percent: 30,
        });

        for (let start = pagesDone + 1; start <= pageCount; start += PAGE_WINDOW) {
          const end = Math.min(start + PAGE_WINDOW - 1, pageCount);
          const blocks: DocBlock[] = [];

          for (let page = start; page <= end; page++) {
            let text = "";
            try {
              text = await pdf.pageText(page);
            } catch {
              // Página ilegível não interrompe o documento.
              text = "";
            }
            if (weakText(text)) {
              weakPages.push(page);
              if (!text.trim()) continue;
            }
            for (const b of splitByHeadings(text.replace(/\r\n?/g, "\n").trim())) {
              blocks.push({ ...b, page, kind: "text" });
            }
            if (plainAccum.length < 200_000) plainAccum += `${text}\n\n`;
          }

          if (blocks.length > 0) textChunks += await embedAndInsert(blocks);

          pagesDone = end;
          const percent = 30 + Math.round((pagesDone / Math.max(1, pageCount)) * 50);
          await report("extracting_text", {
            pages: pageCount,
            pages_done: pagesDone,
            pages_total: pageCount,
            percent,
          });

          if (params.deadlineAt && Date.now() > params.deadlineAt && pagesDone < pageCount) {
            incomplete = true;
            break;
          }
        }
      } finally {
        await pdf.destroy().catch(() => {});
      }

      if (!incomplete) {
        const targetOcr = params.forceVision
          ? Array.from({ length: pageCount }, (_, i) => i + 1)
          : weakPages;
        if (targetOcr.length > 0) {
          // Sem tamanho conhecido, presume-se grande: melhor entregar o
          // documento parcial do que estourar a memória do servidor.
          if (effectiveSize <= 0 || effectiveSize > OCR_MAX_FILE_BYTES) {
            ocrSkippedPages = targetOcr;
          } else {
            try {
              await setStatus("ocr_processing");
              await report("ocr_processing", { pages: targetOcr.length, percent: 85 });
              const pages = targetOcr.slice(0, OCR_PAGE_LIMIT);
              if (targetOcr.length > pages.length) {
                ocrSkippedPages = targetOcr.slice(OCR_PAGE_LIMIT);
              }
              const bytes = await step("download", async () => {
                const res = await fetch(signedUrl);
                if (!res.ok) throw new Error("Falha ao baixar arquivo do storage");
                const buf = new Uint8Array(await res.arrayBuffer());
                if (buf.byteLength > OCR_MAX_FILE_BYTES) {
                  throw new FileTooLargeForMemoryError(
                    "Arquivo grande demais para OCR completo nesta execução.",
                  );
                }
                return buf;
              });

              const out = await step("ocr", () =>
                ocrPdfPages({ bytes, filename: doc.filename as string, pages }),
              );
              ocrFailedPages = out.failedPages;
              ocrPagesRun = pages.length;
              if (out.blocks.length > 0) visionChunks += await embedAndInsert(out.blocks);
              for (const p of out.pages) {
                if (p.text.trim() && plainAccum.length < 200_000) plainAccum += `${p.text}\n\n`;
              }
            } catch {
              // O texto já indexado permanece: as páginas de imagem ficam
              // marcadas como pendentes de OCR em vez de invalidar o documento.
              ocrSkippedPages = targetOcr;
            }
          }

        }
      }
    } else {
      // ---------- Formatos leves: leitura direta, com teto de tamanho ----------
      if (fileSize > DIRECT_DOWNLOAD_MAX_BYTES) {
        throw new FileTooLargeForMemoryError(
          `Arquivo grande demais para leitura direta (${Math.round(fileSize / 1024 / 1024)} MB). Converta para PDF ou divida o arquivo.`,
        );
      }
      const blob = await step("download", async () => {
        const { data, error } = await supabase.storage
          .from("documents")
          .download(doc.storage_path as string);
        if (error || !data) throw new Error("Falha ao baixar arquivo do storage");
        return data;
      });

      await report("parse");
      const parsed = await step("parse", () =>
        parseDocument({
          blob,
          filename: doc.filename as string,
          fileType: doc.file_type as string,
        }),
      );
      pageCount = parsed.pageCount;
      pagesDone = parsed.pageCount;

      let blocks = parsed.blocks;
      if (format === "image") {
        await setStatus("ocr_processing");
        await report("ocr_processing", { pages: 1 });
        const visionBlocks = await step("ocr", () =>
          ocrImage({
            blob,
            filename: doc.filename as string,
            fileType: doc.file_type as string,
          }),
        );
        ocrPagesRun = 1;
        blocks = [...blocks, ...visionBlocks];
        visionChunks += 0;
      }

      await setStatus("chunking");
      await report("chunking");
      const total = await embedAndInsert(blocks);
      if (total === 0) throw new Error("Nenhum conteúdo indexável encontrado no documento.");
      textChunks += total;
      plainAccum =
        parsed.plainText ||
        blocks
          .map((b) => b.content)
          .join("\n\n")
          .trim();
    }

    if (!incomplete && textChunks + visionChunks === 0 && !resuming) {
      throw new Error("Nenhum conteúdo indexável encontrado no documento.");
    }

    if (!incomplete && staleIds.length > 0) {
      // Remove o índice anterior só depois que o novo já está gravado.
      for (let i = 0; i < staleIds.length; i += 200) {
        await supabase
          .from("document_chunks")
          .delete()
          .in("id", staleIds.slice(i, i + 200));
      }
    }

    const partialOcr = ocrFailedPages.length > 0;
    const status = incomplete
      ? "extracting"
      : ocrSkippedPages.length > 0
        ? `partial: ${ocrSkippedPages.length} página(s) de imagem sem OCR (arquivo grande). Divida o arquivo em partes para ler as imagens.`
        : partialOcr
          ? `partial: OCR falhou nas páginas ${ocrFailedPages.slice(0, 20).join(", ")}`
          : "ready";

    await supabase
      .from("documents")
      .update({
        processing_status: status,
        extracted_text: plainAccum.slice(0, 200_000),
      })
      .eq("id", documentId);

    if (!incomplete) await report("done", { percent: 100 });

    return {
      ok: true,
      format,
      chunks: textChunks + visionChunks,
      text_chunks: textChunks,
      vision_chunks: visionChunks,
      vision_pages: ocrPagesRun,
      failed_pages: ocrFailedPages,
      parser_version: PARSER_VERSION,
      chunking_version: profile.name,
      embedding_model: EMBEDDING_MODEL,
      ...(incomplete ? { incomplete: true } : {}),
      pages_done: pagesDone,
      pages_total: pageCount,
      ...(ocrSkippedPages.length > 0 ? { ocr_skipped_pages: ocrSkippedPages } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(`error: ${msg.slice(0, 200)}`);
    throw err;
  }
}
