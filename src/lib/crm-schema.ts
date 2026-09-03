/**
 * Fonte única da verdade do módulo Comercial (CRM).
 *
 * Este arquivo é puro (sem acesso a banco) para poder ser usado tanto na
 * interface quanto nas Server Functions e nos testes automatizados.
 */

// ---------------------------------------------------------------- etapas

export const CRM_STAGES = [
  "new_contact",
  "qualifying",
  "conflict_check",
  "meeting_scheduled",
  "proposal_drafting",
  "proposal_sent",
  "negotiating",
  "won",
  "lost",
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  new_contact: "Novo contato",
  qualifying: "Em qualificação",
  conflict_check: "Verificação de conflito",
  meeting_scheduled: "Reunião agendada",
  proposal_drafting: "Proposta em elaboração",
  proposal_sent: "Proposta enviada",
  negotiating: "Em negociação",
  won: "Ganha",
  lost: "Perdida",
};

/** Etapas que encerram a oportunidade. */
export const CLOSED_STAGES: readonly CrmStage[] = ["won", "lost"];

export function isClosedStage(stage: string): boolean {
  return (CLOSED_STAGES as readonly string[]).includes(stage);
}

export const CRM_PRIORITIES = ["low", "medium", "high"] as const;
export type CrmPriority = (typeof CRM_PRIORITIES)[number];
export const CRM_PRIORITY_LABELS: Record<CrmPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

// -------------------------------------------------- potenciais clientes

export const LEAD_KINDS = ["person", "company"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];
export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  person: "Pessoa física",
  company: "Pessoa jurídica",
};

export const LEAD_STATUSES = ["lead", "client", "inactive"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  lead: "Potencial cliente",
  client: "Cliente",
  inactive: "Inativo",
};

// ------------------------------------------------------------ atividades

export const ACTIVITY_KINDS = [
  "note",
  "call",
  "meeting",
  "email",
  "task",
  "followup",
  "reminder",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: "Nota",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail registrado",
  task: "Tarefa",
  followup: "Acompanhamento",
  reminder: "Lembrete",
};

export const ACTIVITY_STATUSES = ["open", "done", "canceled"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  open: "Em aberto",
  done: "Concluída",
  canceled: "Cancelada",
};

// ------------------------------------------------ verificação de conflito

export const CONFLICT_STATUSES = [
  "pending",
  "in_review",
  "cleared",
  "conflict",
  "cleared_with_note",
] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];
export const CONFLICT_STATUS_LABELS: Record<ConflictStatus, string> = {
  pending: "Pendente",
  in_review: "Em análise",
  cleared: "Liberado",
  conflict: "Conflito identificado",
  cleared_with_note: "Liberado com ressalva",
};

/** Somente decisões humanas liberam o avanço para "Proposta enviada". */
export const CONFLICT_CLEARED: readonly ConflictStatus[] = [
  "cleared",
  "cleared_with_note",
];

// -------------------------------------------------------------- propostas

export const PROPOSAL_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "shared",
  "viewed",
  "negotiating",
  "accepted",
  "declined",
  "expired",
  "canceled",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada internamente",
  shared: "Compartilhada",
  viewed: "Visualizada",
  negotiating: "Em negociação",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};

/** Situações finais: não aceitam nova resposta do cliente. */
export const PROPOSAL_FINAL_STATUSES: readonly ProposalStatus[] = [
  "accepted",
  "declined",
  "canceled",
];

export function isProposalOpenForResponse(
  status: string,
  validUntil: string | null,
  now: Date = new Date(),
): { ok: boolean; reason?: "final" | "expired" | "not_shared" } {
  if ((PROPOSAL_FINAL_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, reason: "final" };
  }
  if (status === "expired") return { ok: false, reason: "expired" };
  if (validUntil && new Date(validUntil).getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (!["shared", "viewed", "negotiating"].includes(status)) {
    return { ok: false, reason: "not_shared" };
  }
  return { ok: true };
}

// ------------------------------------------------------------ normalização

export function normalizeDigits(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizeEmailValue(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export type DuplicateCandidate = {
  document?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type DuplicateRecord = {
  id: string;
  name: string;
  document_digits?: string | null;
  email_normalized?: string | null;
  phone_digits?: string | null;
};

export type DuplicateMatch = {
  id: string;
  name: string;
  reasons: ("document" | "email" | "phone")[];
};

/**
 * Detecção de possível duplicidade por CPF/CNPJ, e-mail e telefone
 * normalizados. Nunca bloqueia o cadastro: apenas informa o usuário.
 */
export function findDuplicateLeads(
  candidate: DuplicateCandidate,
  existing: readonly DuplicateRecord[],
  ignoreId?: string,
): DuplicateMatch[] {
  const doc = normalizeDigits(candidate.document);
  const email = normalizeEmailValue(candidate.email);
  const phone = normalizeDigits(candidate.phone);
  if (!doc && !email && !phone) return [];

  const matches: DuplicateMatch[] = [];
  for (const row of existing) {
    if (ignoreId && row.id === ignoreId) continue;
    const reasons: DuplicateMatch["reasons"] = [];
    if (doc && row.document_digits && row.document_digits === doc) reasons.push("document");
    if (email && row.email_normalized && row.email_normalized === email) reasons.push("email");
    if (phone && row.phone_digits && row.phone_digits === phone) reasons.push("phone");
    if (reasons.length > 0) matches.push({ id: row.id, name: row.name, reasons });
  }
  return matches;
}

export const DUPLICATE_REASON_LABELS: Record<DuplicateMatch["reasons"][number], string> = {
  document: "mesmo CPF/CNPJ",
  email: "mesmo e-mail",
  phone: "mesmo telefone",
};

// -------------------------------------------------------- regras de etapa

export type StageChangeInput = {
  toStage: string;
  lostReason?: string | null;
  conflictStatus?: string | null;
  /** Autorização expressa de administrador, registrada em auditoria. */
  overrideConflict?: boolean;
  canOverride?: boolean;
};

export type StageChangeResult =
  | { ok: true; requiresAudit: boolean }
  | { ok: false; message: string };

/**
 * Regras de movimentação no pipeline:
 * - "Perdida" exige motivo.
 * - "Proposta enviada" exige verificação de conflito decidida, salvo
 *   autorização expressa de administrador (registrada em auditoria).
 */
export function validateStageChange(input: StageChangeInput): StageChangeResult {
  if (!(CRM_STAGES as readonly string[]).includes(input.toStage)) {
    return { ok: false, message: "Etapa inválida." };
  }
  if (input.toStage === "lost" && !(input.lostReason ?? "").trim()) {
    return { ok: false, message: "Informe o motivo da perda para marcar como perdida." };
  }
  if (input.toStage === "proposal_sent") {
    const cleared = (CONFLICT_CLEARED as readonly string[]).includes(
      input.conflictStatus ?? "",
    );
    if (!cleared) {
      if (input.conflictStatus === "conflict") {
        return {
          ok: false,
          message:
            "A verificação de conflito identificou conflito. Reveja a análise antes de enviar a proposta.",
        };
      }
      if (input.overrideConflict && input.canOverride) {
        return { ok: true, requiresAudit: true };
      }
      return {
        ok: false,
        message:
          "Conclua a verificação de conflito antes de marcar a proposta como enviada.",
      };
    }
  }
  return { ok: true, requiresAudit: false };
}

// ----------------------------------------------------------- ordenação

/** Move um id para uma nova posição preservando a ordem dos demais. */
export function moveWithinOrder(
  ids: readonly string[],
  id: string,
  targetIndex: number,
): string[] {
  const rest = ids.filter((x) => x !== id);
  const index = Math.max(0, Math.min(targetIndex, rest.length));
  rest.splice(index, 0, id);
  return rest;
}

// -------------------------------------------------------------- dinheiro

/** Converte texto digitado ("R$ 12.500,50") em centavos. Nunca usa float. */
export function parseAmountToCents(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function formatCents(cents: number | null | undefined, currency = "BRL"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// ------------------------------------------------------------ indicadores

export type PipelineRow = {
  stage: string;
  estimated_value_cents: number;
  owner_user_id?: string | null;
  source?: string | null;
  practice_area?: string | null;
  next_activity_at?: string | null;
};

export type PipelineSummary = {
  open: number;
  won: number;
  lost: number;
  openValueCents: number;
  wonValueCents: number;
  conversionRate: number | null;
  withoutNextActivity: number;
  byStage: { stage: CrmStage; count: number; valueCents: number }[];
};

export function summarizePipeline(rows: readonly PipelineRow[]): PipelineSummary {
  const byStage = CRM_STAGES.map((stage) => ({
    stage,
    count: 0,
    valueCents: 0,
  }));
  let open = 0;
  let won = 0;
  let lost = 0;
  let openValueCents = 0;
  let wonValueCents = 0;
  let withoutNextActivity = 0;

  for (const row of rows) {
    const entry = byStage.find((s) => s.stage === row.stage);
    if (entry) {
      entry.count += 1;
      entry.valueCents += row.estimated_value_cents ?? 0;
    }
    if (row.stage === "won") {
      won += 1;
      wonValueCents += row.estimated_value_cents ?? 0;
    } else if (row.stage === "lost") {
      lost += 1;
    } else {
      open += 1;
      openValueCents += row.estimated_value_cents ?? 0;
      if (!row.next_activity_at) withoutNextActivity += 1;
    }
  }

  const closed = won + lost;
  return {
    open,
    won,
    lost,
    openValueCents,
    wonValueCents,
    conversionRate: closed > 0 ? won / closed : null,
    withoutNextActivity,
    byStage,
  };
}

/** Agrupa contagem e valor por um campo textual, ignorando vazios. */
export function groupBy(
  rows: readonly PipelineRow[],
  key: "owner_user_id" | "source" | "practice_area",
): { value: string; count: number; valueCents: number }[] {
  const map = new Map<string, { count: number; valueCents: number }>();
  for (const row of rows) {
    const raw = row[key];
    const value = raw && String(raw).trim() ? String(raw) : "__none__";
    const acc = map.get(value) ?? { count: 0, valueCents: 0 };
    acc.count += 1;
    acc.valueCents += row.estimated_value_cents ?? 0;
    map.set(value, acc);
  }
  return [...map.entries()]
    .map(([value, acc]) => ({ value, ...acc }))
    .sort((a, b) => b.count - a.count);
}
