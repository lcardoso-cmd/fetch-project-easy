import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/platform/users/")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/plataforma/usuarios", replace: true });
  },
});
