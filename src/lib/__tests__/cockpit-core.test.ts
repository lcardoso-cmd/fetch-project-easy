import { describe, expect, it } from "vitest";
import {
  buildPriorities,
  computeIndicators,
  isFailedDocument,
  isOverdueTask,
  normalizeTitle,
  rankCases,
  scopeDocuments,
  scopeEvents,
  scopeTasks,
  upcomingAgenda,
  type CoreCase,
  type CoreDocument,
  type CoreEvent,
  type CoreTask,
} from "@/lib/cockpit/cockpit-core";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function task(over: Partial<CoreTask> = {}): CoreTask {
  return {
    id: "t1",
    title: "Tarefa",
    status: "pending",
    priority: "medium",
    due_date: null,
    case_id: null,
    assigned_to_user_id: ME,
    created_by_user_id: ME,
    updated_at: NOW.toISOString(),
    ...over,
  };
}
function event(over: Partial<CoreEvent> = {}): CoreEvent {
  return {
    id: "e1",
    title: "Audiência",
    starts_at: NOW.toISOString(),
    event_type: "hearing",
    case_id: null,
    created_by_user_id: ME,
    ...over,
  };
}
function doc(over: Partial<CoreDocument> = {}): CoreDocument {
  return {
    id: "d1",
    filename: "peticao.pdf",
    processing_status: "ready",
    case_id: null,
    created_at: NOW.toISOString(),
    created_by_user_id: ME,
    ...over,
  };
}
function kase(over: Partial<CoreCase> = {}): CoreCase {
  return {
    id: "c1",
    title: "CASO EXEMPLO DE TESTE",
    client_name: "Cliente",
    status: "active",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    created_by_user_id: ME,
    ...over,
  };
}

describe("indicadores", () => {
  it("conta prazos de hoje, atrasos, abertas e falhas", () => {
    const tasks = [
      task({ id: "a", due_date: "2026-09-01T10:00:00.000Z" }), // atrasada
      task({ id: "b", due_date: "2026-09-04T18:00:00.000Z" }), // hoje
      task({ id: "c" }), // aberta sem prazo
      task({ id: "d", status: "done", due_date: "2026-09-01T10:00:00.000Z" }),
    ];
    const events = [event({ id: "e1" }), event({ id: "e2", starts_at: "2026-09-20T10:00:00.000Z" })];
    const docs = [doc({ id: "d1", processing_status: "error" }), doc({ id: "d2" })];

    const ind = computeIndicators({ tasks, events, documents: docs, now: NOW });
    expect(ind.overdueTasks).toBe(1);
    expect(ind.openTasks).toBe(3);
    expect(ind.deadlinesToday).toBe(2); // 1 evento hoje + 1 tarefa hoje
    expect(ind.failedDocuments).toBe(1);
  });

  it("reconhece tarefa atrasada e documento com falha", () => {
    expect(isOverdueTask(task({ due_date: "2026-09-01T00:00:00.000Z" }), NOW)).toBe(true);
    expect(isOverdueTask(task({ due_date: "2026-09-04T23:00:00.000Z" }), NOW)).toBe(false);
    expect(isFailedDocument(doc({ processing_status: "split_failed" }))).toBe(true);
    expect(isFailedDocument(doc())).toBe(false);
  });

  it("indicadores zerados quando não há dados", () => {
    expect(computeIndicators({ tasks: [], events: [], documents: [], now: NOW })).toEqual({
      deadlinesToday: 0,
      overdueTasks: 0,
      openTasks: 0,
      failedDocuments: 0,
    });
  });
});

describe("prioridades", () => {
  it("ordena atraso, falha e hoje antes do restante", () => {
    const items = buildPriorities({
      tasks: [
        task({ id: "hoje", title: "Hoje", due_date: "2026-09-04T20:00:00.000Z" }),
        task({ id: "atrasada", title: "Atrasada", due_date: "2026-09-01T10:00:00.000Z" }),
        task({ id: "futura", title: "Futura", due_date: "2026-09-08T10:00:00.000Z" }),
      ],
      events: [],
      documents: [doc({ id: "falha", filename: "falha.pdf", processing_status: "error" })],
      cases: [],
      memberNames: {},
      now: NOW,
    });
    expect(items.map((i) => i.title)).toEqual(["Atrasada", "falha.pdf", "Hoje", "Futura"]);
    expect(items[0].state).toBe("overdue");
    expect(items[1].state).toBe("failed");
  });

  it("inclui caso, cliente e responsável quando existem", () => {
    const items = buildPriorities({
      tasks: [task({ due_date: "2026-09-04T20:00:00.000Z", case_id: "c1" })],
      events: [],
      documents: [],
      cases: [kase()],
      memberNames: { [ME]: "Ana" },
      now: NOW,
    });
    expect(items[0].caseTitle).toBe("CASO EXEMPLO DE TESTE");
    expect(items[0].clientName).toBe("Cliente");
    expect(items[0].ownerName).toBe("Ana");
  });

  it("estado vazio quando nada é urgente", () => {
    const items = buildPriorities({
      tasks: [task({ priority: "low", due_date: "2026-12-01T10:00:00.000Z" })],
      events: [],
      documents: [doc()],
      cases: [],
      memberNames: {},
      now: NOW,
    });
    expect(items).toHaveLength(0);
  });
});

describe("escopo por usuário", () => {
  it("meu trabalho traz apenas itens do usuário", () => {
    const tasks = [task({ id: "m" }), task({ id: "o", assigned_to_user_id: OTHER })];
    expect(scopeTasks(tasks, "mine", ME).map((t) => t.id)).toEqual(["m"]);
    expect(scopeTasks(tasks, "org", ME)).toHaveLength(2);

    const events = [event({ id: "m" }), event({ id: "o", created_by_user_id: OTHER })];
    expect(scopeEvents(events, "mine", ME, new Set()).map((e) => e.id)).toEqual(["m"]);

    const docs = [doc({ id: "m" }), doc({ id: "o", created_by_user_id: OTHER })];
    expect(scopeDocuments(docs, "mine", ME, new Set()).map((d) => d.id)).toEqual(["m"]);
  });

  it("itens de casos acessíveis entram no meu trabalho", () => {
    const events = [event({ id: "x", created_by_user_id: OTHER, case_id: "c1" })];
    expect(scopeEvents(events, "mine", ME, new Set(["c1"]))).toHaveLength(1);
    expect(scopeEvents(events, "mine", ME, new Set(["c9"]))).toHaveLength(0);
  });
});

describe("casos por sinal operacional", () => {
  it("prioriza atraso, falha e prazo próximo", () => {
    const cases = [
      kase({ id: "calmo", title: "Calmo", updated_at: "2026-08-01T10:00:00.000Z" }),
      kase({ id: "falha", title: "Falha" }),
      kase({ id: "atrasado", title: "Atrasado" }),
    ];
    const ranked = rankCases({
      cases,
      tasks: [task({ id: "t", case_id: "atrasado", due_date: "2026-09-01T10:00:00.000Z" })],
      events: [],
      documents: [doc({ id: "d", case_id: "falha", processing_status: "error" })],
      memberNames: {},
      now: NOW,
    });
    expect(ranked.map((c) => c.id)).toEqual(["atrasado", "falha", "calmo"]);
    expect(ranked[0].overdueTasks).toBe(1);
    expect(ranked[1].failedDocuments).toBe(1);
  });

  it("ignora casos arquivados e respeita o limite", () => {
    const ranked = rankCases({
      cases: [kase({ id: "a" }), kase({ id: "b", status: "archived" })],
      tasks: [],
      events: [],
      documents: [],
      memberNames: {},
      now: NOW,
      limit: 5,
    });
    expect(ranked.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("agenda dos próximos 7 dias", () => {
  it("traz apenas a janela e em ordem cronológica", () => {
    const list = upcomingAgenda({
      events: [
        event({ id: "depois", starts_at: "2026-09-20T10:00:00.000Z" }),
        event({ id: "amanha", starts_at: "2026-09-05T09:00:00.000Z" }),
      ],
      tasks: [task({ id: "hoje", due_date: "2026-09-04T23:00:00.000Z" })],
      cases: [],
      now: NOW,
    });
    expect(list.map((i) => i.id)).toEqual(["task-hoje", "event-amanha"]);
  });
});

describe("normalização de títulos", () => {
  it("converte caixa alta em capitalização legível", () => {
    expect(normalizeTitle("CASO EXEMPLO DE TESTE")).toBe("Caso Exemplo De Teste");
    expect(normalizeTitle("Caso Silva vs. Souza")).toBe("Caso Silva vs. Souza");
  });
});
