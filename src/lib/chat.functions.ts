import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskSchema = z.object({
  case_id: z.string().uuid().optional(),
  question: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

interface Citation {
  document_id: string;
  filename: string;
  snippet: string;
  similarity: number;
}

interface ToolStep {
  name: string;
  args: unknown;
  result: unknown;
}

export const askWithRag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts, chatWithTools } = await import("./ai.server");
    type ToolDef = import("./ai.server").ToolDef;

    // 1. Embedding da pergunta + busca semântica
    const [qEmb] = await embedTexts([data.question]);
    if (!qEmb) throw new Error("Falha ao gerar embedding");

    const { data: matches, error } = await context.supabase.rpc("match_chunks", {
      query_embedding: qEmb as unknown as string,
      match_count: 8,
      filter_user_id: context.userId,
    });
    if (error) throw error;

    const filtered = (matches ?? []).filter(
      (m: { case_id: string }) => !data.case_id || m.case_id === data.case_id,
    );

    const docIds = Array.from(new Set(filtered.map((m: { document_id: string }) => m.document_id)));
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename")
      .in("id", docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((docs ?? []).map((d) => [d.id, d.filename]));

    const citations: Citation[] = filtered.map(
      (m: { document_id: string; content: string; similarity: number }) => ({
        document_id: m.document_id,
        filename: nameById.get(m.document_id) ?? "documento",
        snippet: m.content.slice(0, 400),
        similarity: m.similarity,
      }),
    );

    const contextBlock = filtered.length
      ? filtered
          .map(
            (m: { content: string; document_id: string }, idx: number) =>
              `[${idx + 1}] (${nameById.get(m.document_id) ?? "doc"})\n${m.content}`,
          )
          .join("\n\n---\n\n")
      : "(Nenhum trecho relevante encontrado nos documentos indexados.)";

    // 2. Tools disponíveis para o modelo
    const tools: (typeof ToolDef extends never ? never : import("./ai.server").ToolDef)[] = [
      {
        type: "function",
        function: {
          name: "create_event",
          description:
            "Cria um evento na agenda do(a) advogado(a) (prazo, audiência, reunião). Use quando o usuário pedir agendar algo ou quando identificar prazo nos documentos.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Título curto do evento" },
              description: { type: "string" },
              starts_at: {
                type: "string",
                description: "Data/hora ISO 8601 (ex: 2026-07-15T14:00:00-03:00)",
              },
              ends_at: { type: "string", description: "Opcional, ISO 8601" },
              event_type: {
                type: "string",
                enum: ["deadline", "hearing", "meeting", "task"],
              },
              all_day: { type: "boolean" },
            },
            required: ["title", "starts_at", "event_type"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_cases",
          description: "Lista os casos do(a) advogado(a) (id, título, cliente, status).",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "list_upcoming_events",
          description: "Lista próximos eventos/prazos a partir de hoje.",
          parameters: {
            type: "object",
            properties: { days: { type: "number", description: "Janela em dias (default 30)" } },
          },
        },
      },
    ];

    const systemPrompt = `Você é o JurisMind, assistente jurídico em português brasileiro.
Use EXCLUSIVAMENTE o contexto fornecido para responder à pergunta. Cite as fontes ao final no formato [n] indicando o número entre colchetes do trecho.
Se o contexto for insuficiente, diga claramente.
Você possui ferramentas: use-as quando o usuário pedir ação concreta (criar prazo, consultar agenda, listar casos).

CONTEXTO DOS DOCUMENTOS:
${contextBlock}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: data.question },
    ];

    const executor = async (name: string, args: Record<string, unknown>) => {
      if (name === "create_event") {
        const ev = {
          user_id: context.userId,
          case_id: data.case_id ?? null,
          title: String(args.title ?? "Evento"),
          description: args.description ? String(args.description) : null,
          starts_at: String(args.starts_at),
          ends_at: args.ends_at ? String(args.ends_at) : null,
          event_type: String(args.event_type ?? "deadline"),
          all_day: Boolean(args.all_day ?? false),
        };
        const { data: row, error: e } = await context.supabase
          .from("events")
          .insert(ev)
          .select()
          .single();
        if (e) return { error: e.message };
        return { ok: true, event: row };
      }
      if (name === "list_cases") {
        const { data: cs } = await context.supabase
          .from("cases")
          .select("id, title, client_name, status")
          .eq("user_id", context.userId)
          .order("updated_at", { ascending: false })
          .limit(50);
        return { cases: cs ?? [] };
      }
      if (name === "list_upcoming_events") {
        const days = Number(args.days ?? 30);
        const until = new Date(Date.now() + days * 86400_000).toISOString();
        const { data: evs } = await context.supabase
          .from("events")
          .select("id, title, starts_at, event_type, case_id")
          .eq("user_id", context.userId)
          .gte("starts_at", new Date().toISOString())
          .lte("starts_at", until)
          .order("starts_at", { ascending: true });
        return { events: evs ?? [] };
      }
      return { error: `Tool desconhecida: ${name}` };
    };

    const { content, steps } = await chatWithTools(messages, tools, executor, {
      temperature: 0.2,
    });

    return {
      answer: content,
      citations,
      steps: steps as ToolStep[],
    };
  });

export const summarizeCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");

    const { data: chunks } = await context.supabase
      .from("document_chunks")
      .select("content")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .limit(40);

    if (!chunks || chunks.length === 0) {
      throw new Error("Nenhum documento indexado para este caso.");
    }

    const text = chunks.map((c) => c.content).join("\n\n");
    const { content: summary } = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é o JurisMind. Gere um resumo executivo em português do caso jurídico a partir dos trechos fornecidos. Estruture em: (1) Visão geral, (2) Partes envolvidas, (3) Pontos-chave, (4) Próximos passos sugeridos. Máximo 400 palavras.",
        },
        { role: "user", content: text.slice(0, 30_000) },
      ],
      { temperature: 0.3 },
    );

    await context.supabase
      .from("cases")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", data.case_id)
      .eq("user_id", context.userId);

    return { summary };
  });
