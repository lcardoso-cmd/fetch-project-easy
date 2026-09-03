import { createFileRoute } from "@tanstack/react-router";
import { ConversationCenter } from "@/components/chat/conversation-center";

export const Route = createFileRoute("/_authenticated/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas internas | JurisMind AI" },
      {
        name: "description",
        content:
          "Canal geral, conversas por caso e mensagens diretas da equipe do escritório, com menções, anexos e tarefas.",
      },
      { property: "og:title", content: "Conversas internas | JurisMind AI" },
      {
        property: "og:description",
        content:
          "Comunicação interna do escritório integrada a casos, tarefas e notificações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversasPage,
});

function ConversasPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Conversas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canal geral do escritório, conversas por caso e mensagens diretas — com menções, anexos e
          tarefas ligadas ao Kanban.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ConversationCenter />
      </div>
    </div>
  );
}
