import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg, requireOrgPermission } from "@/lib/org-middleware";

const PartySchema = z.object({
  role: z.string().trim().max(80),
  name: z.string().trim().max(200),
  relation: z.string().trim().max(40).optional().nullable(),
});

const MatterKindEnum = z.enum(["processo", "pericia", "assistencia_tecnica"]);
const PracticeTypeEnum = z.enum(["advogado", "perito_judicial", "assistente_tecnico"]);

const PericiaFields = {
  matter_kind: MatterKindEnum.default("processo"),
  practice_type: PracticeTypeEnum.optional().nullable(),
  assisted_party_name: z.string().max(200).optional().nullable(),
  perito_fee_cents: z.number().int().nonnegative().optional().nullable(),
  perito_appointment_date: z.string().optional().nullable(),
  perito_deadline_date: z.string().optional().nullable(),
  perito_nomination_ref: z.string().max(200).optional().nullable(),
};

const CaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  client_name: z.string().max(200).optional().nullable(),
  status: z.enum(["active", "archived", "closed"]).default("active"),
  case_number: z.string().max(120).optional().nullable(),
  jurisdiction: z.string().max(200).optional().nullable(),
  case_type: z.string().max(80).optional().nullable(),
  parties: z.array(PartySchema).optional(),
  represented_party: PartySchema.nullable().optional(),
  ...PericiaFields,
});

const StatusEnum = z.enum(["active", "archived", "closed"]);

export const getCases = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cases")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  });

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: caseData, error } = await context.supabase
      .from("cases")
      .select("*, documents(*), events(*)")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .single();

    if (error) throw error;
    return caseData;
  });

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("cases.create")])
  .inputValidator((input: unknown) => CaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: newCase, error } = await context.supabase
      .from("cases")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        client_name: data.client_name ?? null,
        status: data.status,
        case_number: data.case_number ?? null,
        jurisdiction: data.jurisdiction ?? null,
        case_type: data.case_type ?? null,
        parties: data.parties ?? [],
        represented_party: data.represented_party ?? null,
        matter_kind: data.matter_kind,
        practice_type: data.practice_type ?? null,
        assisted_party_name: data.assisted_party_name ?? null,
        perito_fee_cents: data.perito_fee_cents ?? null,
        perito_appointment_date: data.perito_appointment_date ?? null,
        perito_deadline_date: data.perito_deadline_date ?? null,
        perito_nomination_ref: data.perito_nomination_ref ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return newCase;
  });

export const updateCase = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(4000).optional().nullable(),
        client_name: z.string().max(200).optional().nullable(),
        status: StatusEnum.optional(),
        case_number: z.string().max(120).optional().nullable(),
        jurisdiction: z.string().max(200).optional().nullable(),
        case_type: z.string().max(80).optional().nullable(),
        parties: z.array(PartySchema).optional(),
        represented_party: PartySchema.nullable().optional(),
              matter_kind: MatterKindEnum.optional(),
        practice_type: PracticeTypeEnum.optional().nullable(),
        assisted_party_name: z.string().max(200).optional().nullable(),
        perito_fee_cents: z.number().int().nonnegative().optional().nullable(),
        perito_appointment_date: z.string().optional().nullable(),
        perito_deadline_date: z.string().optional().nullable(),
        perito_nomination_ref: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;
    const { data: updatedCase, error } = await context.supabase
      .from("cases")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", context.organizationId)
      .select()
      .single();

    if (error) throw error;
    return updatedCase;
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("cases.delete")])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cases")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);

    if (error) throw error;
    return { success: true };
  });

const FromDocSchema = z.object({
  storage_path: z.string().min(1),
  filename: z.string().min(1).max(300),
  file_type: z.string().max(120),
  file_size: z.number().int().nonnegative(),
  matter_kind: MatterKindEnum.optional().default("processo"),
});

/** Nº máximo de páginas lidas do PDF para preencher o formulário do caso. */
const PDF_TEXT_PAGE_LIMIT = 20;
/** Nº máximo de páginas enviadas para OCR quando não há camada de texto. */
const PDF_OCR_PAGE_LIMIT = 4;

/**
 * Lê o texto de um PDF página por página, com limite.
 * PDFs grandes (centenas de páginas / dezenas de MB) estouram memória e tempo
 * quando extraídos por inteiro no runtime serverless — para preencher o
 * cadastro do caso, as primeiras páginas já contêm capa, partes e nº do processo.
 */
async function extractPdfText(
  buffer: Uint8Array,
  pageLimit = PDF_TEXT_PAGE_LIMIT,
): Promise<{ text: string; pageCount: number; pagesRead: number }> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const pageCount = pdf.numPages as number;
  const pagesRead = Math.min(pageCount, pageLimit);
  const parts: string[] = [];
  for (let i = 1; i <= pagesRead; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = (await page.getTextContent()) as {
        items: Array<{ str?: string }>;
      };
      parts.push(content.items.map((it) => it.str ?? "").join(" "));
    } catch {
      parts.push("");
    }
  }
  return { text: parts.join("\n\n"), pageCount, pagesRead };
}

export async function extractTextFromBlob(blob: Blob, filename: string, fileType: string) {
  const lower = filename.toLowerCase();
  if (fileType === "application/pdf" || lower.endsWith(".pdf")) {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const { text } = await extractPdfText(buffer);
    return text;
  }
  if (
    lower.endsWith(".docx") ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return await blob.text();
}


export type ExtractedCaseData = {
  title: string;
  client_name: string | null;
  case_number: string | null;
  jurisdiction: string | null;
  case_type: string | null;
  parties: { role: string; name: string }[];
  description: string;
};

const CASE_TYPES = [
  "Cível",
  "Trabalhista",
  "Família",
  "Penal",
  "Tributário",
  "Empresarial",
  "Consumidor",
  "Previdenciário",
  "Administrativo",
  "Constitucional",
] as const;

// CNJ: NNNNNNN-DD.YYYY.J.TR.OOOO
const CNJ_REGEX = /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/;

function normalizeCaseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  // keep original short form if it looks like an internal protocol
  return cleaned.length >= 4 && cleaned.length <= 60 ? cleaned : null;
}

function normalizeCaseType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  const match = CASE_TYPES.find((t) => lower.includes(t.toLowerCase()));
  if (match) return match;
  // common keyword mapping
  if (/(trabalh|clt|reclama)/.test(lower)) return "Trabalhista";
  if (/(famil|divorc|alimentos|guarda)/.test(lower)) return "Família";
  if (/(penal|crim|denuncia)/.test(lower)) return "Penal";
  if (/(tribut|fiscal|icms|iss|imposto)/.test(lower)) return "Tributário";
  if (/(consumi|cdc)/.test(lower)) return "Consumidor";
  if (/(previd|inss|aposenta)/.test(lower)) return "Previdenciário";
  if (/(empres|societ|comercial)/.test(lower)) return "Empresarial";
  if (/(administ|servidor)/.test(lower)) return "Administrativo";
  if (/civ/.test(lower)) return "Cível";
  return raw.trim().slice(0, 80);
}

function cleanJurisdiction(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, " ").trim();
  if (!v || /^(n\/?a|não\s*identif|desconhec|none|null)$/i.test(v)) return null;
  return v.slice(0, 200);
}

function cleanString(raw: string | null | undefined, max = 200): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, " ").trim();
  if (!v || /^(n\/?a|não\s*identif|desconhec|none|null|-+)$/i.test(v)) return null;
  return v.slice(0, max);
}

/** Extrai dados do documento sem salvar. Retorna a estrutura + texto bruto. */
export const extractCaseDataFromDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) => FromDocSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");

    const { data: blob, error: dlErr } = await context.supabase.storage
      .from("documents")
      .download(data.storage_path);
    if (dlErr || !blob) throw new Error("Falha ao baixar arquivo enviado");

    const isPdf =
      data.file_type === "application/pdf" || data.filename.toLowerCase().endsWith(".pdf");

    let text = "";
    let usedOcr = false;
    try {
      text = (await extractTextFromBlob(blob, data.filename, data.file_type))?.trim() ?? "";
    } catch {
      text = "";
    }

    // PDF escaneado / sem camada de texto: OCR das primeiras páginas.
    if (isPdf && text.length < 200) {
      try {
        const { ocrPdfPages } = await import("./rag/ocr.server");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pages = Array.from({ length: PDF_OCR_PAGE_LIMIT }, (_, i) => i + 1);
        const out = await ocrPdfPages({ bytes, filename: data.filename, pages, batchSize: 2 });
        const ocrText = out.blocks.map((b) => b.content).join("\n\n").trim();
        if (ocrText.length > text.length) {
          text = ocrText;
          usedOcr = true;
        }
      } catch {
        // mantém o texto que houver
      }
    }

    if (!text) {
      throw new Error(
        isPdf
          ? "Não foi possível ler o conteúdo deste PDF (provavelmente digitalizado sem texto ou protegido). Anexe o documento ao caso e preencha os dados manualmente."
          : "Não foi possível extrair texto do documento",
      );
    }


    // Fallback regex pra CNJ direto no texto — reforça o que o JurisMind achar
    const cnjFromText = text.match(CNJ_REGEX)?.[0] ?? null;

    const snippet = text.slice(0, 15000);
    const matterContext =
      data.matter_kind === "pericia"
        ? "O documento provavelmente é um despacho de nomeação pericial, quesitos ou laudo. Trate 'client_name' como o órgão/juízo nomeante e priorize identificar honorários periciais e prazo do laudo, se aparecerem na descrição."
        : data.matter_kind === "assistencia_tecnica"
          ? "O documento provavelmente é um laudo oficial, quesitos da parte ou contrato de assistência técnica. Trate 'client_name' como a parte assistida (quem contratou o assistente técnico)."
          : "O documento é uma petição, contrato ou processo judicial tradicional.";

    const system =
      "Você é um assistente jurídico brasileiro especialista em ler petições, contratos, processos, laudos periciais e pareceres técnicos. Extraia APENAS o que estiver explícito no documento. Quando um campo não estiver claramente identificado, devolva null — NUNCA invente nomes, números, varas ou tipos. Responda apenas com JSON válido, sem markdown.";
    const userMsg = `Contexto: ${matterContext}

Analise o documento abaixo e devolva JSON com EXATAMENTE estas chaves:
{
  "title": string,          // título curto e descritivo (máx 120 chars). Se não houver assunto claro, use a natureza da ação/perícia.
  "client_name": string|null, // ${data.matter_kind === "pericia" ? "órgão/juízo nomeante" : data.matter_kind === "assistencia_tecnica" ? "parte assistida (quem contratou o assistente técnico)" : "nome do cliente principal (autor/requerente/contratante)"}. null se não identificado.
  "case_number": string|null, // número CNJ no formato NNNNNNN-DD.AAAA.J.TR.OOOO se houver. Se houver outro protocolo, devolva como está. null se não houver.
  "jurisdiction": string|null,// vara/tribunal/comarca completos (ex: "2ª Vara Cível de São Paulo - TJSP"). null se não houver.
  "case_type": string|null,   // UM destes: ${CASE_TYPES.join(", ")}. null se não der pra classificar com segurança.
  "parties": [{"role": string, "name": string}], // partes explícitas. role em minúsculas: autor, réu, requerente, requerido, advogado, terceiro, perito, assistente. [] se nenhuma identificada.
  "description": string       // resumo objetivo em 2-4 frases. Se documento ilegível/incompleto, descreva isso.
}

Regras:
- Nunca preencha campos com "N/A", "desconhecido", "—" ou frases. Use null.
- Não confunda o nome do escritório/advogado/perito com o cliente.
- O número do processo tem 20 dígitos no padrão CNJ. Confira antes de devolver.

Documento:
"""
${snippet}
"""`;

    const ai = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.1 },
    );

    let parsed: Partial<ExtractedCaseData> = {};
    try {
      const raw = ai.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(raw) as Partial<ExtractedCaseData>;
    } catch {
      parsed = {};
    }

    const normalizedNumber =
      normalizeCaseNumber(parsed.case_number ?? null) ?? normalizeCaseNumber(cnjFromText);

    const result: ExtractedCaseData = {
      title: (cleanString(parsed.title, 200) || data.filename.replace(/\.[^.]+$/, "")).slice(
        0,
        200,
      ),
      client_name: cleanString(parsed.client_name, 200),
      case_number: normalizedNumber,
      jurisdiction: cleanJurisdiction(parsed.jurisdiction),
      case_type: normalizeCaseType(parsed.case_type),
      parties: Array.isArray(parsed.parties)
        ? parsed.parties
            .filter((p) => p && typeof p === "object" && p.name)
            .map((p) => ({
              role: cleanString(p.role, 80) ?? "parte",
              name: cleanString(p.name, 200) ?? "",
            }))
            .filter((p) => p.name)
        : [],
      description: cleanString(parsed.description, 4000) ?? "",
    };

    const missing: string[] = [];
    if (!result.client_name) missing.push("client_name");
    if (!result.case_number) missing.push("case_number");
    if (!result.jurisdiction) missing.push("jurisdiction");
    if (!result.case_type) missing.push("case_type");
    if (result.parties.length === 0) missing.push("parties");
    if (!result.description) missing.push("description");

    const warnings: { field: string | null; message: string }[] = [];
    if (parsed.case_number && !normalizedNumber) {
      warnings.push({
        field: "case_number",
        message: `O número "${parsed.case_number}" não está no padrão CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO). Corrija antes de criar o caso.`,
      });
    }
    if (cnjFromText && parsed.case_number && cnjFromText !== parsed.case_number) {
      warnings.push({
        field: "case_number",
        message: `Encontramos outro número no texto (${cnjFromText}) diferente do extraído pelo JurisMind. Confira qual é o correto.`,
      });
    }

    return { extracted: result, text_length: text.length, missing, warnings };
  });


/** Após criar o caso, anexa o documento já enviado e devolve o id pra indexar. */
export const attachDocumentToCase = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) =>
    FromDocSchema.extend({ case_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: blob, error: dlErr } = await context.supabase.storage
      .from("documents")
      .download(data.storage_path);
    if (dlErr || !blob) throw new Error("Arquivo não encontrado no storage");
    const text = (await extractTextFromBlob(blob, data.filename, data.file_type)) || "";

    const { data: doc, error } = await context.supabase
      .from("documents")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: data.case_id,
        filename: data.filename,
        file_type: data.file_type,
        file_size: data.file_size,
        storage_path: data.storage_path,
        extracted_text: text.slice(0, 200_000),
        processing_status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return { document_id: doc.id };
  });

/**
 * Alocação de equipe no caso. Grava acessos reais em `case_access`
 * (fonte única de verdade), substituindo a lista atual pelos usuários
 * informados. Somente quem pode editar o caso pode alterar a alocação.
 */
export const setCaseTeamAccess = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((input: unknown) =>
    z
      .object({
        case_id: z.string().uuid(),
        user_ids: z.array(z.string().uuid()).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: canEdit } = await context.supabase.rpc("user_can_edit_case", {
      _case_id: data.case_id,
      _user_id: context.userId,
    });
    if (!canEdit) throw new Error("Você não pode alterar a equipe deste caso.");

    // Apenas integrantes ativos da organização podem ser alocados.
    const { data: members } = await context.supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", context.organizationId)
      .eq("status", "active");
    const allowed = new Set((members ?? []).map((m) => m.user_id));
    const target = data.user_ids.filter((id) => allowed.has(id));

    const { data: current } = await context.supabase
      .from("case_access")
      .select("user_id")
      .eq("case_id", data.case_id);
    const currentIds = new Set((current ?? []).map((r) => r.user_id));

    const toRemove = [...currentIds].filter((id) => !target.includes(id));
    if (toRemove.length > 0) {
      const { error } = await context.supabase
        .from("case_access")
        .delete()
        .eq("case_id", data.case_id)
        .in("user_id", toRemove);
      if (error) throw error;
    }

    const toAdd = target.filter((id) => !currentIds.has(id));
    if (toAdd.length > 0) {
      const { error } = await context.supabase.from("case_access").insert(
        toAdd.map((user_id) => ({
          organization_id: context.organizationId,
          case_id: data.case_id,
          user_id,
          access_level: "editor" as const,
          granted_by_user_id: context.userId,
        })),
      );
      if (error) throw error;
    }

    return { allocated: target.length };
  });
