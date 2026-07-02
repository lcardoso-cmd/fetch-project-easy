import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/monitoring")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/publicacoes", replace: true });
  },
});
