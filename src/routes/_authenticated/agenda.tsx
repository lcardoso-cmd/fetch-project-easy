import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A agenda foi incorporada a "Meu trabalho". Configurações de conexão com
 * Google/Outlook permanecem em Administração → Integrações.
 */
export const Route = createFileRoute("/_authenticated/agenda")({
  beforeLoad: () => {
    throw redirect({ to: "/tarefas", search: { tab: "agenda" }, replace: true });
  },
});
