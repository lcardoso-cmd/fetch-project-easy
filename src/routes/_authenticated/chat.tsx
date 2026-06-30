import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Assistente Jurídico</h1>
        <p className="mt-1 text-muted-foreground">Converse com a IA sobre seus documentos.</p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">O assistente será ativado após o upload de documentos.</p>
      </div>
    </div>
  );
}
