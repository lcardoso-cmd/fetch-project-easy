import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases/new")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/assistencias/nova", replace: true });
  },
});
