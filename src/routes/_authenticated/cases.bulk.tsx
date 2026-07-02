import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases/bulk")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/assistencias/lote", replace: true });
  },
});
