import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PartySchema = z.object({
  role: z.string().trim().max(80),
  name: z.string().trim().max(200),
});

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
  team_member_ids: z.array(z.string().uuid()).optional(),
});

const StatusEnum = z.enum(["active", "archived", "closed"]);

export const getCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cases")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  });

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: caseData, error } = await context.supabase
      .from("cases")
      .select("*, documents(*), events(*)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error) throw error;
    return caseData;
  });

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: newCase, error } = await context.supabase
      .from("cases")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        client_name: data.client_name ?? null,
        status: data.status,
        case_number: data.case_number ?? null,
        jurisdiction: data.jurisdiction ?? null,
        case_type: data.case_type ?? null,
        parties: data.parties ?? [],
        represented_party: data.represented_party ?? null,
        team_member_ids: data.team_member_ids ?? [],
      })
      .select()
      .single();

    if (error) throw error;
    return newCase;
  });

export const updateCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        team_member_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;
    const { data: updatedCase, error } = await context.supabase
      .from("cases")
      .update(updates)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw error;
    return updatedCase;
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cases")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw error;
    return { success: true };
  });

const FromDocSchema = z.object({
  storage_path: z.string().min(1),
  filename: z.string().min(1).max(300),
  file_type: z.string().max(120),
  file_size: z.number().int().nonnegative(),
});

async function extractTextFromBlob(blob: Blob, filename: string, fileType: string) {
  const lower = filename.toLowerCase();
  if (fileType === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
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

/** Extrai dados do documento sem salvar. Retorna a estrutura + texto bruto. */
export const extractCaseDataFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FromDocSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");

    const { data: blob, error: dlErr } = await context.supabase.storage
      .from("documents")
      .download(data.storage_path);
    if (dlErr || !blob) throw new Error("Falha ao baixar arquivo enviado");

    const fullText = await extractTextFromBlob(blob, data.filename, data.file_type);
    const text = (fullText || "").trim();
    if (!text) throw new Error("Não foi possível extrair texto do documento");

    const snippet = text.slice(0, 15000);
    const system =
      "Você é um assistente jurídico brasileiro. A partir do texto de uma petição, contrato ou processo, extraia os dados estruturados do caso. Responda APENAS com JSON válido no formato pedido, sem markdown nem comentários.";
    const userMsg = `Analise o documento abaixo e devolva JSON com as chaves:
{
  "title": string (título curto e descritivo do caso, máx 120 chars),
  "client_name": string|null (nome do cliente principal, se identificável),
  "case_number": string|null (número do processo, se houver),
  "jurisdiction": string|null (vara/tribunal/comarca),
  "case_type": string|null (ex: Cível, Trabalhista, Família, Penal, Tributário),
  "parties": [{"role": string, "name": string}] (autor, réu, advogado, terceiros etc),
  "description": string (resumo objetivo do caso em 2-4 frases)
}

Documento:
"""
${snippet}
"""`;

    const ai = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.2 },
    );

    let parsed: Partial<ExtractedCaseData> = {};
    try {
      const raw = ai.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(raw) as Partial<ExtractedCaseData>;
    } catch {
      parsed = {};
    }

    const result: ExtractedCaseData = {
      title: (parsed.title || data.filename.replace(/\.[^.]+$/, "")).slice(0, 200),
      client_name: parsed.client_name ?? null,
      case_number: parsed.case_number ?? null,
      jurisdiction: parsed.jurisdiction ?? null,
      case_type: parsed.case_type ?? null,
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      description: parsed.description ?? "",
    };

    return { extracted: result, text_length: text.length };
  });

/** Após criar o caso, anexa o documento já enviado e devolve o id pra indexar. */
export const attachDocumentToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        user_id: context.userId,
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
