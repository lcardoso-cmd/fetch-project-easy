import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/platform/customers/$id")({
  beforeLoad: ({, params}) => {
    throw redirect({ to: "/plataforma/clientes/$id", params: { id: params.id }, replace: true });
  },
});
