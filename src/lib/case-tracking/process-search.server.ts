import { createHash } from "crypto";
import { fetchFromDJEN } from "@/lib/publications/sources/djen";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_DOCS = "https://datajud-wiki.cnj.jus.br/api-publica/";

const STATE_COURTS: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce",
  "07": "df", "08": "es", "09": "go", "10": "ma", "11": "mt", "12": "ms",
  "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
  "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc",
  "25": "se", "26": "sp", "27": "to",
};

type DataJudMovement = {
  codigo?: number;
  dataHora?: string;
  nome?: string;
  complementosTabelados?: Array<{ nome?: string; descricao?: string; valor?: unknown }>;
  orgaoJulgador?: { codigo?: string | number; nome?: string };
};

type DataJudCase = {
  numeroProcesso?: string;
  tribunal?: string;
  grau?: string;
  dataAjuizamento?: string;
  classe?: { codigo?: number; nome?: string };
  assuntos?: Array<{ codigo?: number; nome?: string }>;
  orgaoJulgador?: { codigo?: string | number; nome?: string };
  movimentos?: DataJudMovement[];
};

export type ProcessConsultationResult = {
  kind: "process_consultation";
  ok: boolean;
  consultation_id?: string;
  proposal_id?: string;
  proposal_status?: "pending" | "applied" | "rejected";
  cnj: string;
  consulted_at: string;
  court?: string | null;
  degree?: string | null;
  class_name?: string | null;
  subjects?: string[];
  filed_at?: string | null;
  unit_name?: string | null;
  movements: Array<{
    date: string | null;
    name: string;
    complement: string | null;
    source: "datajud" | "djen";
    source_url: string | null;
  }>;
  total_movements: number;
  changes: Array<{ field: string; label: string; current: string | null; proposed: string }>;
  sources: Array<{ name: string; url: string; status: "ok" | "unavailable"; detail?: string }>;
  warnings: string[];
  error?: string;
};

export function normalizeCnjExact(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 20 ? digits : null;
}

export function formatCnj(digits: string): string {
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function dataJudAlias(cnj: string): string | null {
  const branch = cnj.slice(13, 14);
  const court = cnj.slice(14, 16);
  if (branch === "8") {
    const state = STATE_COURTS[court];
    return state ? `api_publica_tj${state}` : null;
  }
  if (branch === "5") return `api_publica_trt${Number(court)}`;
  if (branch === "4") return `api_publica_trf${Number(court)}`;
  return null;
}

function movementComplement(movement: DataJudMovement): string | null {
  const values = (movement.complementosTabelados ?? [])
    .map((item) => item.nome ?? item.descricao ?? (item.valor == null ? "" : String(item.valor)))
    .filter(Boolean);
  return values.length > 0 ? values.join(" · ").slice(0, 2000) : null;
}

function stableHash(parts: Array<string | number | null | undefined>): string {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

function safeError(value: unknown): string {
  if (!(value instanceof Error)) return "Fonte temporariamente indisponível.";
  return value.name === "AbortError" ? "Tempo limite excedido." : value.message.slice(0, 240);
}

export async function consultProcess(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  userId: string;
  caseId: string;
  threadId?: string | null;
  requestedCnj?: string | null;
}): Promise<ProcessConsultationResult> {
  const { supabase, organizationId, userId, caseId, threadId } = opts;
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, case_number, jurisdiction")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) throw caseError;
  if (!caseRow) throw new Error("Caso não encontrado ou sem acesso.");

  const cnj = normalizeCnjExact(opts.requestedCnj ?? caseRow.case_number ?? "");
  if (!cnj) throw new Error("Informe um número CNJ válido com 20 dígitos.");
  const alias = dataJudAlias(cnj);
  if (!alias) throw new Error("Este ramo do Judiciário ainda não está disponível nesta consulta.");

  const consultedAt = new Date().toISOString();
  const { data: consultation, error: consultationError } = await supabase
    .from("process_consultations")
    .insert({
      organization_id: organizationId,
      case_id: caseId,
      requested_by_user_id: userId,
      thread_id: threadId ?? null,
      cnj,
      status: "running",
    })
    .select("id")
    .single();
  if (consultationError || !consultation) {
    throw new Error(consultationError?.message ?? "Não foi possível registrar a consulta.");
  }

  const apiKey = process.env['DATAJUD_API_KEY'];
  const sources: ProcessConsultationResult["sources"] = [];
  const warnings: string[] = [
    "A Base Nacional pode ter defasagem e processos sigilosos podem não aparecer.",
    "Publicações do DJEN complementam a consulta, mas não representam o andamento completo.",
  ];

  try {
    if (!apiKey) throw new Error("Chave pública do DataJud não configurada.");
    const [dataJudResponse, djen] = await Promise.all([
      fetch(`${DATAJUD_BASE}/${alias}/_search`, {
        method: "POST",
        headers: { Authorization: `APIKey ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { match: { numeroProcesso: cnj } },
          _source: ["numeroProcesso", "tribunal", "grau", "dataAjuizamento", "classe", "assuntos", "orgaoJulgador", "movimentos"],
          size: 1,
        }),
        signal: AbortSignal.timeout(20_000),
      }),
      fetchFromDJEN({ numeroProcesso: cnj, dataDisponibilizacaoInicio: "2020-01-01", itensPorPagina: 100 }),
    ]);

    if (!dataJudResponse.ok) throw new Error(`DataJud respondeu ${dataJudResponse.status}.`);
    const payload = (await dataJudResponse.json()) as { hits?: { hits?: Array<{ _source?: DataJudCase }> } };
    const found = payload.hits?.hits?.[0]?._source;
    if (!found) throw new Error("Processo não localizado na base pública do CNJ.");
    sources.push({ name: "DataJud/CNJ", url: DATAJUD_DOCS, status: "ok" });
    sources.push(
      djen.ok
        ? { name: "DJEN/CNJ", url: "https://comunica.pje.jus.br/", status: "ok", detail: `${djen.publications.length} publicação(ões)` }
        : { name: "DJEN/CNJ", url: "https://comunica.pje.jus.br/", status: "unavailable", detail: djen.error },
    );

    const dataJudMovements = (found.movimentos ?? []).map((movement) => ({
      date: movement.dataHora ?? null,
      name: movement.nome?.trim() || "Movimentação sem descrição",
      complement: movementComplement(movement),
      source: "datajud" as const,
      source_id: movement.codigo == null ? null : String(movement.codigo),
      source_url: DATAJUD_DOCS,
      code: movement.codigo ?? null,
      unit_name: movement.orgaoJulgador?.nome ?? found.orgaoJulgador?.nome ?? null,
      raw: movement,
    }));
    const djenMovements = djen.publications.map((publication) => ({
      date: publication.publication_date ? `${publication.publication_date}T12:00:00.000Z` : null,
      name: "Publicação no DJEN",
      complement: publication.content.slice(0, 2000),
      source: "djen" as const,
      source_id: publication.external_id,
      source_url: publication.url_original,
      code: null,
      unit_name: publication.orgao,
      raw: publication,
    }));
    const allMovements = [...dataJudMovements, ...djenMovements].sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? "")),
    );

    const movementRows = allMovements.map((movement) => ({
      organization_id: organizationId,
      case_id: caseId,
      consultation_id: consultation.id,
      cnj,
      source: movement.source,
      source_id: movement.source_id,
      movement_date: movement.date,
      movement_code: movement.code,
      movement_name: movement.name,
      complement: movement.complement,
      court: found.tribunal ?? null,
      unit_name: movement.unit_name,
      source_url: movement.source_url,
      source_hash: stableHash([movement.source, movement.source_id, movement.date, movement.name, movement.complement]),
      raw_data: movement.raw,
    }));
    if (movementRows.length > 0) {
      const { error } = await supabase.from("process_movements").upsert(movementRows, {
        onConflict: "organization_id,case_id,source,source_hash",
        ignoreDuplicates: true,
      });
      if (error) warnings.push("O histórico foi consultado, mas parte da deduplicação não pôde ser registrada.");
    }

    const formattedCnj = formatCnj(cnj);
    const proposedJurisdiction = [found.orgaoJulgador?.nome, found.tribunal].filter(Boolean).join(" · ") || null;
    const currentValues = { case_number: caseRow.case_number ?? null, jurisdiction: caseRow.jurisdiction ?? null };
    const proposedValues: Record<string, string> = {};
    const changes: ProcessConsultationResult["changes"] = [];
    if (caseRow.case_number !== formattedCnj) {
      proposedValues.case_number = formattedCnj;
      changes.push({ field: "case_number", label: "Número do processo", current: caseRow.case_number ?? null, proposed: formattedCnj });
    }
    if (proposedJurisdiction && caseRow.jurisdiction !== proposedJurisdiction) {
      proposedValues.jurisdiction = proposedJurisdiction;
      changes.push({ field: "jurisdiction", label: "Vara / Tribunal", current: caseRow.jurisdiction ?? null, proposed: proposedJurisdiction });
    }

    let proposalId: string | undefined;
    if (changes.length > 0) {
      const { data: proposal, error } = await supabase
        .from("case_update_proposals")
        .insert({
          organization_id: organizationId,
          case_id: caseId,
          consultation_id: consultation.id,
          created_by_user_id: userId,
          current_values: currentValues,
          proposed_values: proposedValues,
          source_refs: sources,
        })
        .select("id")
        .single();
      if (error) throw error;
      proposalId = proposal?.id;
    }

    const summary = {
      tribunal: found.tribunal ?? null,
      grau: found.grau ?? null,
      classe: found.classe?.nome ?? null,
      assuntos: (found.assuntos ?? []).map((subject) => subject.nome).filter(Boolean),
      orgao_julgador: found.orgaoJulgador?.nome ?? null,
      total_movimentos: allMovements.length,
      ultima_movimentacao: allMovements[0] ?? null,
    };
    await supabase.from("process_consultations").update({
      status: djen.ok ? "completed" : "partial",
      sources,
      summary,
      warnings,
      completed_at: new Date().toISOString(),
    }).eq("id", consultation.id);

    return {
      kind: "process_consultation",
      ok: true,
      consultation_id: consultation.id,
      proposal_id: proposalId,
      proposal_status: proposalId ? "pending" : undefined,
      cnj: formattedCnj,
      consulted_at: consultedAt,
      court: found.tribunal ?? null,
      degree: found.grau ?? null,
      class_name: found.classe?.nome ?? null,
      subjects: (found.assuntos ?? []).map((subject) => subject.nome ?? "").filter(Boolean),
      filed_at: found.dataAjuizamento ?? null,
      unit_name: found.orgaoJulgador?.nome ?? null,
      movements: allMovements.slice(0, 20).map(({ date, name, complement, source, source_url }) => ({ date, name, complement, source, source_url })),
      total_movements: allMovements.length,
      changes,
      sources,
      warnings,
    };
  } catch (error) {
    const message = safeError(error);
    await supabase.from("process_consultations").update({
      status: "failed",
      error_message: message,
      sources,
      warnings,
      completed_at: new Date().toISOString(),
    }).eq("id", consultation.id);
    return { kind: "process_consultation", ok: false, consultation_id: consultation.id, cnj: formatCnj(cnj), consulted_at: consultedAt, movements: [], total_movements: 0, changes: [], sources, warnings, error: message };
  }
}