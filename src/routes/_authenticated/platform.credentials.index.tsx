import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/platform/credentials/")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/plataforma/credenciais", replace: true });
  },
});
