import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat/chat-panel";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Assistente Jurídico</h1>
        <p className="mt-1 text-muted-foreground">
          Pergunte sobre todos os seus documentos indexados.
        </p>
      </div>
      <ChatPanel />
    </div>
  );
}
