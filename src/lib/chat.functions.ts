import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskSchema = z.object({
  case_id: z.string().uuid(),
  question: z.string().min(1).max(8000),
  selected_doc_ids: z.array(z.string().uuid()).optional(),
  images: z.array(z.string()).max(6).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
  model_tier: z.enum(["fast", "balanced", "max"]).optional(),
});

interface Citation {
  document_id: string;
  filename: string;
  snippet: string;
  similarity: number;
}

interface ToolStep {
  name: string;
  args_json: string;
  result_json: string;
}

const MODEL_MAP: Record<"fast" | "balanced" | "max", string> = {
  fast: "google/gemini-3-flash-preview",
  balanced: "google/gemini-2.5-flash",
  max: "google/gemini-2.5-pro",
};

interface PartyRow {
  role?: string | null;
  name?: string | null;
  document?: string | null;
  relation?: string | null;
}

function fmtDateTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function partiesBlock(parties: PartyRow[] | null | undefined) {
  if (!parties || parties.length === 0) return "";
  return parties
    .map((p) => {
      const bits = [p.role, p.name, p.document, p.relation].filter(Boolean);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");
}

export const askWithRag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts, chatWithTools } = await import("./ai.server");
    type ToolDef = import("./ai.server").ToolDef;

    // 0. Metadados do caso (contexto injetado no prompt)
    const { data: caseRow } = await context.supabase
      .from("cases")
      .select(
        "id, title, case_number, jurisdiction, case_type, matter_kind, client_name, client_document, description, summary, status, parties, represented_party",
      )
      .eq("id", data.case_id)
      .eq("user_id", context.userId)
      .single();

    if (!caseRow) {
      throw new Error("Caso não encontrado ou você não tem acesso a ele.");
    }

    // Documentos disponíveis (para o modelo saber sobre o que pode falar)
    const { data: allDocs } = await context.supabase
      .from("documents")
      .select("id, filename, processing_status")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    const selectedSet =
      data.selected_doc_ids && data.selected_doc_ids.length > 0
        ? new Set(data.selected_doc_ids)
        : null;

    const activeDocs = (allDocs ?? []).filter(
      (d) =>
        d.processing_status === "ready" &&
        (!selectedSet || selectedSet.has(d.id)),
    );

    // 1. Embedding + busca semântica JÁ FILTRADA no banco pelo caso e docs selecionados
    const [qEmb] = await embedTexts([data.question]);
    if (!qEmb) throw new Error("Falha ao gerar embedding");

    const activeDocIds = activeDocs.map((d) => d.id);
    const { data: matches, error } = await context.supabase.rpc(
      "match_chunks_scoped",
      {
        query_embedding: qEmb as unknown as string,
        filter_user_id: context.userId,
        filter_case_id: data.case_id,
        filter_doc_ids: activeDocIds.length > 0 ? activeDocIds : null,
        match_count: 24,
      },
    );
    if (error) throw error;

    const rows = (matches ?? []) as Array<{
      document_id: string;
      content: string;
      similarity: number;
    }>;

    const docIds = Array.from(new Set(rows.map((m) => m.document_id)));
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename")
      .in(
        "id",
        docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"],
      );
    const nameById = new Map((docs ?? []).map((d) => [d.id, d.filename]));

    const citations: Citation[] = rows.map((m) => ({
      document_id: m.document_id,
      filename: nameById.get(m.document_id) ?? "documento",
      snippet: m.content.slice(0, 400),
      similarity: m.similarity,
    }));

    const contextBlock = rows.length
      ? rows
          .map(
            (m, idx) =>
              `[${idx + 1}] (${nameById.get(m.document_id) ?? "doc"})\n${m.content}`,
          )
          .join("\n\n---\n\n")
      : "(Nenhum trecho relevante encontrado nos documentos indexados. Se a pergunta depender dos autos, avise o usuário e sugira selecionar/enviar mais documentos.)";

    // 2. Tools do agente — todas escopadas ao caso atual
    const tools: ToolDef[] = [
      {
        type: "function",
        function: {
          name: "create_event",
          description:
            "Cria um evento (prazo, audiência, reunião) na agenda, sempre vinculado ao caso atual.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              starts_at: {
                type: "string",
                description: "ISO 8601 (ex: 2026-07-15T14:00:00-03:00)",
              },
              ends_at: { type: "string" },
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
          name: "create_task",
          description:
            "Cria uma tarefa vinculada ao caso atual (checklist interno do escritório).",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"],
              },
              due_date: { type: "string", description: "ISO 8601" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_case_events",
          description: "Lista próximos eventos deste caso.",
          parameters: {
            type: "object",
            properties: {
              days: {
                type: "number",
                description: "Janela em dias a partir de hoje (default 60).",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_case_tasks",
          description: "Lista tarefas em aberto deste caso.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "create_petition",
          description:
            "Gera uma minuta editável em Word (petição, parecer, contestação, alegações, contrarrazões, laudo, notificação, contrato). Chame com o texto COMPLETO e finalizado; a UI mostrará um editor com botão de download.",
          parameters: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              conteudo: {
                type: "string",
                description:
                  "Texto completo da peça. Use HTML semântico simples (<h1>, <h2>, <p>, <ul>, <li>, <strong>) ou parágrafos separados por quebras de linha duplas. Nunca deixe placeholders '[…]' se você tem o dado no contexto.",
              },
            },
            required: ["titulo", "conteudo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_pdf",
          description:
            "Entrega o mesmo conteúdo formatado pronto para baixar como PDF. Use quando o usuário pedir explicitamente PDF, ou como complemento do create_petition.",
          parameters: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              conteudo: {
                type: "string",
                description: "HTML semântico ou texto simples.",
              },
            },
            required: ["titulo", "conteudo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_table",
          description:
            "Gera uma planilha (.xlsx). Use para valores, cronogramas, comparativos, quadros de partes/prazos etc.",
          parameters: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              rows: {
                type: "array",
                description:
                  "Linhas como objetos. As chaves de cada objeto viram colunas.",
                items: { type: "object" },
              },
            },
            required: ["titulo", "rows"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_presentation",
          description:
            "Cria uma apresentação PowerPoint (.pptx) — visão executiva, audiência, reunião com cliente.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              slides: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["title", "content"],
                },
              },
            },
            required: ["title", "slides"],
          },
        },
      },
    ];

    // 3. System prompt: identidade + metadados do caso + documentos + trechos
    const parties = (caseRow.parties ?? []) as PartyRow[];
    const rep = caseRow.represented_party as PartyRow | null;

    const caseBlock = [
      `TÍTULO: ${caseRow.title}`,
      caseRow.case_number && `NÚMERO: ${caseRow.case_number}`,
      caseRow.jurisdiction && `JURISDIÇÃO: ${caseRow.jurisdiction}`,
      caseRow.case_type && `TIPO: ${caseRow.case_type}`,
      caseRow.matter_kind && `NATUREZA: ${caseRow.matter_kind}`,
      caseRow.client_name && `CLIENTE: ${caseRow.client_name}${caseRow.client_document ? ` (${caseRow.client_document})` : ""}`,
      rep?.name && `PARTE REPRESENTADA: ${rep.name}${rep.role ? ` (${rep.role})` : ""}`,
      caseRow.status && `STATUS: ${caseRow.status}`,
      caseRow.description && `DESCRIÇÃO: ${caseRow.description}`,
      caseRow.summary && `RESUMO: ${caseRow.summary}`,
      parties.length > 0 && `PARTES ENVOLVIDAS:\n${partiesBlock(parties)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const docsBlock =
      activeDocs.length > 0
        ? activeDocs.map((d, i) => `[${i + 1}] ${d.filename}`).join("\n")
        : "(nenhum documento selecionado)";

    const systemPrompt = `Você é o JurisMind, agente jurídico especializado em português brasileiro. Você atua EXCLUSIVAMENTE dentro do caso abaixo — nunca pergunte "qual caso", "qual cliente" ou "qual matéria": você JÁ ESTÁ dentro dele. Não invente fatos que não estejam no contexto ou nos documentos.

Data/hora atual: ${fmtDateTime()}.

=== SOBRE O CASO ===
${caseBlock}

=== DOCUMENTOS ATIVOS (marcados pelo usuário) ===
${docsBlock}

=== TRECHOS RELEVANTES DOS DOCUMENTOS ===
${contextBlock}

INSTRUÇÕES:
- Responda de forma direta, técnica e completa. Use Markdown quando ajudar a clareza (títulos, listas, negrito, tabelas).
- Sempre que uma afirmação vier de um trecho, cite a fonte no formato [n] (o mesmo número entre colchetes acima).
- Se o contexto for insuficiente, diga claramente e sugira quais documentos podem faltar.
- Se o usuário enviar imagens, analise o que está visível (documento fotografado, print, foto de local, gráfico, assinatura) e leve em conta na resposta.
- QUANDO O USUÁRIO PEDIR UMA PEÇA (petição, contestação, parecer, laudo, contrato, notificação, alegações, contrarrazões, memoriais, quesitos), CHAME create_petition (e opcionalmente create_pdf) com o texto integral e finalizado. Não coloque placeholders "[…]" se você tem o dado.
- QUANDO PEDIR TABELA, PLANILHA, CÁLCULO, CRONOGRAMA, COMPARATIVO — chame create_table.
- QUANDO PEDIR APRESENTAÇÃO / SLIDES — chame create_presentation.
- QUANDO IDENTIFICAR PRAZO OU AUDIÊNCIA — chame create_event.
- QUANDO PEDIR PARA REGISTRAR TAREFA / TO-DO — chame create_task.
- Após chamar uma tool que gera arquivo (petition/pdf/table/presentation), confirme em UMA frase curta que o arquivo está pronto — não repita o conteúdo em texto.`;

    const userContent:
      | string
      | Array<Record<string, unknown>> =
      data.images && data.images.length > 0
        ? [
            { type: "text", text: data.question },
            ...data.images.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          ]
        : data.question;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: userContent },
    ];

    const executor = async (name: string, args: Record<string, unknown>) => {
      if (name === "create_event") {
        const ev = {
          user_id: context.userId,
          case_id: data.case_id,
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
      if (name === "create_task") {
        const t = {
          user_id: context.userId,
          case_id: data.case_id,
          title: String(args.title ?? "Tarefa"),
          description: args.description ? String(args.description) : null,
          priority: String(args.priority ?? "medium"),
          status: "pending",
          due_date: args.due_date ? String(args.due_date) : null,
        };
        const { data: row, error: e } = await context.supabase
          .from("tasks")
          .insert(t)
          .select()
          .single();
        if (e) return { error: e.message };
        return { ok: true, task: row };
      }
      if (name === "list_case_events") {
        const days = Number(args.days ?? 60);
        const until = new Date(Date.now() + days * 86400_000).toISOString();
        const { data: evs } = await context.supabase
          .from("events")
          .select("id, title, starts_at, event_type")
          .eq("user_id", context.userId)
          .eq("case_id", data.case_id)
          .gte("starts_at", new Date().toISOString())
          .lte("starts_at", until)
          .order("starts_at", { ascending: true });
        return { events: evs ?? [] };
      }
      if (name === "list_case_tasks") {
        const { data: ts } = await context.supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .eq("user_id", context.userId)
          .eq("case_id", data.case_id)
          .neq("status", "done")
          .order("created_at", { ascending: false });
        return { tasks: ts ?? [] };
      }
      if (name === "create_petition") {
        return {
          kind: "petition",
          titulo: String(args.titulo ?? "Petição"),
          conteudo: String(args.conteudo ?? ""),
        };
      }
      if (name === "create_pdf") {
        return {
          kind: "pdf",
          titulo: String(args.titulo ?? "Documento"),
          conteudo: String(args.conteudo ?? ""),
        };
      }
      if (name === "create_table") {
        return {
          kind: "table",
          titulo: String(args.titulo ?? "Tabela"),
          rows: Array.isArray(args.rows) ? args.rows : [],
        };
      }
      if (name === "create_presentation") {
        return {
          kind: "presentation",
          title: String(args.title ?? "Apresentação"),
          subtitle: args.subtitle ? String(args.subtitle) : undefined,
          slides: Array.isArray(args.slides) ? args.slides : [],
        };
      }
      return { error: `Tool desconhecida: ${name}` };
    };

    const tier = data.model_tier ?? "fast";
    const { content, steps } = await chatWithTools(messages, tools, executor, {
      model: MODEL_MAP[tier],
      temperature: 0.2,
      maxSteps: 6,
    });

    return {
      answer: content,
      citations,
      steps: steps.map((s) => ({
        name: s.name,
        args_json: JSON.stringify(s.args),
        result_json: JSON.stringify(s.result),
      })) as ToolStep[],
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
    const { content: rawSummary } = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é o JurisMind. Gere um resumo executivo em português do caso jurídico a partir dos trechos fornecidos. Estruture em quatro blocos com títulos em MAIÚSCULAS seguidos de dois-pontos: VISÃO GERAL, PARTES ENVOLVIDAS, PONTOS-CHAVE, PRÓXIMOS PASSOS. Use texto corrido em parágrafos curtos. NÃO use Markdown: nada de **negrito**, *itálico*, # títulos, listas com - ou *, nem blocos de código. Máximo 400 palavras.",
        },
        { role: "user", content: text.slice(0, 30_000) },
      ],
      { temperature: 0.3 },
    );

    const { stripMarkdown } = await import("./strip-markdown");
    const summary = stripMarkdown(rawSummary);

    await context.supabase
      .from("cases")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", data.case_id)
      .eq("user_id", context.userId);

    return { summary };
  });
