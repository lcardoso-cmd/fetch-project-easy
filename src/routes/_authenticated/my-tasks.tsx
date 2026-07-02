import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/tarefas", replace: true });
  },
});
