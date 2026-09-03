import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/tarefas", search: { tab: "agenda" }, replace: true });
  },
});
