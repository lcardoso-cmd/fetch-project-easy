import { describe, expect, it } from "vitest";
import {
  CRM_STAGES,
  findDuplicateLeads,
  formatCents,
  isClosedStage,
  isProposalOpenForResponse,
  moveWithinOrder,
  normalizeDigits,
  normalizeEmailValue,
  parseAmountToCents,
  summarizePipeline,
  validateStageChange,
} from "@/lib/crm-schema";

describe("normalização", () => {
  it("extrai apenas dígitos de documentos e telefones", () => {
    expect(normalizeDigits("123.456.789-00")).toBe("12345678900");
    expect(normalizeDigits("(11) 99999-0000")).toBe("11999990000");
    expect(normalizeDigits("   ")).toBeNull();
    expect(normalizeDigits(null)).toBeNull();
  });

  it("normaliza e-mail para minúsculas sem espaços", () => {
    expect(normalizeEmailValue("  Contato@Alfa.COM ")).toBe("contato@alfa.com");
    expect(normalizeEmailValue("")).toBeNull();
  });
});

describe("duplicidade de potenciais clientes", () => {
  const existing = [
    { id: "a", name: "Construtora Alfa", document_digits: "11222333000144", email_normalized: "contato@alfa.com", phone_digits: "11999990000" },
    { id: "b", name: "Beta Ltda", document_digits: null, email_normalized: "beta@beta.com", phone_digits: null },
  ];

  it("detecta por documento, e-mail e telefone", () => {
    const matches = findDuplicateLeads(
      { document: "11.222.333/0001-44", email: "beta@beta.com", phone: "(11) 99999-0000" },
      existing,
    );
    const byId = new Map(matches.map((m) => [m.id, m.reasons]));
    expect(byId.get("a")).toContain("document");
    expect(byId.get("a")).toContain("phone");
    expect(byId.get("b")).toContain("email");
  });

  it("ignora o próprio registro em edição", () => {
    const matches = findDuplicateLeads(
      { document: "11222333000144" },
      existing,
      "a",
    );
    expect(matches).toHaveLength(0);
  });

  it("não acusa duplicidade sem dados de contato", () => {
    expect(findDuplicateLeads({}, existing)).toHaveLength(0);
  });
});

describe("regras de mudança de etapa", () => {
  it("exige motivo ao marcar como perdida", () => {
    const res = validateStageChange({ toStage: "lost", conflictStatus: "cleared" });
    expect(res.ok).toBe(false);
  });

  it("aceita perda com motivo informado", () => {
    const res = validateStageChange({
      toStage: "lost",
      lostReason: "Preço acima do orçamento",
      conflictStatus: "cleared",
    });
    expect(res.ok).toBe(true);
  });

  it("bloqueia envio de proposta sem conflito liberado", () => {
    expect(validateStageChange({ toStage: "proposal_sent", conflictStatus: "pending" }).ok).toBe(
      false,
    );
    expect(validateStageChange({ toStage: "proposal_sent", conflictStatus: null }).ok).toBe(false);
    expect(
      validateStageChange({ toStage: "proposal_sent", conflictStatus: "cleared" }).ok,
    ).toBe(true);
  });

  it("permite ressalva apenas para quem tem permissão e registra auditoria", () => {
    const denied = validateStageChange({
      toStage: "proposal_sent",
      conflictStatus: "pending",
      overrideConflict: true,
      canOverride: false,
    });
    expect(denied.ok).toBe(false);

    // Conflito confirmado nunca é liberado por ressalva.
    expect(
      validateStageChange({
        toStage: "proposal_sent",
        conflictStatus: "conflict",
        overrideConflict: true,
        canOverride: true,
      }).ok,
    ).toBe(false);

    const allowed = validateStageChange({
      toStage: "proposal_sent",
      conflictStatus: "pending",
      overrideConflict: true,
      canOverride: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.ok && allowed.requiresAudit).toBe(true);
  });

  it("etapas iniciais não dependem do conflito", () => {
    expect(validateStageChange({ toStage: "new_contact", conflictStatus: null }).ok).toBe(true);
  });

  it("reconhece etapas encerradas", () => {
    expect(isClosedStage("won")).toBe(true);
    expect(isClosedStage("lost")).toBe(true);
    expect(isClosedStage("negotiation")).toBe(false);
  });
});

describe("ordenação do kanban comercial", () => {
  it("move o item para o índice solicitado preservando os demais", () => {
    expect(moveWithinOrder(["a", "b", "c", "d"], "d", 1)).toEqual(["a", "d", "b", "c"]);
    expect(moveWithinOrder(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("insere no fim quando o índice excede o tamanho", () => {
    expect(moveWithinOrder(["a", "b"], "z", 0)).toEqual(["z", "a", "b"]);
    expect(moveWithinOrder(["a", "b"], "b", 99)).toEqual(["a", "b"]);
  });
});

describe("valores em centavos", () => {
  it("converte texto em centavos", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("2500")).toBe(250000);
    expect(parseAmountToCents("")).toBe(0);
    expect(parseAmountToCents(null)).toBe(0);
  });

  it("formata em moeda brasileira", () => {
    expect(formatCents(123456)).toContain("1.234,56");
    expect(formatCents(0)).toContain("0,00");
  });
});

describe("resumo do pipeline", () => {
  it("consolida contagens, valores e conversão", () => {
    const summary = summarizePipeline([
      { stage: "qualification", estimated_value_cents: 100_000, next_activity_at: null },
      { stage: "proposal", estimated_value_cents: 300_000, next_activity_at: "2026-01-01" },
      { stage: "won", estimated_value_cents: 500_000 },
      { stage: "lost", estimated_value_cents: 200_000 },
    ]);
    expect(summary.open).toBe(2);
    expect(summary.won).toBe(1);
    expect(summary.lost).toBe(1);
    expect(summary.openValueCents).toBe(400_000);
    expect(summary.wonValueCents).toBe(500_000);
    expect(summary.conversionRate).toBeCloseTo(0.5);
    expect(summary.withoutNextActivity).toBe(1);
    expect(summary.byStage).toHaveLength(CRM_STAGES.length);
  });

  it("retorna conversão nula sem negócios encerrados", () => {
    expect(summarizePipeline([{ stage: "proposal", estimated_value_cents: 0 }]).conversionRate).toBeNull();
  });
});

describe("resposta pública da proposta", () => {
  it("só aceita resposta em propostas abertas e não expiradas", () => {
    expect(isProposalOpenForResponse("shared", null).ok).toBe(true);
    expect(isProposalOpenForResponse("accepted", null)).toEqual({ ok: false, reason: "final" });
    expect(isProposalOpenForResponse("declined", null).ok).toBe(false);
    expect(isProposalOpenForResponse("draft", null)).toEqual({ ok: false, reason: "not_shared" });
    expect(
      isProposalOpenForResponse("shared", "2020-01-01T00:00:00.000Z"),
    ).toEqual({ ok: false, reason: "expired" });
  });
});
