// Tools de consulta direta ao banco (dados reais do caso), usadas pelo chat
// jurídico junto do RAG. Diferente dos trechos recuperados por similaridade,
// aqui o modelo consulta as tabelas de verdade: documentos, páginas completas,
// tarefas, prazos, publicações, propostas e outros casos da organização.
import type { ToolDef } from "./ai.server";

const MAX_TEXT_CHARS = 12_000;

export const DB_TOOL_NAMES = [
  "case_overview",
  "list_case_documents",
  "read_document_pages",
  "search_case_documents",
  "list_case_publications",
  "find_cases",
] as const;

export const dbToolDefs: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "case_overview",
      description:
        "Números REAIS do caso vindos do banco: quantidade de documentos e status de leitura, trechos indexados, tarefas abertas/atrasadas, próximos prazos, publicações e propostas. Use sempre que a pergunta envolver contagem, situação, pendência ou 'o que temos no caso'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_case_documents",
      description:
        "Lista todos os documentos do caso (inclusive partes de documentos divididos) com status real de leitura, número de páginas e de trechos indexados. Use para saber o que existe no acervo antes de afirmar que algo não consta.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document_pages",
      description:
        "Lê o TEXTO INTEGRAL indexado de um documento em um intervalo de páginas (numeração original do documento). Use quando precisar do conteúdo completo de uma seção, e não apenas do trecho recuperado.",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "string",
            description: "ID do documento (obtido em list_case_documents ou nas fontes).",
          },
          filename_contains: {
            type: "string",
            description: "Alternativa ao id: parte do nome do arquivo.",
          },
          page_from: { type: "number", description: "Página inicial (numeração original)." },
          page_to: { type: "number", description: "Página final (numeração original)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_case_documents",
      description:
        "Busca literal (termo exato) dentro do texto indexado dos documentos do caso: números de processo, CPF/CNPJ, valores, nomes, datas, cláusulas. Complementa a busca semântica quando o termo precisa ser exato.",
      parameters: {
        type: "object",
        properties: {
          term: { type: "string", description: "Termo literal a localizar." },
          limit: { type: "number", description: "Máximo de ocorrências (1 a 30, padrão 10)." },
        },
        required: ["term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_case_publications",
      description:
        "Lista publicações oficiais (diários da justiça) capturadas para este caso ou para o número do processo dele.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de publicações (padrão 10)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_cases",
      description:
        "Procura outros casos da organização por título, número do processo, cliente ou parte. Use para verificar histórico do mesmo cliente ou casos relacionados.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a procurar." },
          limit: { type: "number", description: "Máximo de casos (padrão 8)." },
        },
        required: ["query"],
      },
    },
  },
];

interface DocRow {
  id: string;
  filename: string;
  processing_status: string;
  page_count: number | null;
  page_offset: number;
  part_index: number | null;
  part_count: number | null;
  split_group_id: string | null;
  file_size: number | null;
  created_at: string;
}

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

export async function runDbTool(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  caseId: string;
  name: string;
  args: Record<string, unknown>;
}): Promise<unknown> {
  const { supabase, organizationId, caseId, name, args } = opts;
  const { baseDocumentName } = await import("./documents/naming");

  const fetchDocs = async (): Promise<DocRow[]> => {
    const { data } = await supabase
      .from("documents")
      .select(
        "id, filename, processing_status, page_count, page_offset, part_index, part_count, split_group_id, file_size, created_at",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    return (data ?? []) as DocRow[];
  };

  const chunkCounts = async (docIds: string[]) => {
    const counts = new Map<string, number>();
    if (docIds.length === 0) return counts;
    // Contagem por documento (head + count é barato e respeita a RLS)

    await Promise.all(
      docIds.map(async (id) => {
        const { count } = await supabase
          .from("document_chunks")
          .select("id", { count: "exact", head: true })
          .eq("document_id", id);
        counts.set(id, count ?? 0);
      }),
    );
    return counts;
  };

  if (name === "list_case_documents") {
    const docs = await fetchDocs();
    const counts = await chunkCounts(docs.map((d) => d.id));
    return {
      total: docs.length,
      documents: docs.map((d) => ({
        document_id: d.id,
        documento: baseDocumentName(d.filename),
        parte: d.part_index != null ? `${d.part_index}/${d.part_count ?? "?"}` : null,
        status_leitura: d.processing_status,
        paginas: d.page_count,
        primeira_pagina_original: d.page_offset + 1,
        trechos_indexados: counts.get(d.id) ?? 0,
        enviado_em: d.created_at,
      })),
    };
  }

  if (name === "case_overview") {
    const docs = await fetchDocs();
    const ready = docs.filter(
      (d) => d.processing_status === "ready" || d.processing_status.startsWith("partial"),
    );
    const failed = docs.filter((d) => d.processing_status === "failed");
    const pending = docs.filter((d) => !ready.includes(d) && !failed.includes(d));
    const nowIso = new Date().toISOString();
    const [{ count: chunks }, tasks, events, pubs, proposals] = await Promise.all([
      supabase
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("case_id", caseId),
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("organization_id", organizationId)
        .eq("case_id", caseId)
        .neq("status", "done"),
      supabase
        .from("events")
        .select("id, title, event_type, starts_at")
        .eq("organization_id", organizationId)
        .eq("case_id", caseId)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(10),
      supabase
        .from("publications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("case_id", caseId),
      supabase
        .from("proposals")
        .select("id, number, title, status, fixed_value_cents, currency, created_at")
        .eq("organization_id", organizationId)
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const taskRows = (tasks.data ?? []) as Array<{ due_date: string | null }>;
    const overdue = taskRows.filter(
      (t) => t.due_date && new Date(t.due_date).getTime() < Date.now(),
    ).length;
    return {
      documentos: {
        total: docs.length,
        legiveis: ready.length,
        em_processamento: pending.length,
        com_falha: failed.length,
        nomes_base: Array.from(new Set(docs.map((d) => baseDocumentName(d.filename)))),
      },
      trechos_indexados: chunks ?? 0,
      tarefas_abertas: taskRows.length,
      tarefas_atrasadas: overdue,
      proximos_compromissos: events.data ?? [],
      publicacoes_vinculadas: pubs.count ?? 0,
      propostas: proposals.data ?? [],
    };
  }

  if (name === "read_document_pages") {
    const docs = await fetchDocs();
    const wanted = args.document_id
      ? docs.filter((d) => d.id === String(args.document_id))
      : args.filename_contains
        ? docs.filter((d) =>
            d.filename.toLowerCase().includes(String(args.filename_contains).toLowerCase()),
          )
        : docs;
    if (wanted.length === 0) return { error: "Documento não encontrado neste caso." };
    const from = args.page_from != null ? num(args.page_from, 1, 1, 100_000) : null;
    const to = args.page_to != null ? num(args.page_to, from ?? 1, 1, 100_000) : null;

    const parts: Array<Record<string, unknown>> = [];
    let used = 0;
    for (const d of wanted.slice(0, 4)) {
      let q = supabase
        .from("document_chunks")
        .select("content, page_start, page_end, section_title, chunk_index, source_kind")
        .eq("document_id", d.id)
        .order("chunk_index", { ascending: true })
        .limit(60);
      if (from != null) q = q.gte("page_start", from);
      if (to != null) q = q.lte("page_start", to);
      const { data } = await q;
      const rows = (data ?? []) as Array<{
        content: string;
        page_start: number | null;
        section_title: string | null;
        source_kind: string;
      }>;
      const texto: string[] = [];
      for (const r of rows) {
        if (used >= MAX_TEXT_CHARS) break;
        const head = [r.page_start != null ? `p. ${r.page_start}` : null, r.section_title]
          .filter(Boolean)
          .join(" · ");
        const body = r.content.slice(0, Math.max(0, MAX_TEXT_CHARS - used));
        used += body.length;
        texto.push(head ? `[${head}]\n${body}` : body);
      }
      parts.push({
        document_id: d.id,
        documento: baseDocumentName(d.filename),
        parte: d.part_index,
        status_leitura: d.processing_status,
        paginas_retornadas: rows.length,
        texto: texto.join("\n\n"),
      });
      if (used >= MAX_TEXT_CHARS) break;
    }
    return { truncado: used >= MAX_TEXT_CHARS, documentos: parts };
  }

  if (name === "search_case_documents") {
    const term = String(args.term ?? "").trim();
    if (!term) return { error: "Informe o termo a localizar." };
    const limit = num(args.limit, 10, 1, 30);
    const docs = await fetchDocs();
    const byId = new Map(docs.map((d) => [d.id, d]));
    const { data, error } = await supabase
      .from("document_chunks")
      .select("document_id, content, page_start, section_title")
      .eq("case_id", caseId)
      .ilike("content", `%${term.replace(/[%_]/g, "")}%`)
      .limit(limit);
    if (error) return { error: error.message };
    const rows = (data ?? []) as Array<{
      document_id: string;
      content: string;
      page_start: number | null;
      section_title: string | null;
    }>;
    return {
      termo: term,
      ocorrencias: rows.length,
      resultados: rows.map((r) => {
        const d = byId.get(r.document_id);
        const i = r.content.toLowerCase().indexOf(term.toLowerCase());
        const start = Math.max(0, i - 200);
        return {
          document_id: r.document_id,
          documento: d ? baseDocumentName(d.filename) : "documento",
          parte: d?.part_index ?? null,
          pagina: r.page_start,
          secao: r.section_title,
          trecho: r.content.slice(start, start + 600),
        };
      }),
    };
  }

  if (name === "list_case_publications") {
    const limit = num(args.limit, 10, 1, 25);
    const { data: caseRow } = await supabase
      .from("cases")
      .select("case_number")
      .eq("id", caseId)
      .maybeSingle();
    const cnj = (caseRow?.case_number ?? "").replace(/\D/g, "");
    const { data } = await supabase
      .from("publications")
      .select(
        "id, source, tribunal, orgao, publication_date, captured_at, cnj, snippet, url_original, status, case_id",
      )
      .eq("organization_id", organizationId)
      .order("captured_at", { ascending: false })
      .limit(80);
    const rows = (data ?? []) as Array<{ case_id: string | null; cnj: string | null }>;
    const filtered = rows
      .filter(
        (r) => r.case_id === caseId || (cnj && (r.cnj ?? "").replace(/\D/g, "") === cnj),
      )
      .slice(0, limit);
    return { total: filtered.length, publicacoes: filtered };
  }

  if (name === "find_cases") {
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "Informe o texto a procurar." };
    const limit = num(args.limit, 8, 1, 20);
    const safe = query.replace(/[%_,]/g, " ").trim();
    const { data, error } = await supabase
      .from("cases")
      .select(
        "id, title, case_number, client_name, assisted_party_name, status, case_type, jurisdiction, created_at",
      )
      .eq("organization_id", organizationId)
      .or(
        [
          `title.ilike.%${safe}%`,
          `case_number.ilike.%${safe}%`,
          `client_name.ilike.%${safe}%`,
          `assisted_party_name.ilike.%${safe}%`,
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { error: error.message };
    return { total: (data ?? []).length, casos: data ?? [] };
  }

  return { error: `Tool de banco desconhecida: ${name}` };
}
