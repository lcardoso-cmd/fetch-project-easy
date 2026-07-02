import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askWithRag } from "@/lib/chat.functions";
import { getThreadMessages } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Maximize2,
  Mic,
  Search,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { DocItem } from "@/components/documents/document-list";
import {
  PDFCard,
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

type ModelTier = "fast" | "balanced" | "max";

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  {
    label: "Resumo do caso",
    prompt:
      "Faça um resumo executivo do caso em até 10 linhas: partes, objeto, pedidos, valor envolvido e estágio atual. Cite as fontes com [n].",
  },
  {
    label: "Linha do tempo",
    prompt:
      "Monte uma linha do tempo cronológica dos principais atos processuais e fatos relevantes, com datas (dd/mm/aaaa) e fonte [n] de cada item.",
  },
  {
    label: "Pontos críticos",
    prompt:
      "Liste os pontos críticos, riscos e teses adversas mais fortes contra a parte representada, com nível de risco (alto/médio/baixo) e citação das fontes.",
  },
  {
    label: "Análise de risco",
    prompt:
      "Faça uma análise de risco completa em tabela: cenário, probabilidade (alta/média/baixa), impacto financeiro estimado, medida mitigadora e fonte [n].",
  },
  {
    label: "Quesitos periciais",
    prompt:
      "Proponha 12 quesitos periciais técnicos pertinentes ao objeto da causa, organizados por tema e fundamentados nos documentos.",
  },
  {
    label: "Petição inicial",
    prompt:
      "Use create_petition para redigir uma petição inicial COMPLETA (endereçamento, qualificação das partes, fatos, fundamentos jurídicos com citações doutrinárias/legais, pedidos e valor da causa) a partir dos documentos selecionados. Use HTML semântico simples.",
  },
  {
    label: "Contestação",
    prompt:
      "Use create_petition para redigir contestação completa com preliminares (se houver), impugnação dos fatos, teses de mérito, pedidos e requerimentos finais.",
  },
  {
    label: "Manifestação técnica",
    prompt:
      "Use create_petition para elaborar manifestação técnica respondendo aos pontos centrais do laudo, com tópicos e fundamentação técnica e jurídica.",
  },
  {
    label: "Contrarrazões",
    prompt:
      "Use create_petition para redigir contrarrazões de recurso, atacando tese por tese, com fundamentação e pedido de improvimento.",
  },
  {
    label: "Alegações finais",
    prompt:
      "Use create_petition para redigir alegações finais/memoriais escritos, revisando as provas produzidas e reforçando os pedidos.",
  },
  {
    label: "Notificação extrajudicial",
    prompt:
      "Use create_petition para redigir notificação extrajudicial formal com os fatos, base jurídica e prazo para atendimento.",
  },
  {
    label: "Parecer técnico",
    prompt:
      "Use create_petition para produzir parecer jurídico técnico com fundamentação doutrinária, jurisprudencial e conclusão objetiva.",
  },
  {
    label: "Planilha de cálculo",
    prompt:
      "Use create_table para gerar planilha detalhada com os valores envolvidos no caso (rubrica, base de cálculo, índice, valor original, valor corrigido, total).",
  },
  {
    label: "Apresentação",
    prompt:
      "Use create_presentation para preparar apresentação executiva com 10 slides cobrindo: contexto, partes, fatos, teses da parte, teses adversas, prova produzida, pontos críticos, valores, estratégia e próximos passos.",
  },
  {
    label: "Extrair partes",
    prompt:
      "Use create_table para gerar quadro completo das partes envolvidas (nome, qualificação, CPF/CNPJ, endereço, papel processual, advogado). Extraia dos documentos.",
  },
  {
    label: "Extrair prazos",
    prompt:
      "Liste todos os prazos processuais e datas relevantes identificados nos documentos, e para cada um chame create_event para criar um lembrete na agenda (5 dias úteis antes).",
  },
];

const MODEL_LABELS: Record<ModelTier, string> = {
  fast: "Rápido",
  balanced: "Balanceado",
  max: "Máximo",
};

export function JurisMindChat({
  caseId,
  caseInfo,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  fullscreen = false,
  threadId,
  onThreadCreated,
}: {
  caseId: string;
  caseInfo: CaseSummary;
  documents: DocItem[];
  selectedDocIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  fullscreen?: boolean;
  threadId?: string | null;
  onThreadCreated?: (id: string) => void;
}) {
  const askFn = useServerFn(askWithRag);
  const getMessagesFn = useServerFn(getThreadMessages);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [images, setImages] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [modelTier, setModelTier] = useState<ModelTier>(() => {
    if (typeof window === "undefined") return "fast";
    return (localStorage.getItem("jurismind:model") as ModelTier) || "fast";
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jurismind:model", modelTier);
    }
  }, [modelTier]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Carregar histórico ao trocar de thread
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getMessagesFn({ data: { thread_id: threadId } });
        if (cancelled) return;
        setMessages(
          rows.map((r) => ({
            role: r.role,
            content: r.content,
            images: r.images ?? undefined,
            citations: (r.citations as unknown as Citation[]) ?? undefined,
            steps: (r.tool_steps as unknown as ToolStep[]) ?? undefined,
          })),
        );
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Erro ao carregar conversa",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, getMessagesFn]);

  // Gravação de voz -> transcrição via /api/tools/transcribe
  const startRecording = async () => {
    if (recording || transcribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) {
          toast.error("Áudio muito curto.");
          return;
        }
        setTranscribing(true);
        try {
          const b64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(r.error);
            r.onload = () => {
              const s = String(r.result);
              resolve(s.slice(s.indexOf(",") + 1));
            };
            r.readAsDataURL(blob);
          });
          const res = await fetch("/api/tools/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_base64: b64, format: "webm" }),
          });
          const json = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || json.error) throw new Error(json.error ?? "falha");
          const text = (json.text ?? "").trim();
          if (!text) {
            toast.error("Não consegui transcrever o áudio.");
            return;
          }
          setInput((prev) => (prev ? prev + " " + text : text));
          setTimeout(() => inputRef.current?.focus(), 30);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao transcrever");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível acessar o microfone",
      );
    }
  };
  const stopRecording = () => {
    if (!recording) return;
    recorderRef.current?.stop();
    setRecording(false);
  };


  const readFilesAsImages = async (files: File[]) => {
    const list: string[] = [];
    for (const f of files.slice(0, 6 - images.length)) {
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
    if (list.length) setImages((prev) => [...prev, ...list]);
  };

  const onPickImages = (files: FileList | null) => {
    if (!files) return;
    void readFilesAsImages(Array.from(files));
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

  const send = async (overridePrompt?: string) => {
    const q = (overridePrompt ?? input).trim();
    if ((!q && images.length === 0) || busy) return;
    if (!overridePrompt) setInput("");
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
          model_tier: modelTier,
          thread_id: threadId ?? undefined,
        },
      });
      if (res.thread_id && res.thread_id !== threadId) {
        onThreadCreated?.(res.thread_id);
      }
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.answer,
          citations: res.citations,
          steps: res.steps,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages([...next, { role: "assistant", content: `Erro: ${msg}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Drag & drop and paste of images anywhere in the chat area
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void readFilesAsImages(files);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      void readFilesAsImages(Array.from(e.dataTransfer.files));
    };
    const prevent = (e: DragEvent) => e.preventDefault();
    el.addEventListener("paste", onPaste);
    el.addEventListener("drop", onDrop);
    el.addEventListener("dragover", prevent);
    return () => {
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragover", prevent);
    };
  }, [images.length]);

  return (
    <div
      ref={chatRef}
      className="grid h-full min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-3"
    >
      {/* Sidebar */}
      <aside className="flex min-h-0 flex-col gap-4 lg:col-span-1">
        <Card className="shrink-0">
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
            {caseInfo.represented_party?.name && (
              <p>
                <span className="font-medium text-foreground">
                  Parte representada:
                </span>{" "}
                {caseInfo.represented_party.name}
                {caseInfo.represented_party.role
                  ? ` (${caseInfo.represented_party.role})`
                  : ""}
              </p>
            )}
            {caseInfo.case_number && (
              <p>
                <span className="font-medium text-foreground">Nº processo:</span>{" "}
                {caseInfo.case_number}
              </p>
            )}
            {caseInfo.jurisdiction && (
              <p>
                <span className="font-medium text-foreground">Jurisdição:</span>{" "}
                {caseInfo.jurisdiction}
              </p>
            )}
            {caseInfo.case_type && (
              <p>
                <span className="font-medium text-foreground">Tipo:</span>{" "}
                {caseInfo.case_type}
              </p>
            )}
            {caseInfo.parties && caseInfo.parties.length > 0 && (
              <div className="pt-1">
                <p className="mb-1 font-medium text-foreground">
                  Partes envolvidas
                </p>
                <ul className="space-y-0.5 text-xs">
                  {caseInfo.parties.map((p, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                        {p.role}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Documentos do caso</CardTitle>
            <CardDescription>
              Todos vêm marcados. Desmarque para focar em alguns.
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
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
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
          </CardContent>
        </Card>
      </aside>

      {/* Main chat */}
      <div className="flex min-h-0 flex-col lg:col-span-2">
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
          {pendingDocs > 0 && (
            <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {pendingDocs} documento(s) ainda sendo indexado(s) — as respostas
                podem ficar incompletas até o processamento concluir.
              </span>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">JurisMind AI</p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedDocIds.size > 0
                  ? `${selectedDocIds.size} de ${readyDocs.length} documento(s) selecionado(s)`
                  : `Sem seleção — vai buscar em todos os ${readyDocs.length} documento(s)`}
              </p>
            </div>
            <Select
              value={modelTier}
              onValueChange={(v) => setModelTier(v as ModelTier)}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue>{MODEL_LABELS[modelTier]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="fast">Rápido · Flash</SelectItem>
                <SelectItem value="balanced">Balanceado · 2.5 Flash</SelectItem>
                <SelectItem value="max">Máximo · 2.5 Pro</SelectItem>
              </SelectContent>
            </Select>
            {!fullscreen && (
              <Button asChild variant="ghost" size="icon" title="Abrir em tela cheia">
                <Link to="/cases/$caseId/chat" params={{ caseId }}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 text-primary" />
                <p className="font-medium text-foreground">
                  Pergunte sobre os documentos do caso
                </p>
                <p className="max-w-md text-sm">
                  O JurisMind já sabe que você está trabalhando em <span className="font-medium text-foreground">{caseInfo.title}</span>. Pergunte, peça peças jurídicas, planilhas, apresentações, PDFs — tudo direto do caso.
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
                      "max-w-[92%] rounded-lg px-4 py-3 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
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
                              titulo={r.titulo ?? "Peça jurídica"}
                              conteudo={r.conteudo ?? ""}
                            />
                          );
                        if (r.kind === "pdf")
                          return (
                            <PDFCard
                              key={idx}
                              titulo={r.titulo ?? "Documento"}
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

          <div className="shrink-0 border-t p-3">
            {messages.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    type="button"
                    disabled={busy}
                    onClick={() => send(qa.prompt)}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}
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
            <div className="flex items-end gap-2">
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
                title="Anexar imagens (ou arraste / cole)"
                className="h-10 w-10 shrink-0"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={recording ? "destructive" : "outline"}
                onClick={() => (recording ? stopRecording() : void startRecording())}
                disabled={busy || transcribing}
                title={recording ? "Parar gravação" : "Ditar mensagem"}
                className="h-10 w-10 shrink-0"
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : recording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Pergunte, peça peça jurídica, planilha, apresentação ou PDF…"
                rows={2}
                className="min-h-[42px] resize-none"
                disabled={busy}
              />
              <Button
                onClick={() => void send()}
                disabled={busy || (!input.trim() && images.length === 0)}
                size="icon"
                className="h-10 w-10 shrink-0"
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
  create_petition: "Peça jurídica (Word)",
  create_pdf: "Documento (PDF)",
  create_table: "Planilha (Excel)",
  create_presentation: "Apresentação (PPTX)",
  create_event: "Evento na agenda",
  create_task: "Tarefa criada",
  list_case_events: "Consultou eventos do caso",
  list_case_tasks: "Consultou tarefas do caso",
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
