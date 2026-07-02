import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/drafter")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/pecas", replace: true });
  },
});
