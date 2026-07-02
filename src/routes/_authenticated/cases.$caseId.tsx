import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  beforeLoad: ({, params}) => {
    throw redirect({ to: "/assistencias/$caseId", params: { caseId: params.caseId }, replace: true });
  },
});
