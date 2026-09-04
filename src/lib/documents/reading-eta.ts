/**
 * Descrição detalhada das etapas de leitura de um documento e estimativa de
 * tempo restante. Funções puras para poderem ser testadas sem servidor.
 */

export interface ReadingJobLike {
  status: "queued" | "running" | "done" | "error" | "paused";
  stage: string | null;
  pages: number | null;
  percent: number | null;
  queue_position: number | null;
  stalled: boolean;
  started_at?: string | null;
  step_attempt?: number | null;
  step_attempts?: number | null;
  step_warning?: string | null;
  /** Leitura em partes: páginas já lidas e total do arquivo. */
  pages_done?: number | null;
  pages_total?: number | null;
}

/** Verdadeiro quando o arquivo já teve parte lida e vai continuar de onde parou. */
export function isResuming(job: ReadingJobLike | undefined): boolean {
  return Boolean(job && job.status === "queued" && (job.pages_done ?? 0) > 0);
}

/** As cinco etapas visíveis ao usuário, na ordem em que acontecem. */
export const READING_STEPS = [
  { key: "fila", label: "Fila", description: "Aguardando a vez de ser lido." },
  {
    key: "leitura",
    label: "Leitura",
    description: "Extraindo o texto já digital das páginas.",
  },
  {
    key: "ocr",
    label: "OCR",
    description: "Reconhecendo o texto de páginas digitalizadas (imagens).",
  },
  {
    key: "trechos",
    label: "Trechos",
    description: "Dividindo o conteúdo em trechos com referência de página.",
  },
  {
    key: "busca",
    label: "Busca",
    description: "Preparando os trechos para consulta e citação pela JurisMind.",
  },
] as const;

export type ReadingStepKey = (typeof READING_STEPS)[number]["key"];

const STAGE_TO_STEP: Record<string, ReadingStepKey> = {
  queued: "fila",
  pending: "fila",
  download: "leitura",
  parse: "leitura",
  extracting_text: "leitura",
  text_extraction: "leitura",
  ocr: "ocr",
  ocr_processing: "ocr",
  chunking: "trechos",
  embedding: "busca",
  analyzing: "busca",
  done: "busca",
};

export function stepKeyFor(job: ReadingJobLike | undefined, status: string): ReadingStepKey | null {
  if (!job) return STAGE_TO_STEP[status] ?? null;
  // Arquivos grandes são lidos em partes: quando volta para a fila com páginas
  // já lidas, continua sendo a etapa de leitura, não "fila".
  if (job.status === "queued") return isResuming(job) ? "leitura" : "fila";
  return STAGE_TO_STEP[job.stage ?? status] ?? null;
}

/** Formata segundos em texto curto e humano ("cerca de 3 min"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "menos de 1 min";
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `cerca de ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `cerca de ${hours} h` : `cerca de ${hours} h ${rest} min`;
}

/**
 * Tempo restante estimado a partir do ritmo observado até agora.
 * Retorna null quando ainda não há dados suficientes para uma estimativa honesta.
 */
export function estimateRemainingSeconds(
  job: ReadingJobLike | undefined,
  now: number = Date.now(),
): number | null {
  if (!job || job.status !== "running" || job.stalled) return null;
  if (!job.started_at) return null;
  const started = new Date(job.started_at).getTime();
  if (!Number.isFinite(started)) return null;
  const elapsed = (now - started) / 1000;
  const percent = job.percent;
  if (typeof percent !== "number" || percent < 5 || percent >= 99) return null;
  if (elapsed < 20) return null;
  const total = (elapsed * 100) / percent;
  const remaining = total - elapsed;
  if (remaining <= 0) return null;
  return remaining;
}

export interface ReadingStageInfo {
  /** "Etapa 2 de 5 — Leitura" */
  title: string;
  /** Explicação completa do que está acontecendo agora. */
  description: string;
  /** "Restam cerca de 4 min" ou null. */
  eta: string | null;
  stepIndex: number | null;
}

/** Monta a descrição detalhada mostrada abaixo da barra de progresso. */
export function describeReadingStage(
  job: ReadingJobLike | undefined,
  status: string,
  now: number = Date.now(),
): ReadingStageInfo | null {
  const key = stepKeyFor(job, status);
  if (!key) return null;
  const index = READING_STEPS.findIndex((s) => s.key === key);
  const step = READING_STEPS[index]!;
  const resuming = isResuming(job);
  const parts: string[] = resuming
    ? [
        `${job!.pages_done} de ${job!.pages_total ?? "?"} página(s) já lidas. A leitura continua automaticamente de onde parou.`,
      ]
    : [step.description];

  if (job?.status === "queued" && !resuming) {
    if (job.queue_position && job.queue_position > 1) {
      parts.push(`Há ${job.queue_position - 1} documento(s) na frente deste.`);
    } else {
      parts.push("É o próximo a ser lido.");
    }
  }

  if (job?.status === "running") {
    if (key === "ocr" && job.pages) {
      parts.push(`${job.pages} página(s) em reconhecimento de imagem.`);
    } else if (job.pages) {
      parts.push(`${job.pages} página(s) neste documento.`);
    }
    if (job.stalled) parts.push('A leitura parou de responder — use "Processar agora".');
  }

  if (job?.step_attempt && job.step_attempt > 1) {
    parts.push(`Tentativa ${job.step_attempt} de ${job.step_attempts ?? 3}.`);
  }
  if (job?.step_warning) parts.push(job.step_warning);

  const seconds = estimateRemainingSeconds(job, now);
  return {
    title: `Etapa ${index + 1} de ${READING_STEPS.length} — ${step.label}`,
    description: parts.join(" "),
    eta: seconds === null ? null : `Restam ${formatDuration(seconds)}`,
    stepIndex: index,
  };
}
