import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases/")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/assistencias", replace: true });
  },
});
