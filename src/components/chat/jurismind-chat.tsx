import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askWithRag } from "@/lib/chat.functions";
import { stripMarkdown } from "@/lib/strip-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BrainCircuit,
  CalendarIcon,
  FileText,
  ImagePlus,
  Loader2,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { DocItem } from "@/components/documents/document-list";
import {
  PetitionCard,
  PresentationCard,
  TableCard,
} from "@/components/chat/artifact-cards";
import { toast } from "sonner";

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
  images?: string[];
  citations?: Citation[];
  steps?: ToolStep[];
}

interface PartyRef {
  role: string;
  name: string;
  relation?: string | null;
}

interface CaseSummary {
  title: string;
  client_name?: string | null;
  status?: string | null;
  case_number?: string | null;
  case_type?: string | null;
  jurisdiction?: string | null;
  parties?: PartyRef[];
  represented_party?: { role: string; name: string } | null;
}

export function JurisMindChat({
  caseId,
  caseInfo,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: {
  caseId: string;
  caseInfo: CaseSummary;
  documents: DocItem[];
  selectedDocIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const askFn = useServerFn(askWithRag);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const onPickImages = async (files: FileList | null) => {
    if (!files) return;
    const list: string[] = [];
    for (const f of Array.from(files).slice(0, 6 - images.length)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} maior que 8MB`);
        continue;
      }
      list.push(
        await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onerror = () => reject(r.error);
          r.onload = () => resolve(String(r.result));
          r.readAsDataURL(f);
        }),
      );
    }
    setImages((prev) => [...prev, ...list]);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const readyDocs = useMemo(
    () => documents.filter((d) => d.processing_status === "ready"),
    [documents],
  );
  const pendingDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.processing_status === "pending" || d.processing_status === "processing",
      ).length,
    [documents],
  );

  const filteredDocs = useMemo(() => {
    return readyDocs
      .filter((d) => d.filename.toLowerCase().includes(search.toLowerCase()))
      .filter((d) => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) return true;
        if (!d.created_at) return false;
        const docDate = new Date(d.created_at).getTime();
        const from = dateRange.from
          ? new Date(dateRange.from).setHours(0, 0, 0, 0)
          : null;
        const to = dateRange.to
          ? new Date(dateRange.to).setHours(23, 59, 59, 999)
          : null;
        if (from && to) return docDate >= from && docDate <= to;
        if (from) return docDate >= from;
        if (to) return docDate <= to;
        return true;
      });
  }, [readyDocs, search, dateRange]);

  const send = async () => {
    const q = input.trim();
    if ((!q && images.length === 0) || busy) return;
    setInput("");
    const sentImages = images;
    setImages([]);
    const userMsg: Msg = {
      role: "user",
      content: q || "(imagens enviadas)",
      images: sentImages,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const selected = Array.from(selectedDocIds);
      const res = await askFn({
        data: {
          case_id: caseId,
          question: q || "Analise as imagens enviadas.",
          history,
          selected_doc_ids: selected.length ? selected : undefined,
          images: sentImages.length ? sentImages : undefined,
        },
      });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: stripMarkdown(res.answer),
          citations: res.citations,
          steps: res.steps,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages([...next, { role: "assistant", content: `Erro: ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      {/* Sidebar */}
      <aside className="flex min-h-0 flex-col gap-4 lg:col-span-1">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhes do caso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            {caseInfo.client_name && (
              <p>
                <span className="font-medium text-foreground">Cliente:</span>{" "}
                {caseInfo.client_name}
              </p>
            )}
            {caseInfo.status && (
              <p>
                <span className="font-medium text-foreground">Status:</span>{" "}
                {caseInfo.status}
              </p>
            )}
            {caseInfo.case_number && (
              <p>
                <span className="font-medium text-foreground">Nº processo:</span>{" "}
                {caseInfo.case_number}
              </p>
            )}
            {caseInfo.case_type && (
              <p>
                <span className="font-medium text-foreground">Tipo:</span>{" "}
                {caseInfo.case_type}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Documentos do caso</CardTitle>
            <CardDescription>
              Selecione os arquivos para basear a busca.
            </CardDescription>
            <div className="space-y-2 pt-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative w-full">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} —{" "}
                            {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yy", { locale: ptBR })
                        )
                      ) : (
                        <span>Filtrar por data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  {dateRange && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setDateRange(undefined)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-3 text-xs">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onSelectAll}
                >
                  Marcar todos
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={onDeselectAll}
                >
                  Desmarcar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-2">
            <ScrollArea className="h-[40vh] pr-2">
              <div className="space-y-1">
                {filteredDocs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum documento pronto encontrado.
                  </p>
                ) : (
                  filteredDocs.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selectedDocIds.has(d.id)}
                        onCheckedChange={() => onToggleSelect(d.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{d.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.created_at
                            ? new Date(d.created_at).toLocaleDateString("pt-BR")
                            : ""}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      {/* Main chat */}
      <div className="flex min-h-0 flex-col lg:col-span-2">
        <div className="flex flex-1 flex-col rounded-xl border bg-card">
          {pendingDocs > 0 && (
            <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {pendingDocs} documento(s) ainda sendo indexado(s) — as respostas
                podem ficar incompletas até o processamento concluir.
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="truncate font-semibold">JurisMind AI</p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedDocIds.size > 0
                  ? `${selectedDocIds.size} documento(s) selecionado(s)`
                  : `Busca em todos os ${readyDocs.length} documento(s) prontos`}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 text-primary" />
                <p className="font-medium text-foreground">
                  Pergunte sobre os documentos do caso
                </p>
                <p className="max-w-md text-sm">
                  O JurisMind busca os trechos relevantes, responde citando as
                  fontes e pode criar prazos na sua agenda.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                    {m.images && m.images.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.images.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`anexo ${idx + 1}`}
                            className="h-24 w-24 rounded border object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {m.steps?.map((s, idx) => {
                      try {
                        const r = JSON.parse(s.result_json) as {
                          kind?: string;
                          titulo?: string;
                          conteudo?: string;
                          rows?: Array<Record<string, unknown>>;
                          title?: string;
                          subtitle?: string;
                          slides?: Array<{ title?: string; content?: string[] }>;
                        };
                        if (r.kind === "petition")
                          return (
                            <PetitionCard
                              key={idx}
                              titulo={r.titulo ?? "Petição"}
                              conteudo={r.conteudo ?? ""}
                            />
                          );
                        if (r.kind === "table")
                          return (
                            <TableCard
                              key={idx}
                              titulo={r.titulo ?? "Tabela"}
                              rows={r.rows ?? []}
                            />
                          );
                        if (r.kind === "presentation")
                          return (
                            <PresentationCard
                              key={idx}
                              title={r.title ?? "Apresentação"}
                              subtitle={r.subtitle}
                              slides={r.slides ?? []}
                            />
                          );
                      } catch {
                        // ignore
                      }
                      return null;
                    })}
                    {m.citations && m.citations.length > 0 && (
                      <SourcesBlock citations={m.citations} />
                    )}
                    {m.steps && m.steps.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-border/40 pt-2">
                        <p className="text-xs font-semibold opacity-70">
                          Ferramentas usadas:
                        </p>
                        {m.steps.map((s, idx) => (
                          <div key={idx} className="text-xs opacity-80">
                            ✓ {friendlyToolName(s.name)}
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
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img src={src} alt="" className="h-16 w-16 rounded border object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  onPickImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy || images.length >= 6}
                title="Anexar imagens"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Pergunte, peça uma minuta de petição, planilha ou apresentação…"
                rows={2}
                className="resize-none"
                disabled={busy}
              />
              <Button
                onClick={send}
                disabled={busy || (!input.trim() && images.length === 0)}
                size="icon"
                className="h-auto"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  create_petition: "Minuta de petição",
  create_table: "Planilha gerada",
  create_presentation: "Apresentação gerada",
  search_documents: "Busca em documentos",
  create_task: "Tarefa criada",
};

function friendlyToolName(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function SourcesBlock({
  citations,
}: {
  citations: Array<{ filename: string; similarity: number }>;
}) {
  const [open, setOpen] = useState(false);
  // Dedupe by filename, keep highest similarity
  const unique = Array.from(
    citations
      .reduce((acc, c) => {
        const prev = acc.get(c.filename);
        if (!prev || prev.similarity < c.similarity) acc.set(c.filename, c);
        return acc;
      }, new Map<string, { filename: string; similarity: number }>())
      .values(),
  );
  return (
    <div className="mt-3 border-t border-border/40 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold opacity-70 hover:opacity-100"
      >
        <span>
          Fontes ({unique.length}
          {unique.length !== citations.length ? ` · ${citations.length} trechos` : ""})
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {unique.map((c, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs opacity-80">
              <FileText className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {c.filename}
                <span className="ml-1 opacity-60">
                  ({Math.round(c.similarity * 100)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
