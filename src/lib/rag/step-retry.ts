/**
 * Retentativas automáticas por etapa (download, leitura, OCR, trechos, busca).
 *
 * Puro e testável: não conhece Supabase nem rede. Erros permanentes
 * (formato não suportado, crédito/permissão, conteúdo vazio) não são repetidos,
 * para não queimar tempo e custo em algo que nunca vai passar.
 */

export interface StepAttemptFailure {
  step: string;
  attempt: number;
  attempts: number;
  willRetry: boolean;
  delayMs: number;
  reason: string;
}

export interface StepRetryOptions {
  /** Número total de tentativas (inclui a primeira). */
  attempts?: number;
  /** Espera base entre tentativas, dobrada a cada falha. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  onAttemptFailed?: (info: StepAttemptFailure) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (error: unknown) => boolean;
}

const PERMANENT_PATTERNS = [
  "formato não suportado",
  "unsupported",
  "não encontrado",
  "not found",
  "nenhum conteúdo indexável",
  "payment required",
  "insufficient",
  "quota",
  "unauthorized",
  "forbidden",
  "permission denied",
  "cancelado",
  "cancelled",
  "402",
  "403",
  // Limite de memória do servidor: repetir consome tempo e falha igual.
  "memory limit",
  "exceeded before eof",
  "grande demais",
  "too large",
  "ocr_file_too_large",
];

export function errorReason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isRetryableError(error: unknown): boolean {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  if (name === "aborterror") return false;
  const msg = errorReason(error).toLowerCase();
  return !PERMANENT_PATTERNS.some((p) => msg.includes(p));
}

export function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const raw = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, maxDelayMs);
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Executa `fn`, repetindo em falhas transitórias e reportando o motivo. */
export async function withStepRetry<T>(
  step: string,
  fn: (attempt: number) => Promise<T>,
  options: StepRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 1500;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  const sleep = options.sleep ?? defaultSleep;
  const retryable = options.isRetryable ?? isRetryableError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && retryable(error);
      const delayMs = canRetry ? backoffDelay(attempt, baseDelayMs, maxDelayMs) : 0;
      await options.onAttemptFailed?.({
        step,
        attempt,
        attempts,
        willRetry: canRetry,
        delayMs,
        reason: errorReason(error),
      });
      if (!canRetry) break;
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  throw lastError;
}

/** Mensagem amigável exibida ao usuário quando uma etapa falhou e será repetida. */
export function describeStepFailure(info: StepAttemptFailure): string {
  const labels: Record<string, string> = {
    download: "baixar o arquivo",
    parse: "ler o documento",
    ocr: "ler as imagens (OCR)",
    chunking: "preparar os trechos",
    embedding: "indexar os trechos",
    insert: "salvar os trechos",
    search: "buscar nos documentos",
  };
  const what = labels[info.step] ?? info.step;
  const reason = info.reason.slice(0, 180);
  return info.willRetry
    ? `Falha ao ${what} (tentativa ${info.attempt} de ${info.attempts}): ${reason}. Tentando novamente…`
    : `Falha ao ${what} após ${info.attempt} tentativa(s): ${reason}`;
}
