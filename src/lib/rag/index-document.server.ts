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
import { decidePdfPageReadMode, needsNativeVerification } from "./pdf-text-quality";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Páginas lidas/indexadas por janela. Mantém a memória previsível. */
const PAGE_WINDOW = 20;
/** Acima disso, OCR (que exige o arquivo em memória) não é possível. */
const OCR_MAX_FILE_BYTES = 40 * 1024 * 1024;
/** Formatos que não são PDF são lidos por inteiro; acima disso, recusa clara. */
const DIRECT_DOWNLOAD_MAX_BYTES = 40 * 1024 * 1024;
/** Teto de páginas enviadas para OCR em uma execução. */
const OCR_PAGE_LIMIT = 60;
const NATIVE_DETECTION_VERSION = "native-v2";

export interface IndexResumeProgress {
  run_id?: string;
  phase?: "extracting_text" | "verifying_text" | "ocr_processing";
  text_pages_done?: number;
  pages_total?: number;
  weak_pages?: number[];
  native_detection_version?: string;
  native_candidate_pages?: number[];
  native_verified_pages?: number[];
  native_failed_pages?: number[];
  ocr_pages_done?: number[];
  ocr_failed_pages?: number[];
  ocr_pages_total?: number;
}

export interface IndexDocumentParams {
  supabase: SupabaseClient;
  documentId: string;
  organizationId: string;
  userId: string;
  forceVision?: boolean;
  chunkProfile?: "structural-sm" | "structural-md" | "structural-lg";
  /** Momento (ms epoch) em que a execução deve parar e devolver o progresso. */
  deadlineAt?: number;
  /** Estado durável salvo em document_index_jobs.progress. */
  resumeProgress?: IndexResumeProgress | null;
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
  /** Estado necessário para continuar exatamente de onde parou. */
  resume_progress?: IndexResumeProgress;
}

export class FileTooLargeForMemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeForMemoryError";
  }
}

export async function indexDocumentCore(params: IndexDocumentParams): Promise<IndexDocumentResult> {
  const { supabase, documentId, organizationId, userId } = params;
  const { embedTexts } = await import("../ai.server");
  const { parseDocument, detectFormat, UnsupportedFormatError, PARSER_VERSION, splitByHeadings } =
    await import("./parsers.server");
  const { ocrPdfPages, ocrImage } = await import("./ocr.server");
  const { structuredChunk, CHUNK_PROFILES, DEFAULT_CHUNK_PROFILE } = await import("./chunking");
  const { withStepRetry, describeStepFailure } = await import("./step-retry");

  const STAGE_PCT: Record<string, number> = {
    download: 2,
    parse: 5,
    extracting_text: 10,
    verifying_text: 20,
    ocr_processing: 30,
    chunking: 96,
    embedding: 98,
    done: 100,
  };

  // Checkpoints criados antes da classificação nativa v2 podem conter páginas
  // encaminhadas ao OCR apenas porque o leitor por faixas falhou. Esses runs
  // são reiniciados de forma limpa; o OCR já realizado não é reutilizado.
  const legacyAutomaticOcrResume = Boolean(
    !params.forceVision &&
    params.resumeProgress?.phase === "ocr_processing" &&
    params.resumeProgress?.native_detection_version !== NATIVE_DETECTION_VERSION,
  );
  const activeResume = legacyAutomaticOcrResume ? null : params.resumeProgress;
  let resumeState: IndexResumeProgress = {
    ...(activeResume ?? {}),
    run_id: activeResume?.run_id ?? crypto.randomUUID(),
    weak_pages: [...(activeResume?.weak_pages ?? [])],
    native_detection_version: NATIVE_DETECTION_VERSION,
    native_candidate_pages: [...(activeResume?.native_candidate_pages ?? [])],
    native_verified_pages: [...(activeResume?.native_verified_pages ?? [])],
    native_failed_pages: [...(activeResume?.native_failed_pages ?? [])],
    ocr_pages_done: [...(activeResume?.ocr_pages_done ?? [])],
    ocr_failed_pages: [...(activeResume?.ocr_failed_pages ?? [])],
  };
  let currentStage = "extracting";
  let currentPercent: number | null = null;
  const report = async (stage: string, detail?: Record<string, unknown>) => {
    currentStage = stage;
    const percent = (detail?.percent as number | undefined) ?? STAGE_PCT[stage] ?? null;
    currentPercent = percent;
    await params.onProgress?.(stage, {
      ...resumeState,
      ...(detail ?? {}),
      percent,
    });
  };

  /** Repete a etapa em falhas transitórias e registra o motivo para o usuário. */
  const step = <T>(name: string, fn: () => Promise<T>, attempts = 3) =>
    withStepRetry(name, fn, {
      attempts,
      onAttemptFailed: async (info) => {
        await params.onProgress?.(currentStage, {
          ...resumeState,
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
    .select(
      "id, case_id, storage_path, file_type, filename, page_offset, file_size, extracted_text",
    )
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .single();
  if (docErr || !doc) throw new Error("Documento não encontrado");

  const fileSize = Number((doc as { file_size?: number | null }).file_size ?? 0) || 0;
  const profile = params.chunkProfile
    ? (CHUNK_PROFILES[params.chunkProfile] ?? DEFAULT_CHUNK_PROFILE)
    : DEFAULT_CHUNK_PROFILE;
  const pageOffset = Number((doc as { page_offset?: number | null }).page_offset ?? 0) || 0;
  const shiftPage = (p: number | null | undefined) => (typeof p === "number" ? p + pageOffset : p);

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
    if (legacyAutomaticOcrResume && params.resumeProgress?.run_id) {
      const oldRunId = params.resumeProgress.run_id;
      const { data: oldRunChunks } = await supabase
        .from("document_chunks")
        .select("id, metadata")
        .eq("document_id", documentId);
      const oldRunIds = (oldRunChunks ?? [])
        .filter((chunk) => {
          const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
          return metadata.index_run_id === oldRunId;
        })
        .map((chunk) => chunk.id as string);
      for (let i = 0; i < oldRunIds.length; i += 200) {
        const { error } = await supabase
          .from("document_chunks")
          .delete()
          .in("id", oldRunIds.slice(i, i + 200));
        if (error) throw error;
      }
    }

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
      .eq("source_kind", "text")
      .not("page_end", "is", null)
      .order("page_end", { ascending: false })
      .limit(1);
    const resumedTextPage = Math.max(0, Number(activeResume?.text_pages_done ?? 0) || 0);
    const hasDurableResume =
      activeResume?.phase === "extracting_text" ||
      activeResume?.phase === "verifying_text" ||
      activeResume?.phase === "ocr_processing";
    // Chunks existentes, sozinhos, não significam que este trabalho é uma
    // continuação: um clique em “Processar novamente” precisa gerar um índice
    // novo. Só usamos o maior page_end quando há checkpoint da fila.
    const indexedUntilPage =
      !params.forceVision && hasDurableResume
        ? Math.max(0, ((pageRows?.[0]?.page_end as number | undefined) ?? 0) - pageOffset)
        : 0;

    const resuming = indexedUntilPage > 0 || resumedTextPage > 0;

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
        metadata: {
          format,
          block_kind: c.source_kind,
          index_run_id: resumeState.run_id,
        },
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
    let ocrFailedPages: number[] = [...(activeResume?.ocr_failed_pages ?? [])];
    let ocrSkippedPages: number[] = [];
    let pageCount = 0;
    let pagesDone = Math.max(indexedUntilPage, resumedTextPage);
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

      const {
        openPdfBytes,
        openRemotePdf,
        readPdfPageInfoWithRetry,
        remoteFileSize,
        RangeNotSupportedError,
      } = await import("./pdf-range.server");
      // Tamanho real do arquivo: o cadastro pode estar zerado/desatualizado e é
      // ele que decide se o OCR (que exige o arquivo em memória) é possível.
      let effectiveSize = fileSize;
      if (effectiveSize <= 0) {
        effectiveSize = await remoteFileSize(signedUrl).catch(() => 0);
      }
      let fullPdfBytes: Uint8Array | null = null;
      const downloadFullPdf = async () => {
        if (fullPdfBytes) return fullPdfBytes;
        fullPdfBytes = await step("download", async () => {
          const res = await fetch(signedUrl);
          if (!res.ok) throw new Error("Falha ao baixar arquivo do storage");
          const declaredSize = Number(res.headers.get("content-length") ?? 0);
          if (declaredSize > OCR_MAX_FILE_BYTES) {
            await res.body?.cancel().catch(() => {});
            throw new FileTooLargeForMemoryError(
              "Arquivo grande demais para leitura integral nesta execução.",
            );
          }
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.byteLength > OCR_MAX_FILE_BYTES) {
            throw new FileTooLargeForMemoryError(
              "Arquivo grande demais para leitura integral nesta execução.",
            );
          }
          return bytes;
        });
        return fullPdfBytes;
      };

      let pdf: Awaited<ReturnType<typeof openRemotePdf>>;
      try {
        pdf = await step("parse", () => openRemotePdf(signedUrl, effectiveSize || undefined));
      } catch (error) {
        if (!(error instanceof RangeNotSupportedError)) throw error;
        // Algumas configurações de storage não aceitam HTTP Range. As partes
        // pequenas continuam sendo lidas nativamente pelo buffer completo.
        if (effectiveSize <= 0 || effectiveSize > OCR_MAX_FILE_BYTES) {
          throw new FileTooLargeForMemoryError(
            "O armazenamento não ofereceu leitura por partes e o arquivo é grande demais para leitura integral.",
          );
        }
        const bytes = await downloadFullPdf();
        pdf = await step("parse", () => openPdfBytes(bytes.slice()));
      }

      pageCount = pdf.numPages;
      const weakPageSet = new Set<number>(activeResume?.weak_pages ?? []);
      const weakPages = () => [...weakPageSet].sort((a, b) => a - b);
      const nativeCandidateSet = new Set<number>(activeResume?.native_candidate_pages ?? []);
      const nativeVerifiedSet = new Set<number>(activeResume?.native_verified_pages ?? []);
      const nativeFailedSet = new Set<number>(activeResume?.native_failed_pages ?? []);
      const nativeCandidates = () => [...nativeCandidateSet].sort((a, b) => a - b);
      const nativeVerified = () => [...nativeVerifiedSet].sort((a, b) => a - b);
      const nativeFailed = () => [...nativeFailedSet].sort((a, b) => a - b);
      resumeState = {
        ...resumeState,
        phase: "extracting_text",
        text_pages_done: pagesDone,
        pages_total: pageCount,
        weak_pages: weakPages(),
        native_candidate_pages: nativeCandidates(),
        native_verified_pages: nativeVerified(),
        native_failed_pages: nativeFailed(),
      };

      try {
        await report("extracting_text", {
          pages: pageCount,
          pages_done: pagesDone,
          pages_total: pageCount,
          percent: 5,
        });

        for (let start = pagesDone + 1; start <= pageCount; start += PAGE_WINDOW) {
          const end = Math.min(start + PAGE_WINDOW - 1, pageCount);
          const blocks: DocBlock[] = [];

          for (let page = start; page <= end; page++) {
            let info;
            try {
              info = await readPdfPageInfoWithRetry(pdf, page);
            } catch {
              // Falha do parser não significa ausência de texto. A página será
              // verificada por uma segunda via antes de qualquer OCR.
              nativeCandidateSet.add(page);
              nativeFailedSet.add(page);
              continue;
            }

            const mode = decidePdfPageReadMode(info);
            if (needsNativeVerification(info)) nativeCandidateSet.add(page);
            if (mode === "ocr") {
              weakPageSet.add(page);
              continue;
            }
            weakPageSet.delete(page);
            nativeFailedSet.delete(page);
            if (mode === "native") {
              for (const b of splitByHeadings(info.text.replace(/\r\n?/g, "\n").trim())) {
                blocks.push({ ...b, page, kind: "text" });
              }
              if (plainAccum.length < 200_000) plainAccum += `${info.text}\n\n`;
            }
          }

          if (blocks.length > 0) textChunks += await embedAndInsert(blocks);

          pagesDone = end;
          resumeState = {
            ...resumeState,
            phase: "extracting_text",
            text_pages_done: pagesDone,
            pages_total: pageCount,
            weak_pages: weakPages(),
            native_candidate_pages: nativeCandidates(),
            native_verified_pages: nativeVerified(),
            native_failed_pages: nativeFailed(),
          };
          const percent = 5 + Math.round((pagesDone / Math.max(1, pageCount)) * 15);
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

      // Antes do OCR, toda página curta, vazia ou com erro é reaberta a partir
      // do arquivo completo (segunda via nativa). Como as partes são mantidas
      // abaixo do teto de memória, isso elimina falsos OCR causados por Range.
      const unverifiedNative = nativeCandidates().filter((page) => !nativeVerifiedSet.has(page));
      if (!incomplete && !params.forceVision && unverifiedNative.length > 0) {
        if (effectiveSize > 0 && effectiveSize <= OCR_MAX_FILE_BYTES) {
          fullPdfBytes = await downloadFullPdf();

          // O PDF.js pode transferir/destacar o ArrayBuffer recebido. Mantemos
          // os bytes originais intactos porque eles ainda podem ser usados pelo
          // OCR nas poucas páginas realmente rasterizadas.
          const localPdf = await step("parse", () => openPdfBytes(fullPdfBytes!.slice()));
          try {
            if (localPdf.numPages !== pageCount) {
              throw new Error(
                `Contagem de páginas inconsistente: leitura remota ${pageCount}, leitura local ${localPdf.numPages}.`,
              );
            }
            resumeState = {
              ...resumeState,
              phase: "verifying_text",
              native_candidate_pages: nativeCandidates(),
              native_verified_pages: nativeVerified(),
              native_failed_pages: nativeFailed(),
            };
            await report("verifying_text", {
              pages: nativeCandidateSet.size,
              pages_done: nativeVerifiedSet.size,
              pages_total: nativeCandidateSet.size,
              percent: 20,
            });

            for (let start = 0; start < unverifiedNative.length; start += PAGE_WINDOW) {
              const pages = unverifiedNative.slice(start, start + PAGE_WINDOW);
              const blocks: DocBlock[] = [];
              for (const page of pages) {
                let info;
                try {
                  info = await readPdfPageInfoWithRetry(localPdf, page);
                } catch (error) {
                  throw new Error(
                    `native_text_verification_failed_page_${page}: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                  );
                }

                const mode = decidePdfPageReadMode(info);
                nativeFailedSet.delete(page);
                nativeVerifiedSet.add(page);
                if (mode === "ocr") {
                  weakPageSet.add(page);
                  continue;
                }

                weakPageSet.delete(page);
                if (mode === "native") {
                  for (const b of splitByHeadings(info.text.replace(/\r\n?/g, "\n").trim())) {
                    blocks.push({ ...b, page, kind: "text" });
                  }
                  if (plainAccum.length < 200_000) plainAccum += `${info.text}\n\n`;
                }
              }

              if (blocks.length > 0) textChunks += await embedAndInsert(blocks);
              resumeState = {
                ...resumeState,
                phase: "verifying_text",
                weak_pages: weakPages(),
                native_candidate_pages: nativeCandidates(),
                native_verified_pages: nativeVerified(),
                native_failed_pages: nativeFailed(),
              };
              await report("verifying_text", {
                pages: nativeCandidateSet.size,
                pages_done: nativeVerifiedSet.size,
                pages_total: nativeCandidateSet.size,
                percent:
                  20 +
                  Math.round((nativeVerifiedSet.size / Math.max(1, nativeCandidateSet.size)) * 10),
              });

              const stillUnverified = nativeCandidates().some(
                (page) => !nativeVerifiedSet.has(page),
              );
              if (params.deadlineAt && Date.now() > params.deadlineAt && stillUnverified) {
                incomplete = true;
                break;
              }
            }
          } finally {
            await localPdf.destroy().catch(() => {});
          }
        } else if (nativeFailedSet.size > 0) {
          throw new Error(
            `native_text_extraction_failed_pages_${nativeFailed().slice(0, 20).join("_")}`,
          );
        } else {
          // Em arquivo maior que o teto, páginas confirmadamente rasterizadas
          // serão sinalizadas como parciais; páginas vazias não gastam OCR.
          unverifiedNative.forEach((page) => nativeVerifiedSet.add(page));
        }
      }

      if (!incomplete) {
        const targetOcr = params.forceVision
          ? Array.from({ length: pageCount }, (_, i) => i + 1)
          : weakPages();
        if (targetOcr.length > 0) {
          // Sem tamanho conhecido, presume-se grande: melhor entregar o
          // documento parcial do que estourar a memória do servidor.
          if (effectiveSize <= 0 || effectiveSize > OCR_MAX_FILE_BYTES) {
            ocrSkippedPages = targetOcr;
          } else {
            try {
              await setStatus("ocr_processing");
              const completedOcr = new Set<number>(activeResume?.ocr_pages_done ?? []);
              const failedOcr = new Set<number>(ocrFailedPages);
              const remainingOcr = targetOcr.filter((page) => !completedOcr.has(page));
              const pages = remainingOcr.slice(0, OCR_PAGE_LIMIT);
              resumeState = {
                ...resumeState,
                phase: "ocr_processing",
                text_pages_done: pagesDone,
                pages_total: pageCount,
                weak_pages: weakPages(),
                ocr_pages_done: [...completedOcr].sort((a, b) => a - b),
                ocr_failed_pages: [...failedOcr].sort((a, b) => a - b),
                ocr_pages_total: targetOcr.length,
              };
              await report("ocr_processing", {
                pages: targetOcr.length,
                pages_done: completedOcr.size,
                pages_total: targetOcr.length,
                percent: 30 + Math.round((completedOcr.size / targetOcr.length) * 65),
              });

              if (pages.length === 0) {
                ocrFailedPages = [...failedOcr].sort((a, b) => a - b);
              } else {
                const bytes = fullPdfBytes ?? (await downloadFullPdf());

                const out = await ocrPdfPages({
                  bytes,
                  filename: doc.filename as string,
                  pages,
                  deadlineAt: params.deadlineAt,
                  onBatch: async (batch) => {
                    if (batch.blocks.length > 0) {
                      visionChunks += await embedAndInsert(batch.blocks);
                    }
                    for (const page of batch.pages) {
                      if (page.text.trim() && plainAccum.length < 200_000) {
                        plainAccum += `${page.text}\n\n`;
                      }
                    }
                    batch.completedPages.forEach((page) => completedOcr.add(page));
                    batch.failedPages.forEach((page) => failedOcr.add(page));
                    ocrPagesRun += batch.completedPages.length;
                    ocrFailedPages = [...failedOcr].sort((a, b) => a - b);
                    resumeState = {
                      ...resumeState,
                      phase: "ocr_processing",
                      ocr_pages_done: [...completedOcr].sort((a, b) => a - b),
                      ocr_failed_pages: ocrFailedPages,
                    };
                    await report("ocr_processing", {
                      pages: targetOcr.length,
                      pages_done: completedOcr.size,
                      pages_total: targetOcr.length,
                      percent: 30 + Math.round((completedOcr.size / targetOcr.length) * 65),
                    });
                  },
                });
                const stillPending = targetOcr.some((page) => !completedOcr.has(page));
                if (out.incomplete || stillPending) incomplete = true;
              }
            } catch (error) {
              if (error instanceof FileTooLargeForMemoryError) {
                ocrSkippedPages = targetOcr.filter(
                  (page) => !(activeResume?.ocr_pages_done ?? []).includes(page),
                );
              } else {
                throw error;
              }
            }
          }
        }
      }
    } else {
      // ---------- Formatos leves: leitura direta, com teto de tamanho ----------
      const { remoteFileSize } = await import("./pdf-range.server");
      const lightUrl = await step("download", async () => {
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.storage_path as string, 3600);
        if (error || !data?.signedUrl) throw new Error("Falha ao acessar o arquivo no storage");
        return data.signedUrl;
      });
      // Tamanho real, mesmo quando o cadastro está zerado.
      const lightSize = fileSize > 0 ? fileSize : await remoteFileSize(lightUrl).catch(() => 0);
      if (lightSize > DIRECT_DOWNLOAD_MAX_BYTES) {
        throw new FileTooLargeForMemoryError(
          `Arquivo grande demais para leitura direta (${Math.round(lightSize / 1024 / 1024)} MB). Converta para PDF ou divida o arquivo.`,
        );
      }
      const blob = await step("download", async () => {
        const res = await fetch(lightUrl);
        if (!res.ok) throw new Error("Falha ao baixar arquivo do storage");
        const buf = await res.arrayBuffer();
        if (buf.byteLength > DIRECT_DOWNLOAD_MAX_BYTES) {
          throw new FileTooLargeForMemoryError(
            "Arquivo grande demais para leitura direta. Converta para PDF ou divida o arquivo.",
          );
        }
        return new Blob([buf], { type: (doc.file_type as string) || "application/octet-stream" });
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

    if (!incomplete) {
      // Remove versões anteriores apenas quando a nova terminou. O run_id
      // sobrevive às retomadas e evita deixar chunks antigos misturados.
      const { data: existingChunks } = await supabase
        .from("document_chunks")
        .select("id, metadata")
        .eq("document_id", documentId);
      const staleIds = (existingChunks ?? [])
        .filter((chunk) => {
          const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
          return metadata.index_run_id !== resumeState.run_id;
        })
        .map((chunk) => chunk.id as string);
      for (let i = 0; i < staleIds.length; i += 200) {
        await supabase
          .from("document_chunks")
          .delete()
          .in("id", staleIds.slice(i, i + 200));
      }
    }

    const partialOcr = ocrFailedPages.length > 0;
    const status = incomplete
      ? resumeState.phase === "ocr_processing"
        ? "ocr_processing"
        : "extracting"
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
      ...(incomplete ? { resume_progress: resumeState } : {}),
      ...(ocrSkippedPages.length > 0 ? { ocr_skipped_pages: ocrSkippedPages } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(`error: ${msg.slice(0, 200)}`);
    throw err;
  }
}
