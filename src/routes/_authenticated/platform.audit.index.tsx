import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/platform/audit/")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/plataforma/auditoria", replace: true });
  },
});
