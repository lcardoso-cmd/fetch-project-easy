import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";

const DecisionSchema = z.object({
  proposal_id: z.string().uuid(),
  decision: z.enum(["applied", "rejected"]),
});

export const decideCaseUpdateProposal = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((input: unknown) => DecisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: proposal, error: proposalError } = await context.supabase
      .from("case_update_proposals")
      .select("id, organization_id, case_id, status")
      .eq("id", data.proposal_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (proposalError) throw proposalError;
    if (!proposal) throw new Error("Proposta de atualização não encontrada.");
    if (proposal.status !== "pending") throw new Error("Esta proposta já foi decidida.");

    const { data: result, error } = await context.supabase.rpc("decide_case_update_proposal", {
      _proposal_id: data.proposal_id,
      _decision: data.decision,
    });
    if (error) throw new Error(error.message);
    const parsed = result as { ok?: unknown; status?: unknown } | null;
    return {
      ok: parsed?.ok === true,
      status: parsed?.status === "applied" ? "applied" : "rejected",
    };
  });