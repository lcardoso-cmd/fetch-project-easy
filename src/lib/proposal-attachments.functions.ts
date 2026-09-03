import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/org-middleware";
import { extractTextFromBlob } from "./cases.functions";

export type ProposalAttachment = {
  id: string;
  created_by_user_id: string;
  case_id: string | null;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extraction_status: "pending" | "processing" | "done" | "error";
  extracted_text: string | null;
  extracted_fields: ExtractedProposalFields | null;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ExtractedProposalFields = {
  client_name: string | null;
  client_document: string | null;
  client_city_state: string | null;
  counterparty_name: string | null;
  counterparty_document: string | null;
  matter: string | null;
  scope: string | null;
  jurisdiction: string | null;
  case_type: string | null;
};

const CaseIdFilter = z.object({ case_id: z.string().uuid().nullable() });

export const listProposalAttachments = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("proposals.use")])
  .inputValidator((i: unknown) => CaseIdFilter.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("proposal_attachments")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false });
    q = data.case_id === null ? q.is("case_id", null) : q.eq("case_id", data.case_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as ProposalAttachment[];
  });

const RegisterSchema = z.object({
  case_id: z.string().uuid().nullable(),
  filename: z.string().min(1).max(300),
  file_type: z.string().max(120),
  file_size: z.number().int().nonnegative(),
  storage_path: z.string().min(1),
});

export const registerProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("proposals.use")])
  .inputValidator((i: unknown) => RegisterSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("proposal_attachments")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: data.case_id,
        filename: data.filename,
        file_type: data.file_type,
        file_size: data.file_size,
        storage_path: data.storage_path,
        extraction_status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return row as ProposalAttachment;
  });

export const deleteProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("proposals.use")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("proposal_attachments")
      .select("storage_path")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .single();
    if (row?.storage_path) {
      await context.supabase.storage.from("documents").remove([row.storage_path]);
    }
    const { error } = await context.supabase
      .from("proposal_attachments")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });

function cleanStr(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || /^(n\/?a|não\s*identif|desconhec|none|null|-+)$/i.test(s)) return null;
  return s.slice(0, max);
}

export const extractProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("proposals.use")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: att, error: selErr } = await context.supabase
      .from("proposal_attachments")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .single();
    if (selErr || !att) throw new Error("Anexo não encontrado");

    await context.supabase
      .from("proposal_attachments")
      .update({ extraction_status: "processing", extraction_error: null })
      .eq("id", att.id);

    try {
      const { data: blob, error: dlErr } = await context.supabase.storage
        .from("documents")
        .download(att.storage_path);
      if (dlErr || !blob) throw new Error("Arquivo não encontrado no storage");

      const fullText = await extractTextFromBlob(blob, att.filename, att.file_type);
      const text = (fullText || "").trim();
      if (!text) throw new Error("Não foi possível extrair texto do documento");

      const { chatComplete } = await import("./ai.server");
      const snippet = text.slice(0, 15000);

      const system =
        "Você é um assistente jurídico brasileiro. Extraia dados do documento para pré-preencher uma proposta comercial. Responda APENAS JSON válido, sem markdown. Use null quando não estiver explícito no documento — NUNCA invente.";
      const userMsg = `Analise o documento e devolva JSON com exatamente estas chaves:
{
  "client_name": string|null,        // nome/razão social do potencial cliente (autor/contratante/parte principal)
  "client_document": string|null,    // CPF ou CNPJ do cliente, se aparecer
  "client_city_state": string|null,  // cidade/UF do cliente
  "counterparty_name": string|null,  // nome/razão social da contraparte (réu/requerido)
  "counterparty_document": string|null,
  "matter": string|null,             // resumo objetivo da matéria em 1-3 frases
  "scope": string|null,              // escopo sugerido do trabalho em 1-2 frases
  "jurisdiction": string|null,       // vara/tribunal/comarca completos
  "case_type": string|null           // ex: Cível, Trabalhista, Família, Penal, Tributário, Consumidor, Previdenciário, Empresarial, Administrativo
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
        { temperature: 0.1 },
      );

      let parsed: Record<string, unknown> = {};
      try {
        const raw = ai.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }

      const extracted: ExtractedProposalFields = {
        client_name: cleanStr(parsed.client_name, 200),
        client_document: cleanStr(parsed.client_document, 40),
        client_city_state: cleanStr(parsed.client_city_state, 120),
        counterparty_name: cleanStr(parsed.counterparty_name, 200),
        counterparty_document: cleanStr(parsed.counterparty_document, 40),
        matter: cleanStr(parsed.matter, 2000),
        scope: cleanStr(parsed.scope, 2000),
        jurisdiction: cleanStr(parsed.jurisdiction, 200),
        case_type: cleanStr(parsed.case_type, 80),
      };

      const { data: updated, error: upErr } = await context.supabase
        .from("proposal_attachments")
        .update({
          extraction_status: "done",
          extracted_text: text.slice(0, 200_000),
          extracted_fields: extracted,
          extraction_error: null,
        })
        .eq("id", att.id)
        .select()
        .single();
      if (upErr) throw upErr;
      return updated as ProposalAttachment;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha na extração";
      await context.supabase
        .from("proposal_attachments")
        .update({ extraction_status: "error", extraction_error: message })
        .eq("id", att.id);
      throw err;
    }
  });

const ConvertSchema = z.object({
  case: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional().nullable(),
    client_name: z.string().max(200).optional().nullable(),
    case_type: z.string().max(80).optional().nullable(),
    jurisdiction: z.string().max(200).optional().nullable(),
  }),
  attachment_ids: z.array(z.string().uuid()).default([]),
  from_case_id: z.string().uuid().nullable().optional(),
});

/**
 * Cria um caso a partir da proposta, anexa os documentos enviados no fluxo
 * de proposta (movendo-os para a tabela `documents`) e re-vincula o rascunho
 * de proposta ao novo caso.
 */
export const convertProposalToCase = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("proposals.use")])
  .inputValidator((i: unknown) => ConvertSchema.parse(i))
  .handler(async ({ data, context }) => {
    // 1. Cria o caso
    const { data: newCase, error: caseErr } = await context.supabase
      .from("cases")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        title: data.case.title,
        description: data.case.description ?? null,
        client_name: data.case.client_name ?? null,
        status: "active",
        case_type: data.case.case_type ?? null,
        jurisdiction: data.case.jurisdiction ?? null,
        matter_kind: "processo",
      })
      .select()
      .single();
    if (caseErr || !newCase) throw caseErr ?? new Error("Falha ao criar caso");

    // 2. Anexa cada attachment ao novo caso, criando linhas em `documents`
    const attachmentFailures: { id: string; message: string }[] = [];
    if (data.attachment_ids.length > 0) {
      const { data: atts } = await context.supabase
        .from("proposal_attachments")
        .select("*")
        .in("id", data.attachment_ids)
        .eq("organization_id", context.organizationId);

      for (const att of atts ?? []) {
        try {
          const { error: docErr } = await context.supabase
            .from("documents")
            .insert({
              organization_id: context.organizationId,
        created_by_user_id: context.userId,
              case_id: newCase.id,
              filename: att.filename,
              file_type: att.file_type,
              file_size: att.file_size,
              storage_path: att.storage_path,
              extracted_text: att.extracted_text ?? null,
              processing_status: "pending",
            });
          if (docErr) throw docErr;
          // Atualiza o attachment para apontar ao caso (mantém histórico)
          await context.supabase
            .from("proposal_attachments")
            .update({ case_id: newCase.id })
            .eq("id", att.id);
        } catch (err) {
          attachmentFailures.push({
            id: att.id,
            message: err instanceof Error ? err.message : "Falha ao anexar",
          });
        }
      }
    }

    // 3. Move o rascunho de proposta do "sem caso" para o novo caso
    if (data.from_case_id === undefined || data.from_case_id === null) {
      const { data: draft } = await context.supabase
        .from("proposal_drafts")
        .select("id")
        .eq("organization_id", context.organizationId)
        .is("case_id", null)
        .maybeSingle();
      if (draft) {
        await context.supabase
          .from("proposal_drafts")
          .update({ case_id: newCase.id })
          .eq("id", draft.id);
      }
    }

    return { case_id: newCase.id as string, attachment_failures: attachmentFailures };
  });
