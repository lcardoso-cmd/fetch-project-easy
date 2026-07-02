import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/firm")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/configuracoes/escritorio", replace: true });
  },
});
