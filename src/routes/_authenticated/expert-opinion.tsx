import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/expert-opinion")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/parecer-tecnico", replace: true });
  },
});
