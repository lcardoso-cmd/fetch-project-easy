import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/platform/customers/")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/plataforma/clientes", replace: true });
  },
});
