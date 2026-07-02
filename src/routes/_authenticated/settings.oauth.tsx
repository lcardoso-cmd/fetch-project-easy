import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/oauth")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/configuracoes/oauth", replace: true });
  },
});
