import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases/$caseId/chat")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/assistencias/$caseId/chat", params: { caseId: params.caseId }, replace: true });
  },
});
