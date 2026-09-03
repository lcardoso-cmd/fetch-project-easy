/**
 * Resposta pública do cliente a uma proposta compartilhada.
 *
 * GET  /api/public/proposal-response/:token  → situação da proposta vinculada
 *      (registra visualização na primeira leitura válida)
 * POST /api/public/proposal-response/:token  → aceite/recusa idempotentes
 *      body: { outcome: "accepted" | "declined", name, email?, comment?, reason? , password? }
 *
 * O token de 32 bytes é a autorização; usa cliente administrativo porque
 * o visitante é anônimo. Toda validação (revogado / expirado / senha /
 * proposta já encerrada) roda no servidor antes de qualquer escrita.
 */
import { createFileRoute } from "@tanstack/react-router";
import { hashSharePassword, safeEqualHex } from "@/lib/proposal-shares-crypto";
import { isProposalOpenForResponse } from "@/lib/crm-schema";

type ShareRow = {
  id: string;
  organization_id: string;
  proposal_id: string | null;
  password_salt: string | null;
  password_hash: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type ProposalRow = {
  id: string;
  organization_id: string;
  number: number;
  title: string;
  status: string;
  valid_until: string | null;
  view_count: number;
  first_viewed_at: string | null;
  responded_at: string | null;
  response_name: string | null;
};

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function load(token: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("proposal_shares")
    .select(
      "id, organization_id, proposal_id, password_salt, password_hash, expires_at, revoked_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) return { error: new Response("Erro interno", { status: 500 }) };
  if (!data) return { error: new Response("Link não encontrado", { status: 404 }) };
  const share = data as ShareRow;
  if (share.revoked_at) return { error: new Response("Link revogado", { status: 410 }) };
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    return { error: new Response("Link expirado", { status: 410 }) };
  }
  if (!share.proposal_id) {
    return { error: new Response("Este link não aceita resposta", { status: 404 }) };
  }
  const { data: proposal, error: pErr } = await admin
    .from("proposals")
    .select(
      "id, organization_id, number, title, status, valid_until, view_count, first_viewed_at, responded_at, response_name",
    )
    .eq("id", share.proposal_id)
    .maybeSingle();
  if (pErr) return { error: new Response("Erro interno", { status: 500 }) };
  if (!proposal) return { error: new Response("Proposta não encontrada", { status: 404 }) };
  return { admin, share, proposal: proposal as ProposalRow };
}

export const Route = createFileRoute("/api/public/proposal-response/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (token.length < 20) return new Response("Token inválido", { status: 400 });
        const res = await load(token);
        if ("error" in res) return res.error;
        const { admin, share, proposal } = res;

        // Registra visualização (uma vez por acesso), sem expor dados internos.
        const nowIso = new Date().toISOString();
        await admin
          .from("proposals")
          .update({
            view_count: (proposal.view_count ?? 0) + 1,
            first_viewed_at: proposal.first_viewed_at ?? nowIso,
            last_viewed_at: nowIso,
            status: ["shared"].includes(proposal.status) ? "viewed" : proposal.status,
          })
          .eq("id", proposal.id);
        await admin.from("proposal_events").insert({
          organization_id: share.organization_id,
          proposal_id: proposal.id,
          kind: "viewed",
          actor_label: "Cliente (link público)",
          metadata: {},
        });

        const open = isProposalOpenForResponse(
          proposal.status === "shared" ? "viewed" : proposal.status,
          proposal.valid_until,
        );
        return Response.json({
          number: proposal.number,
          title: proposal.title,
          status: proposal.status,
          valid_until: proposal.valid_until,
          responded_at: proposal.responded_at,
          response_name: proposal.response_name,
          can_respond: open.ok,
          reason: open.reason ?? null,
          requires_password: !!proposal && !!share.password_hash,
        });
      },

      POST: async ({ params, request }) => {
        const token = String(params.token ?? "");
        if (token.length < 20) return new Response("Token inválido", { status: 400 });

        let body: Record<string, string | undefined> = {};
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const res = await load(token);
        if ("error" in res) return res.error;
        const { admin, share, proposal } = res;

        if (share.password_hash && share.password_salt) {
          const supplied = (body.password ?? "").trim();
          if (!supplied) return new Response("Senha obrigatória", { status: 401 });
          const hash = await hashSharePassword(supplied, share.password_salt);
          if (!safeEqualHex(hash, share.password_hash)) {
            return new Response("Senha incorreta", { status: 401 });
          }
        }

        const outcome = body.outcome === "accepted" ? "accepted" : body.outcome === "declined" ? "declined" : null;
        if (!outcome) return new Response("Resposta inválida", { status: 400 });
        const name = (body.name ?? "").trim();
        if (name.length < 3) {
          return new Response("Informe seu nome completo", { status: 400 });
        }
        const reason = (body.reason ?? "").trim();
        if (outcome === "declined" && reason.length < 3) {
          return new Response("Informe o motivo da recusa", { status: 400 });
        }

        // Idempotente: uma proposta já respondida devolve a resposta anterior.
        if (proposal.responded_at) {
          return Response.json({
            ok: true,
            already: true,
            status: proposal.status,
          });
        }
        const open = isProposalOpenForResponse(
          proposal.status === "shared" ? "viewed" : proposal.status,
          proposal.valid_until,
        );
        if (!open.ok) {
          return new Response(
            open.reason === "expired"
              ? "O prazo de validade desta proposta terminou."
              : "Esta proposta não está disponível para resposta.",
            { status: 409 },
          );
        }

        const nowIso = new Date().toISOString();
        const { error } = await admin
          .from("proposals")
          .update({
            status: outcome,
            responded_at: nowIso,
            response_name: name,
            response_email: (body.email ?? "").trim() || null,
            response_comment: (body.comment ?? "").trim() || null,
            decline_reason: outcome === "declined" ? reason : null,
          })
          .eq("id", proposal.id)
          .is("responded_at", null);
        if (error) return new Response("Não foi possível registrar a resposta", { status: 500 });

        await admin.from("proposal_events").insert({
          organization_id: share.organization_id,
          proposal_id: proposal.id,
          kind: outcome,
          actor_label: name,
          metadata: { via: "public_link" },
        });

        // Reflete o resultado na oportunidade vinculada, quando existir.
        const { data: full } = await admin
          .from("proposals")
          .select("opportunity_id, lead_id")
          .eq("id", proposal.id)
          .maybeSingle();
        if (full?.opportunity_id) {
          await admin
            .from("crm_opportunities")
            .update({
              stage: outcome === "accepted" ? "won" : "lost",
              stage_changed_at: nowIso,
              lost_reason: outcome === "declined" ? reason : null,
            })
            .eq("id", full.opportunity_id);
          await admin.from("crm_stage_history").insert({
            organization_id: share.organization_id,
            opportunity_id: full.opportunity_id,
            from_stage: null,
            to_stage: outcome === "accepted" ? "won" : "lost",
            note:
              outcome === "accepted"
                ? `Aceite registrado pelo cliente (${name})`
                : `Recusa registrada pelo cliente (${name}): ${reason}`,
            created_by_user_id: proposal.organization_id ? undefined as unknown as string : undefined as unknown as string,
          });
        }

        return Response.json({ ok: true, already: false, status: outcome });
      },
    },
  },
});
