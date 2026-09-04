// Server-only helper com a lógica de RAG + tool loop compartilhada entre
// o serverFn `askWithRag` (bloqueante) e o route SSE `/api/chat/stream`.
import type { ChatMessage, ToolDef } from "./ai.server";
import type { Candidate } from "./rag/retrieval";

export type Tier = "fast" | "balanced" | "max";

export const MODEL_MAP: Record<Tier, string> = {
  fast: "google/gemini-3-flash-preview",
  balanced: "google/gemini-2.5-flash",
  max: "google/gemini-2.5-pro",
};

export interface Citation {
  /** Identificador estável exposto ao modelo e à UI: F1, F2, ... */
  ref: string;
  chunk_id: string;
  document_id: string;
  filename: string;
  snippet: string;
  /** Procedência legível: "p. 3 · CLÁUSULA 5" ou "planilha Valores · linhas 2-41". */
  location: string | null;
  source_kind: string;
  /** Score interno de fusão — diagnóstico, NÃO é percentual de confiança. */
  score: number;
  vector_similarity: number | null;
  fts_rank: number | null;
  /** true = entrou apenas como contexto vizinho, não como evidência. */
  is_context: boolean;
}

export interface RetrievalLog {
  question_chars: number;
  queries_used: number;
  keywords_used: number;
  candidates: number;
  retrieved: number;
  neighbors: number;
  documents_touched: number;
  sufficiency: "sufficient" | "partial" | "no_evidence";
  top_similarity: number;
  reranker_used: boolean;
  reranker_reason: string | null;
  retrieval_version: string;
  chunking_versions: string[];
  model_tier: string;
  latency_ms: number;
}


export interface ToolStep {
  name: string;
  args_json: string;
  result_json: string;
}

interface PartyRow {
  role?: string | null;
  name?: string | null;
  document?: string | null;
  relation?: string | null;
}

export interface RagInput {
  case_id: string;
  question: string;
  selected_doc_ids?: string[];
  images?: string[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  model_tier?: Tier;
  thread_id?: string;
}

export interface RagRun {
  messages: ChatMessage[];
  tools: ToolDef[];
  executor: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Trechos entregues ao modelo (evidências + contexto vizinho). */
  citations: Citation[];
  sufficiency: "sufficient" | "partial" | "no_evidence";
  retrievalLog: RetrievalLog;
  tier: Tier;
  model: string;
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

export async function prepareRagRun(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  organizationId: string;
  data: RagInput;
}): Promise<RagRun> {
  const { supabase, userId, organizationId, data } = opts;
  const startedAt = Date.now();
  const { embedTexts, rewriteQuery, rerankChunksDetailed } = await import("./ai.server");
  const { locationLabel } = await import("./rag/chunking");
  const {
    rrfFuse,
    dedupeOverlapping,
    diversifyByDocument,
    assessSufficiency,
    neighborTargets,
    RETRIEVAL_VERSION,
  } = await import("./rag/retrieval");

  // Acesso: a RLS de `cases`/`documents` já cobre dono e membros autorizados
  // do caso (user_can_access_case), então não filtramos por user_id aqui.
  const { data: caseRow } = await supabase
    .from("cases")
    .select(
      "id, title, case_number, jurisdiction, case_type, matter_kind, client_name, description, summary, status, parties, represented_party",
    )
    .eq("id", data.case_id)
    .maybeSingle();

  if (!caseRow) {
    throw new Error("Caso não encontrado ou você não tem acesso a ele.");
  }

  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, filename, processing_status")
    .eq("case_id", data.case_id)
    .order("created_at", { ascending: false });

  const selectedSet =
    data.selected_doc_ids && data.selected_doc_ids.length > 0
      ? new Set(data.selected_doc_ids)
      : null;

  const activeDocs = (allDocs ?? []).filter(
    (d: { id: string; processing_status: string }) =>
      (d.processing_status === "ready" || d.processing_status.startsWith("partial")) &&
      (!selectedSet || selectedSet.has(d.id)),
  );

  const tier: Tier = data.model_tier ?? "fast";
  const useAdvancedRetrieval = tier !== "fast";

  let queries: string[] = [data.question];
  let keywords: string[] = [];
  if (useAdvancedRetrieval) {
    const rw = await rewriteQuery(data.question, 2);
    queries = Array.from(new Set([data.question, ...rw.queries])).slice(0, 4);
    keywords = rw.keywords.slice(0, 12);
  }
  const keywordText = keywords.join(" ").trim() || null;

  const embs = await embedTexts(queries);
  if (!embs || embs.length === 0) throw new Error("Falha ao gerar embedding");

  const activeDocIds = activeDocs.map((d: { id: string }) => d.id);
  const docFilter = activeDocIds.length > 0 ? activeDocIds : null;

  const lists: Candidate[][] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi]!;
    const emb = embs[qi];
    if (!emb) continue;
    const perQueryLimit = useAdvancedRetrieval ? 20 : 24;

    const { withStepRetry } = await import("./rag/step-retry");
    const hits = await withStepRetry("search", async () => {
      const { data: rpcData, error } = await supabase.rpc("hybrid_search_chunks_v2", {
        query_embedding: emb as unknown as string,
        query_text: q,
        filter_organization_id: organizationId,
        filter_case_id: data.case_id,
        keyword_text: keywordText,
        filter_doc_ids: docFilter,
        match_count: perQueryLimit,
      });
      if (error) throw new Error(error.message);
      return rpcData;
    });


    lists.push(((hits ?? []) as Candidate[]).map((r) => ({ ...r })));

  }

  const fused = rrfFuse(lists);
  const candidatesCount = fused.length;
  const evidence = diversifyByDocument(dedupeOverlapping(fused), 4);

  const maxEvidence = useAdvancedRetrieval ? 10 : 12;
  let primary: Candidate[] = evidence.slice(0, maxEvidence);

  // Contexto vizinho (chunk anterior/seguinte) das melhores evidências.
  let neighbors: Candidate[] = [];
  if (useAdvancedRetrieval && primary.length > 0) {
    const targets = neighborTargets(primary.slice(0, 6), 1);
    if (targets.length > 0) {
      const { data: nb } = await supabase.rpc("fetch_chunk_neighbors", {
        filter_organization_id: organizationId,
        filter_case_id: data.case_id,
        doc_ids: targets.map((t) => t.document_id),
        chunk_indexes: targets.map((t) => t.chunk_index),
      });
      const known = new Set(primary.map((p) => p.id));
      neighbors = ((nb ?? []) as Candidate[])
        .filter((r) => !known.has(r.id))
        .slice(0, 6)
        .map((r) => ({ ...r, vector_similarity: null, fts_rank: null }));
    }
  }

  const docIds = Array.from(
    new Set([...primary, ...neighbors].map((m) => m.document_id)),
  );
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename")
    .in("id", docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map(
    ((docs ?? []) as Array<{ id: string; filename: string }>).map((d) => [d.id, d.filename]),
  );

  const labelFor = (row: Candidate) => {
    const loc = locationLabel(row);
    const tag = row.source_kind === "vision" ? "visão/OCR" : null;
    return [nameById.get(row.document_id) ?? "documento", loc, tag].filter(Boolean).join(" · ");
  };

  // Reranking com procedência; fallback determinístico registrado em log.
  let rerankerUsed = false;
  let rerankerReason: string | null = null;
  if (useAdvancedRetrieval && primary.length + neighbors.length > 6) {
    const pool = [
      ...primary.map((r) => ({ row: r, isContext: false })),
      ...neighbors.map((r) => ({ row: r, isContext: true })),
    ];
    const out = await rerankChunksDetailed(
      data.question,
      pool.map((p) => ({
        id: p.row.id,
        content: p.row.content,
        label: labelFor(p.row),
        isContext: p.isContext,
      })),
      Math.min(12, pool.length),
    );
    rerankerUsed = out.modelUsed;
    rerankerReason = out.reason ?? null;
    const byId = new Map(pool.map((p) => [p.row.id, p]));
    const ordered = out.ids.map((id) => byId.get(id)).filter(Boolean) as typeof pool;
    primary = ordered.filter((p) => !p.isContext).map((p) => p.row);
    neighbors = ordered.filter((p) => p.isContext).map((p) => p.row);
  }

  const sufficiency = assessSufficiency(
    primary.map((p) => ({
      vector_similarity: p.vector_similarity ?? null,
      fts_rank: p.fts_rank ?? null,
    })),
  );

  const ordered: Array<{ row: Candidate; isContext: boolean }> = [
    ...primary.map((row) => ({ row, isContext: false })),
    ...neighbors.map((row) => ({ row, isContext: true })),
  ];

  const citations: Citation[] = ordered.map(({ row, isContext }, idx) => ({
    ref: `F${idx + 1}`,
    chunk_id: row.id,
    document_id: row.document_id,
    filename: nameById.get(row.document_id) ?? "documento",
    snippet: row.content.slice(0, 600),
    location: locationLabel(row),
    source_kind: row.source_kind,
    score: "score" in row ? Number((row as { score?: number }).score ?? 0) : 0,
    vector_similarity: row.vector_similarity ?? null,
    fts_rank: row.fts_rank ?? null,
    is_context: isContext,
  }));

  const contextBlock = citations.length
    ? citations
        .map(
          (c) =>
            `[${c.ref}] (${[c.filename, c.location, c.is_context ? "contexto vizinho" : "evidência"]
              .filter(Boolean)
              .join(" · ")})\n${ordered.find((o) => o.row.id === c.chunk_id)?.row.content ?? c.snippet}`,
        )
        .join("\n\n---\n\n")
    : "(Nenhum trecho relevante encontrado nos documentos indexados. Se a pergunta depender dos autos, avise o usuário e sugira selecionar/enviar mais documentos.)";

  const sufficiencyNote =
    sufficiency.state === "no_evidence"
      ? "SUFICIÊNCIA DOCUMENTAL: os trechos recuperados têm relação fraca com a pergunta. Diga isso explicitamente antes de qualquer análise e não apresente conclusão como se houvesse prova documental."
      : sufficiency.state === "partial"
        ? "SUFICIÊNCIA DOCUMENTAL: há indício documental, mas pouca corroboração. Registre essa limitação na resposta."
        : "SUFICIÊNCIA DOCUMENTAL: há corroboração em mais de um trecho.";

  const retrievalLog: RetrievalLog = {
    question_chars: data.question.length,
    queries_used: queries.length,
    keywords_used: keywords.length,
    candidates: candidatesCount,
    retrieved: citations.length,
    neighbors: neighbors.length,
    documents_touched: docIds.length,
    sufficiency: sufficiency.state,
    top_similarity: sufficiency.top_similarity,
    reranker_used: rerankerUsed,
    reranker_reason: rerankerReason,
    retrieval_version: RETRIEVAL_VERSION,
    chunking_versions: Array.from(
      new Set(
        ordered
          .map((o) => (o.row as { chunking_version?: string | null }).chunking_version ?? null)
          .filter((v): v is string => Boolean(v)),
      ),
    ),
    model_tier: tier,
    latency_ms: Date.now() - startedAt,
  };

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
      "Entrega conteúdo formatado pronto para baixar como PDF. Use SOMENTE quando o usuário pedir PDF explicitamente. Não chame junto com create_petition para o mesmo texto, pois o card de peça já permite download.",
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
                  content: { type: "array", items: { type: "string" } },
                },
                required: ["title", "content"],
              },
            },
          },
          required: ["title", "slides"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_jurisprudence",
        description:
          "Pesquisa jurisprudência em sites OFICIAIS de tribunais brasileiros (fonte EXTERNA aos autos). Use SOMENTE quando o usuário pedir jurisprudência, precedentes, súmulas ou pesquisa externa. Os resultados recebem referências [J1], [J2]... e nunca podem ser apresentados como prova dos autos.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Tese ou termos jurídicos a pesquisar, em português.",
            },
            courts: {
              type: "array",
              description:
                "Tribunais a consultar. Vazio = todos os suportados (STF, STJ, TST, TSE, TJSP, TJRJ, TJMG, TJRS, TJPR, TJDFT).",
              items: {
                type: "string",
                enum: [
                  "STF",
                  "STJ",
                  "TST",
                  "TSE",
                  "TJSP",
                  "TJRJ",
                  "TJMG",
                  "TJRS",
                  "TJPR",
                  "TJDFT",
                ],
              },
            },
            limit: { type: "number", description: "Máximo de resultados (1 a 15, padrão 8)." },
          },
          required: ["query"],
        },
      },
    },
  ];


  const parties = (caseRow.parties ?? []) as PartyRow[];
  const rep = caseRow.represented_party as PartyRow | null;

  const caseBlock = [
    `TÍTULO: ${caseRow.title}`,
    caseRow.case_number && `NÚMERO: ${caseRow.case_number}`,
    caseRow.jurisdiction && `JURISDIÇÃO: ${caseRow.jurisdiction}`,
    caseRow.case_type && `TIPO: ${caseRow.case_type}`,
    caseRow.matter_kind && `NATUREZA: ${caseRow.matter_kind}`,
    caseRow.client_name && `CLIENTE: ${caseRow.client_name}`,
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
      ? activeDocs
          .map((d: { filename: string }, i: number) => `[${i + 1}] ${d.filename}`)
          .join("\n")
      : "(nenhum documento selecionado)";

  const systemPrompt = `Você é o JurisMind, agente jurídico especializado em português brasileiro. Você atua EXCLUSIVAMENTE dentro do caso abaixo — nunca pergunte "qual caso", "qual cliente" ou "qual matéria": você JÁ ESTÁ dentro dele. Não invente fatos que não estejam no contexto ou nos documentos.

Data/hora atual: ${fmtDateTime()}.

=== SOBRE O CASO ===
${caseBlock}

=== DOCUMENTOS ATIVOS (marcados pelo usuário) ===
${docsBlock}

=== TRECHOS RECUPERADOS DOS DOCUMENTOS ===
${contextBlock}

${sufficiencyNote}

INSTRUÇÕES:
- Responda de forma direta, técnica e completa. Use Markdown quando ajudar a clareza (títulos, listas, negrito, tabelas).
- Cite a fonte NO MESMO PONTO da afirmação, usando exatamente o identificador entre colchetes exibido acima ([F1], [F2], ...). Nunca invente um identificador que não esteja na lista.
- Separe claramente o que é CONSTATAÇÃO DOCUMENTAL (o que o trecho diz) do que é ANÁLISE JURÍDICA sua (interpretação, tese, risco).
- Se os trechos se contradisserem, aponte a contradição e as fontes de cada lado.
- Se o acervo não sustentar a conclusão, diga o que falta (documento, período, página) em vez de completar com suposição.
- Trechos marcados como "contexto vizinho" servem para entender o entorno; não os apresente como prova isolada.
- Se o usuário enviar imagens, analise o que está visível (documento fotografado, print, foto de local, gráfico, assinatura) e leve em conta na resposta.
- QUANDO O USUÁRIO PEDIR UMA PEÇA (petição, contestação, parecer, laudo, contrato, notificação, alegações, contrarrazões, memoriais, quesitos), CHAME create_petition com o texto integral e finalizado. Não chame create_pdf para o mesmo conteúdo, a menos que o usuário peça PDF explicitamente. Não coloque placeholders "[…]" se você tem o dado.
- QUANDO PEDIR TABELA, PLANILHA, CÁLCULO, CRONOGRAMA, COMPARATIVO — chame create_table.
- QUANDO PEDIR APRESENTAÇÃO / SLIDES — chame create_presentation.
- QUANDO PEDIR JURISPRUDÊNCIA, PRECEDENTES, SÚMULAS OU PESQUISA EXTERNA — chame search_jurisprudence. Nunca cite precedente que não tenha vindo dessa ferramenta. Use [J1], [J2]... para jurisprudência externa e [F1], [F2]... para os documentos do caso; jamais misture as duas origens na mesma referência. Se a pesquisa estiver indisponível ou vazia, diga isso e não invente julgados.
- Ao redigir peça usando jurisprudência, separe explicitamente os fundamentos extraídos dos documentos do caso (com [F]) dos precedentes externos (com [J], indicando tribunal, número quando houver e link oficial para conferência).
- QUANDO IDENTIFICAR PRAZO OU AUDIÊNCIA — chame create_event.
- QUANDO PEDIR PARA REGISTRAR TAREFA / TO-DO — chame create_task.
- Após chamar uma tool que gera arquivo (petition/pdf/table/presentation), confirme em UMA frase curta que o arquivo está pronto — não repita o conteúdo em texto.`;

  const userContent: string | Array<Record<string, unknown>> =
    data.images && data.images.length > 0
      ? [
          { type: "text", text: data.question },
          ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : data.question;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  const executor = async (name: string, args: Record<string, unknown>) => {
    if (name === "create_event") {
      const ev = {
        organization_id: organizationId,
        created_by_user_id: userId,
        case_id: data.case_id,
        title: String(args.title ?? "Evento"),
        description: args.description ? String(args.description) : null,
        starts_at: String(args.starts_at),
        ends_at: args.ends_at ? String(args.ends_at) : null,
        event_type: String(args.event_type ?? "deadline"),
        all_day: Boolean(args.all_day ?? false),
      };
      const { data: row, error: e } = await supabase
        .from("events")
        .insert(ev)
        .select()
        .single();
      if (e) return { error: e.message };
      return { ok: true, event: row };
    }
    if (name === "create_task") {
      const t = {
        organization_id: organizationId,
        created_by_user_id: userId,
        case_id: data.case_id,
        title: String(args.title ?? "Tarefa"),
        description: args.description ? String(args.description) : null,
        priority: String(args.priority ?? "medium"),
        status: "pending",
        due_date: args.due_date ? String(args.due_date) : null,
      };
      const { data: row, error: e } = await supabase
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
      const { data: evs } = await supabase
        .from("events")
        .select("id, title, starts_at, event_type")
        .eq("organization_id", organizationId)
        .eq("case_id", data.case_id)
        .gte("starts_at", new Date().toISOString())
        .lte("starts_at", until)
        .order("starts_at", { ascending: true });
      return { events: evs ?? [] };
    }
    if (name === "list_case_tasks") {
      const { data: ts } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("organization_id", organizationId)
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
    if (name === "search_jurisprudence") {
      const { searchJurisprudence } = await import(
        "./jurisprudence/jurisprudence-search.server"
      );
      const courts = Array.isArray(args.courts) ? args.courts.map(String) : undefined;
      const result = await searchJurisprudence({
        query: String(args.query ?? ""),
        courts,
        limit: args.limit ? Number(args.limit) : undefined,
      });
      return { kind: "jurisprudence", ...result };
    }
    return { error: `Tool desconhecida: ${name}` };

  };

  return {
    messages,
    tools,
    executor,
    citations,
    sufficiency: sufficiency.state,
    retrievalLog,
    tier,
    model: MODEL_MAP[tier],
  };
}

export async function persistChatTurn(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  organizationId: string;
  threadId: string;
  question: string;
  images?: string[];
  tier: Tier;
  content: string;
  toolSteps: ToolStep[];
  citations: Citation[];
  inputKind?: "text" | "voice";
  audioPath?: string | null;
  audioDurationMs?: number | null;
}) {
  const {
    supabase,
    userId,
    organizationId,
    threadId,
    question,
    images,
    tier,
    content,
    toolSteps,
    citations,
    inputKind,
    audioPath,
    audioDurationMs,
  } = opts;
  try {
    await supabase.from("ai_chat_messages").insert([
      {
        thread_id: threadId,
        organization_id: organizationId,
        user_id: userId,
        role: "user",
        content: question,
        images: images ?? null,
        model_tier: tier,
        input_kind: inputKind ?? "text",
        audio_path: audioPath ?? null,
        audio_duration_ms: audioDurationMs ?? null,
      },
      {
        thread_id: threadId,
        organization_id: organizationId,
        user_id: userId,
        role: "assistant",
        content,
        tool_steps: toolSteps as unknown,
        citations: citations.map((c) => ({
          ref: c.ref,
          chunk_id: c.chunk_id,
          document_id: c.document_id,
          filename: c.filename,
          location: c.location,
          snippet: c.snippet.slice(0, 600),
          source_kind: c.source_kind,
          is_context: c.is_context,
        })) as unknown,
        model_tier: tier,
      },
    ]);
    const { data: th } = await supabase
      .from("ai_chat_threads")
      .select("title")
      .eq("id", threadId)
      .single();
    if (th && (th.title === "Nova conversa" || !th.title)) {
      const title = question.replace(/\s+/g, " ").trim().slice(0, 80);
      await supabase.from("ai_chat_threads").update({ title }).eq("id", threadId);
    }
  } catch {
    // silencioso
  }
}
