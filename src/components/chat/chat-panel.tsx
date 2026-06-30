import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askWithRag } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, FileText, AlertCircle } from "lucide-react";

interface Citation {
  document_id: string;
  filename: string;
  snippet: string;
  similarity: number;
}

interface ToolStep {
  name: string;
  args_json: string;
  result_json: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  steps?: ToolStep[];
}

export function ChatPanel({
  caseId,
  pendingDocs = 0,
  readyDocs = 0,
}: {
  caseId?: string;
  pendingDocs?: number;
  readyDocs?: number;
}) {
  const askFn = useServerFn(askWithRag);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const res = await askFn({ data: { case_id: caseId, question: q, history } });
      setMessages([
        ...next,
        { role: "assistant", content: res.answer, citations: res.citations, steps: res.steps },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages([...next, { role: "assistant", content: `Erro: ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border bg-card shadow-sm">
      {(pendingDocs > 0 || (caseId && readyDocs === 0 && pendingDocs === 0)) && (
        <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {pendingDocs > 0
              ? `${pendingDocs} documento(s) ainda sendo indexado(s) — respostas podem ficar incompletas até concluir.`
              : "Nenhum documento indexado neste caso ainda. Faça upload acima para que o chat possa consultá-los."}
          </span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 text-accent" />
            <p className="font-medium text-foreground">Pergunte sobre seus documentos</p>
            <p className="text-sm">O JurisMind busca os trechos relevantes e responde citando as fontes.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border/40 pt-2">
                    <p className="text-xs font-semibold opacity-70">Fontes:</p>
                    {m.citations.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs opacity-80">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          [{idx + 1}] {c.filename}
                          <span className="ml-1 opacity-60">
                            ({Math.round(c.similarity * 100)}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {m.steps && m.steps.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border/40 pt-2">
                    <p className="text-xs font-semibold opacity-70">Ações executadas:</p>
                    {m.steps.map((s, idx) => (
                      <div key={idx} className="text-xs opacity-80">
                        ⚡ <span className="font-mono">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ex.: Qual o prazo de defesa neste caso?"
            rows={2}
            className="resize-none"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon" className="h-auto">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
