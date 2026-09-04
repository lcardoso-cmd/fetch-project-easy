/**
 * Processamento durável do documento enviado no fluxo "Novo caso".
 *
 * Executa fora do ciclo de vida da tela: a fila entrega o registro, este
 * módulo atualiza status/heartbeat no banco e grava o resultado. Fechar a
 * página não interrompe nem perde o trabalho.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INTAKE_MODEL_CHAR_BUDGET,
  INTAKE_OCR_PAGE_LIMIT,
  INTAKE_TEXT_PAGE_LIMIT,
  buildAnalysisContext,
  canOcrFile,
  classifyIntakeError,
  missingFieldsFrom,
  parseModelJson,
  weakPages,
} from "./intake-core";

export interface IntakeRow {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  storage_path: string;
  filename: string;
  file_type: string;
  file_size: number;
  attempt_count: number;
  max_attempts: number;
}

export interface IntakeWarning {
  field: string | null;
  message: string;
}

export interface IntakeExtraction {
  title: string;
  client_name: string | null;
  case_number: string | null;
  jurisdiction: string | null;
  case_type: string | null;
  parties: Array<{ role: string; name: string }>;
  description: string;
}

const CNJ_REGEX = /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/;

export const CASE_TYPES = [
  "Cível",
  "Trabalhista",
  "Empresarial",
  "Consumidor",
  "Família",
  "Tributário",
  "Administrativo",
  "Previdenciário",
  "Criminal",
  "Imobiliário",
  "Contratual",
  "Outro",
];

function cleanString(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /^(n\/?a|não\s*identif|desconhec|none|null|-+)$/i.test(s)) return null;
  return s.slice(0, max);
}

function normalizeCaseNumber(v: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function normalizeCaseType(v: unknown): string | null {
  const s = cleanString(v, 60);
  if (!s) return null;
  const hit = CASE_TYPES.find((t) => t.toLowerCase() === s.toLowerCase());
  return hit ?? s;
}

/** Atualiza status + heartbeat para que a fila saiba que o trabalho vive. */
async function touch(
  admin: SupabaseClient,
  id: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  await admin
    .from("case_intake_documents")
    .update({ heartbeat_at: new Date().toISOString(), ...patch })
    .eq("id", id);
}

interface ExtractedText {
  pageTexts: string[];
  pageCount: number;
  pagesRead: number;
  usedOcr: boolean;
  ocrPages: number[];
  failedPages: number[];
  mode: "text" | "ocr" | "mixed" | "plain";
}

async function signedUrlFor(
  admin: SupabaseClient,
  storagePath: string,
  seconds = 900,
): Promise<string> {
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(storagePath, seconds);
  if (error || !data?.signedUrl) throw new Error("file_missing");
  return data.signedUrl;
}

/** Lê o texto do documento respeitando limites de páginas e de memória. */
async function extractText(
  admin: SupabaseClient,
  row: IntakeRow,
  opts: { forceOcr: boolean },
): Promise<ExtractedText> {
  const isPdf =
    row.file_type === "application/pdf" || row.filename.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    // Formatos leves (DOCX/XLSX/CSV/TXT/imagem) usam os leitores existentes.
    const { data: blob, error } = await admin.storage.from("documents").download(row.storage_path);
    if (error || !blob) throw new Error("file_missing");
    const { parseDocument } = await import("../rag/parsers.server");
    const parsed = await parseDocument({
      blob,
      filename: row.filename,
      fileType: row.file_type,
    });
    let text = parsed.plainText;
    let usedOcr = false;
    if (parsed.format === "image" || text.replace(/\s+/g, "").length < 40) {
      const { ocrImage } = await import("../rag/ocr.server");
      const blocks = await ocrImage({
        blob,
        filename: row.filename,
        fileType: row.file_type,
      });
      const ocrText = blocks.map((b) => b.content).join("\n\n").trim();
      if (ocrText.length > text.length) {
        text = ocrText;
        usedOcr = true;
      }
    }
    return {
      pageTexts: [text],
      pageCount: Math.max(1, parsed.pageCount || 1),
      pagesRead: 1,
      usedOcr,
      ocrPages: usedOcr ? [1] : [],
      failedPages: [],
      mode: usedOcr ? "ocr" : "plain",
    };
  }

  // PDF: leitura por faixas de bytes, só as primeiras páginas.
  const url = await signedUrlFor(admin, row.storage_path);
  const { readRemotePdfPages, RangeNotSupportedError } = await import("../rag/pdf-range.server");

  let read: Awaited<ReturnType<typeof readRemotePdfPages>>;
  try {
    read = await readRemotePdfPages({
      url,
      pageLimit: INTAKE_TEXT_PAGE_LIMIT,
      knownLength: row.file_size || undefined,
      onPage: async (page, total) => {
        if (page % 5 === 0 || page === total) {
          await touch(admin, row.id, { pages_analyzed: page });
        }
      },
    });
  } catch (err) {
    if (err instanceof RangeNotSupportedError) {
      // Fallback só para arquivos que caibam em memória com segurança.
      if (!canOcrFile(row.file_size)) throw new Error("ocr_file_too_large");
      const { data: blob, error } = await admin.storage
        .from("documents")
        .download(row.storage_path);
      if (error || !blob) throw new Error("file_missing");
      const { parseDocument } = await import("../rag/parsers.server");
      const parsed = await parseDocument({
        blob,
        filename: row.filename,
        fileType: row.file_type,
      });
      read = {
        pageTexts: parsed.plainText.split(/\n{2,}/),
        pageCount: parsed.pageCount,
        pagesRead: Math.min(parsed.pageCount, INTAKE_TEXT_PAGE_LIMIT),
        failedPages: [],
        bytesFetched: row.file_size,
      };
    } else {
      throw err;
    }
  }

  const weak = weakPages(read.pageTexts);
  const needsOcr = opts.forceOcr || weak.length === read.pageTexts.length;
  let pageTexts = read.pageTexts;
  let ocrPages: number[] = [];
  let ocrFailed: number[] = [];

  if (needsOcr) {
    if (!canOcrFile(row.file_size)) throw new Error("ocr_file_too_large");
    await touch(admin, row.id, { status: "ocr_processing" });
    const target = (opts.forceOcr
      ? Array.from({ length: read.pagesRead }, (_, i) => i + 1)
      : weak
    ).slice(0, INTAKE_OCR_PAGE_LIMIT);

    const { data: blob, error } = await admin.storage.from("documents").download(row.storage_path);
    if (error || !blob) throw new Error("file_missing");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { ocrPdfPages } = await import("../rag/ocr.server");
    const out = await ocrPdfPages({ bytes, filename: row.filename, pages: target, batchSize: 4 });
    ocrFailed = out.failedPages;
    const byPage = new Map(out.pages.map((p) => [p.page, p.text]));
    pageTexts = pageTexts.map((t, i) => {
      const ocr = byPage.get(i + 1);
      if (ocr && ocr.trim().length > (t ?? "").trim().length) {
        ocrPages.push(i + 1);
        return ocr;
      }
      return t;
    });
    // OCR pode ter lido páginas além do texto lido (ex.: PDF só de imagens).
    for (const p of target) {
      if (p > pageTexts.length) {
        pageTexts[p - 1] = byPage.get(p) ?? "";
        ocrPages.push(p);
      }
    }
    ocrPages = [...new Set(ocrPages)].sort((a, b) => a - b);
  }

  const totalChars = pageTexts.join("").replace(/\s+/g, "").length;
  if (totalChars < 60) throw new Error("no_text_layer");

  return {
    pageTexts,
    pageCount: read.pageCount,
    pagesRead: read.pagesRead,
    usedOcr: ocrPages.length > 0,
    ocrPages,
    failedPages: [...read.failedPages, ...ocrFailed],
    mode: ocrPages.length === 0 ? "text" : ocrPages.length >= pageTexts.length ? "ocr" : "mixed",
  };
}

/** Pergunta ao modelo os dados do caso e normaliza o resultado. */
async function analyze(
  context: string,
  filename: string,
): Promise<{ extracted: IntakeExtraction; warnings: IntakeWarning[] }> {
  const { chatComplete } = await import("../ai.server");

  const system =
    "Você é um assistente jurídico brasileiro especialista em ler petições, contratos e processos judiciais. Extraia APENAS o que estiver explícito no documento. Quando um campo não estiver claramente identificado, devolva null — NUNCA invente nomes, números, varas ou tipos. Responda apenas com JSON válido, sem markdown.";

  const userMsg = `Analise o documento abaixo e devolva JSON com EXATAMENTE estas chaves:
{
  "title": string,            // título curto e descritivo (máx 120 chars)
  "client_name": string|null, // cliente principal (autor/requerente/contratante)
  "case_number": string|null, // número CNJ no formato NNNNNNN-DD.AAAA.J.TR.OOOO
  "jurisdiction": string|null,// vara/tribunal/comarca completos
  "case_type": string|null,   // UM destes: ${CASE_TYPES.join(", ")}
  "parties": [{"role": string, "name": string}],
  "description": string       // resumo objetivo em até 3 frases
}

Documento: ${filename}

${context}`;

  const raw = await chatComplete({
    system,
    messages: [{ role: "user", content: userMsg }],
    feature: "case_intake_extraction",
  });

  const parsed = parseModelJson<IntakeExtraction>(typeof raw === "string" ? raw : String(raw));
  const cnjFromText = context.match(CNJ_REGEX)?.[0] ?? null;
  const normalizedNumber =
    normalizeCaseNumber(cleanString(parsed.case_number, 60)) ?? normalizeCaseNumber(cnjFromText);

  const extracted: IntakeExtraction = {
    title: (cleanString(parsed.title, 200) ?? filename.replace(/\.[^.]+$/, "")).slice(0, 200),
    client_name: cleanString(parsed.client_name, 200),
    case_number: normalizedNumber,
    jurisdiction: cleanString(parsed.jurisdiction, 200),
    case_type: normalizeCaseType(parsed.case_type),
    parties: Array.isArray(parsed.parties)
      ? parsed.parties
          .filter((p): p is { role: string; name: string } => !!p && typeof p === "object")
          .map((p) => ({
            role: cleanString(p.role, 80) ?? "parte",
            name: cleanString(p.name, 200) ?? "",
          }))
          .filter((p) => p.name)
      : [],
    description: cleanString(parsed.description, 4000) ?? "",
  };

  const warnings: IntakeWarning[] = [];
  if (parsed.case_number && !normalizedNumber) {
    warnings.push({
      field: "case_number",
      message: `O número "${String(parsed.case_number).slice(0, 40)}" não está no padrão CNJ (20 dígitos). Confira antes de criar o caso.`,
    });
  }
  if (cnjFromText && normalizedNumber && normalizeCaseNumber(cnjFromText) !== normalizedNumber) {
    warnings.push({
      field: "case_number",
      message: `Encontramos outro número no texto (${cnjFromText}). Confira qual é o correto.`,
    });
  }

  return { extracted, warnings };
}

export interface IntakeOutcome {
  status: "ready" | "partial" | "error";
  extracted?: IntakeExtraction;
  missing?: string[];
  warnings?: IntakeWarning[];
  error_code?: string;
  error_message?: string;
}

/**
 * Executa a análise completa de um registro de intake já reservado pela fila.
 * Nunca lança: grava o desfecho no próprio registro e o devolve.
 */
export async function processIntakeDocument(
  admin: SupabaseClient,
  row: IntakeRow,
  opts: { forceOcr?: boolean } = {},
): Promise<IntakeOutcome> {
  try {
    await touch(admin, row.id, { status: "extracting_text" });
    const text = await extractText(admin, row, { forceOcr: opts.forceOcr === true });

    await touch(admin, row.id, {
      status: "analyzing",
      pages_total: text.pageCount,
      pages_analyzed: text.pagesRead,
      extraction_mode: text.mode,
      ocr_pages: text.ocrPages,
      failed_pages: text.failedPages,
    });

    const { text: contextText, pagesUsed } = buildAnalysisContext(
      text.pageTexts,
      INTAKE_MODEL_CHAR_BUDGET,
    );
    const { extracted, warnings } = await analyze(contextText, row.filename);

    const missing = missingFieldsFrom(extracted);
    const allWarnings = [...warnings];
    if (text.usedOcr) {
      allWarnings.push({
        field: null,
        message:
          "Parte do documento não tinha texto pesquisável e foi lida por reconhecimento de imagem. Confira os dados antes de criar o caso.",
      });
    }
    if (text.pageCount > text.pagesRead) {
      allWarnings.push({
        field: null,
        message: `Analisamos as primeiras ${text.pagesRead} de ${text.pageCount} páginas. O arquivo completo fica anexado e é indexado por inteiro depois que o caso é criado.`,
      });
    }
    if (text.failedPages.length > 0) {
      allWarnings.push({
        field: null,
        message: `Não conseguimos ler as páginas ${text.failedPages.slice(0, 10).join(", ")}.`,
      });
    }
    if (pagesUsed.length < text.pagesRead) {
      allWarnings.push({
        field: null,
        message: `O conteúdo analisado foi limitado às páginas ${pagesUsed[0] ?? 1} a ${pagesUsed[pagesUsed.length - 1] ?? 1}.`,
      });
    }

    const status = missing.length > 0 || text.failedPages.length > 0 ? "partial" : "ready";

    await admin
      .from("case_intake_documents")
      .update({
        status,
        extracted_data: extracted as unknown as Record<string, unknown>,
        missing_fields: missing,
        warnings: allWarnings as unknown as Record<string, unknown>[],
        pages_total: text.pageCount,
        pages_analyzed: text.pagesRead,
        extraction_mode: text.mode,
        ocr_pages: text.ocrPages,
        failed_pages: text.failedPages,
        finished_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        locked_by: null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", row.id);

    return { status, extracted, missing, warnings: allWarnings };
  } catch (err) {
    const classified = classifyIntakeError(err);
    const exhausted = row.attempt_count >= row.max_attempts || !classified.retryable;
    await admin
      .from("case_intake_documents")
      .update({
        status: exhausted ? "error" : "queued",
        last_error_code: classified.code,
        last_error_message: classified.message,
        heartbeat_at: new Date().toISOString(),
        locked_by: null,
        finished_at: exhausted ? new Date().toISOString() : null,
        // Erro definitivo não deve consumir novas tentativas automáticas.
        attempt_count: classified.retryable ? row.attempt_count : row.max_attempts,
      })
      .eq("id", row.id);
    console.error("[intake] falha", {
      intake_id: row.id,
      organization_id: row.organization_id,
      code: classified.code,
      attempt: row.attempt_count,
    });
    return { status: "error", error_code: classified.code, error_message: classified.message };
  }
}
