import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  client_name: z.string().max(200).optional(),
  status: z.enum(["active", "archived", "closed"]).default("active"),
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
        description: data.description,
        client_name: data.client_name,
        status: data.status,
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
        description: z.string().max(2000).optional(),
        client_name: z.string().max(200).optional(),
        status: StatusEnum.optional(),
        case_number: z.string().max(120).optional(),
        jurisdiction: z.string().max(200).optional(),
        case_type: z.string().max(80).optional(),
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

export const createCaseFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FromDocSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");

    // 1. baixar arquivo
    const { data: blob, error: dlErr } = await context.supabase.storage
      .from("documents")
      .download(data.storage_path);
    if (dlErr || !blob) throw new Error("Falha ao baixar arquivo enviado");

    // 2. extrair texto
    const fullText = await extractTextFromBlob(blob, data.filename, data.file_type);
    const text = (fullText || "").trim();
    if (!text) throw new Error("Não foi possível extrair texto do documento");

    // 3. AI extrai dados estruturados
    const snippet = text.slice(0, 15000);
    const system =
      "Você é um assistente jurídico brasileiro. A partir do texto de uma petição, contrato ou processo, extraia os dados estruturados do caso. Responda APENAS com JSON válido no formato pedido, sem markdown nem comentários.";
    const user = `Analise o documento abaixo e devolva JSON com as chaves:
{
  "title": string (título curto e descritivo do caso, máx 120 chars),
  "client_name": string|null (nome do cliente principal, se identificável),
  "case_number": string|null (número do processo, se houver),
  "jurisdiction": string|null (vara/tribunal/comarca),
  "case_type": string|null (ex: Cível, Trabalhista, Família, Penal, Tributário),
  "parties": [{"role": string, "name": string}] (autor, réu, advogado, etc),
  "description": string (resumo objetivo do caso em 2-4 frases)
}

Documento:
"""
${snippet}
"""`;

    const ai = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.2 },
    );

    type Extracted = {
      title?: string;
      client_name?: string | null;
      case_number?: string | null;
      jurisdiction?: string | null;
      case_type?: string | null;
      parties?: { role: string; name: string }[];
      description?: string;
    };
    let parsed: Extracted = {};
    try {
      const raw = ai.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(raw) as Extracted;
    } catch {
      parsed = { title: data.filename.replace(/\.[^.]+$/, "") };
    }

    const title = (parsed.title || data.filename.replace(/\.[^.]+$/, "")).slice(0, 200);

    // 4. criar o caso
    const { data: newCase, error: caseErr } = await context.supabase
      .from("cases")
      .insert({
        user_id: context.userId,
        title,
        client_name: parsed.client_name ?? null,
        description: parsed.description ?? null,
        case_number: parsed.case_number ?? null,
        jurisdiction: parsed.jurisdiction ?? null,
        case_type: parsed.case_type ?? null,
        parties: parsed.parties ?? [],
        status: "active",
      })
      .select()
      .single();
    if (caseErr) throw caseErr;

    // 5. registrar documento já com texto extraído
    const { data: doc, error: docErr } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        case_id: newCase.id,
        filename: data.filename,
        file_type: data.file_type,
        file_size: data.file_size,
        storage_path: data.storage_path,
        extracted_text: text.slice(0, 200_000),
        processing_status: "pending",
      })
      .select()
      .single();
    if (docErr) throw docErr;

    return { case: newCase, document_id: doc.id };
  });
