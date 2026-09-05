/**
 * Lógica pura da análise de documentos do fluxo "Novo caso".
 * Sem acesso a rede/banco — testável isoladamente.
 */

export const INTAKE_TEXT_PAGE_LIMIT = 20;
export const INTAKE_OCR_PAGE_LIMIT = 20;
/** Caracteres de contexto enviados ao modelo (≈ 20 páginas densas). */
export const INTAKE_MODEL_CHAR_BUDGET = 60_000;
/** Mínimo de caracteres por página para considerar que há camada de texto. */
export const INTAKE_MIN_CHARS_PER_PAGE = 120;
/**
 * Acima deste tamanho não é possível recortar páginas do PDF para
 * reconhecimento de imagem dentro do runtime — o recorte exige o arquivo
 * inteiro em memória. Nesses casos pedimos um trecho menor ao usuário.
 */
export const INTAKE_OCR_MAX_FILE_BYTES = 48 * 1024 * 1024;

export type IntakeStatus =
  | "uploaded"
  | "queued"
  | "extracting_text"
  | "ocr_processing"
  | "analyzing"
  | "ready"
  | "partial"
  | "error"
  | "converted"
  | "cancelled";

export const INTAKE_ACTIVE_STATUSES: IntakeStatus[] = [
  "queued",
  "extracting_text",
  "ocr_processing",
  "analyzing",
];

export function isIntakeActive(status: string): boolean {
  return (INTAKE_ACTIVE_STATUSES as string[]).includes(status);
}

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  uploaded: "Arquivo enviado",
  queued: "Na fila de análise",
  extracting_text: "Lendo o texto do documento",
  ocr_processing: "Reconhecendo texto das imagens",
  analyzing: "Identificando os dados do caso",
  ready: "Dados identificados",
  partial: "Dados identificados parcialmente",
  error: "Não foi possível analisar",
  converted: "Anexado ao caso",
  cancelled: "Cancelado",
};

export const INTAKE_STATUS_PROGRESS: Record<IntakeStatus, number> = {
  uploaded: 5,
  queued: 10,
  extracting_text: 35,
  ocr_processing: 60,
  analyzing: 85,
  ready: 100,
  partial: 100,
  error: 100,
  converted: 100,
  cancelled: 100,
};

export type IntakeErrorCode =
  | "unsupported_format"
  | "file_missing"
  | "encrypted_pdf"
  | "native_text_failed"
  | "no_text_layer"
  | "ocr_file_too_large"
  | "ocr_failed"
  | "model_unavailable"
  | "model_quota"
  | "model_rate_limited"
  | "timeout"
  | "unknown";

export interface ClassifiedIntakeError {
  code: IntakeErrorCode;
  /** Mensagem exibida ao usuário, sem jargão técnico. */
  message: string;
  /** Se falso, novas tentativas automáticas não ajudam. */
  retryable: boolean;
}

export function classifyIntakeError(err: unknown): ClassifiedIntakeError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();

  if (m.includes("formato não suportado") || m.includes("unsupportedformat")) {
    return {
      code: "unsupported_format",
      message: "Este tipo de arquivo não pode ser lido. Envie PDF, DOCX, XLSX, CSV, TXT ou imagem.",
      retryable: false,
    };
  }
  if (
    m.includes("object not found") ||
    m.includes("não encontrado no storage") ||
    m.includes("file_missing")
  ) {
    return {
      code: "file_missing",
      message: "O arquivo enviado não foi encontrado. Envie o documento novamente.",
      retryable: false,
    };
  }
  if (m.includes("password") || m.includes("encrypted")) {
    return {
      code: "encrypted_pdf",
      message: "O PDF está protegido por senha. Envie uma versão sem proteção.",
      retryable: false,
    };
  }
  if (m.includes("ocr_file_too_large")) {
    return {
      code: "ocr_file_too_large",
      message:
        "Este PDF é digitalizado e grande demais para o reconhecimento de imagem. Envie apenas as primeiras páginas (capa, qualificação das partes e pedido) em um arquivo menor.",
      retryable: false,
    };
  }
  if (m.includes("no_text_layer")) {
    return {
      code: "no_text_layer",
      message:
        "Não encontramos texto neste documento, nem por reconhecimento de imagem. Preencha os campos manualmente — o arquivo continua anexado.",
      retryable: false,
    };
  }
  if (m.includes("native_text_extraction_failed")) {
    return {
      code: "native_text_failed",
      message:
        "A leitura da camada textual do PDF falhou. O sistema não acionou OCR automaticamente para evitar custo e perda de qualidade; tente novamente.",
      retryable: true,
    };
  }
  if (m.includes("ocr") && m.includes("falh")) {
    return {
      code: "ocr_failed",
      message: "O reconhecimento de imagem falhou. Tente novamente em alguns instantes.",
      retryable: true,
    };
  }
  if (m.includes("402") || m.includes("créditos") || m.includes("credits")) {
    return {
      code: "model_quota",
      message:
        "A análise automática está indisponível por falta de créditos de IA. Avise o responsável pela conta.",
      retryable: false,
    };
  }
  if (m.includes("403") || m.includes("401")) {
    return {
      code: "model_unavailable",
      message:
        "A análise automática está bloqueada nesta conta. Fale com o responsável pela conta.",
      retryable: false,
    };
  }
  if (m.includes("429") || m.includes("rate limit")) {
    return {
      code: "model_rate_limited",
      message: "Muitas análises ao mesmo tempo. Vamos tentar novamente em instantes.",
      retryable: true,
    };
  }
  if (m.includes("timeout") || m.includes("abort")) {
    return {
      code: "timeout",
      message: "A leitura do documento demorou demais. Tente novamente ou envie um arquivo menor.",
      retryable: true,
    };
  }
  return {
    code: "unknown",
    message: `Não foi possível analisar o documento. ${raw.slice(0, 160)}`.trim(),
    retryable: true,
  };
}

/** Páginas a analisar: sempre as primeiras, onde ficam capa, partes e pedido. */
export function pagesToAnalyze(pageCount: number, limit = INTAKE_TEXT_PAGE_LIMIT): number[] {
  const total = Math.max(0, Math.min(pageCount, limit));
  return Array.from({ length: total }, (_, i) => i + 1);
}

/** Páginas sem texto suficiente — candidatas a reconhecimento de imagem. */
export function weakPages(pageTexts: string[], minChars = INTAKE_MIN_CHARS_PER_PAGE): number[] {
  const out: number[] = [];
  pageTexts.forEach((t, i) => {
    if ((t ?? "").replace(/\s+/g, "").length < minChars) out.push(i + 1);
  });
  return out;
}

/**
 * Monta o contexto enviado ao modelo respeitando o orçamento de caracteres,
 * preservando a ordem das páginas e marcando a origem de cada trecho.
 */
export function buildAnalysisContext(
  pageTexts: string[],
  budget = INTAKE_MODEL_CHAR_BUDGET,
): { text: string; pagesUsed: number[] } {
  const pagesUsed: number[] = [];
  const parts: string[] = [];
  let used = 0;
  for (let i = 0; i < pageTexts.length; i++) {
    const clean = (pageTexts[i] ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (!clean) continue;
    const header = `--- Página ${i + 1} ---\n`;
    const remaining = budget - used - header.length;
    if (remaining <= 200) break;
    const body = clean.length > remaining ? `${clean.slice(0, remaining)}…` : clean;
    parts.push(header + body);
    used += header.length + body.length;
    pagesUsed.push(i + 1);
  }
  return { text: parts.join("\n\n"), pagesUsed };
}

export function canOcrFile(fileSize: number): boolean {
  return fileSize > 0 && fileSize <= INTAKE_OCR_MAX_FILE_BYTES;
}

/** Extrai o primeiro JSON válido de uma resposta do modelo. */
export function parseModelJson<T = Record<string, unknown>>(raw: string): Partial<T> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as Partial<T>;
  } catch {
    return {};
  }
}

export const INTAKE_REQUIRED_FIELDS = [
  "client_name",
  "case_number",
  "jurisdiction",
  "case_type",
  "parties",
  "description",
] as const;

export type IntakeField = (typeof INTAKE_REQUIRED_FIELDS)[number];

export function missingFieldsFrom(extracted: {
  client_name?: string | null;
  case_number?: string | null;
  jurisdiction?: string | null;
  case_type?: string | null;
  parties?: Array<{ name?: string | null }> | null;
  description?: string | null;
}): IntakeField[] {
  const missing: IntakeField[] = [];
  if (!extracted.client_name) missing.push("client_name");
  if (!extracted.case_number) missing.push("case_number");
  if (!extracted.jurisdiction) missing.push("jurisdiction");
  if (!extracted.case_type) missing.push("case_type");
  if (!(extracted.parties ?? []).some((p) => (p?.name ?? "").trim())) missing.push("parties");
  if (!extracted.description) missing.push("description");
  return missing;
}

/** Caminho do Storage precisa pertencer à organização ativa. */
export function storagePathBelongsToOrg(path: string, organizationId: string): boolean {
  return (
    typeof path === "string" &&
    path.startsWith(`${organizationId}/`) &&
    !path.includes("..") &&
    !path.startsWith("/")
  );
}
