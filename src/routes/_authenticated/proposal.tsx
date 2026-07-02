import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/proposal")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/propostas", replace: true });
  },
});
