import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getThreadMessages, getMessageAudioUrl } from "@/lib/threads.functions";
import { getDocumentUrl } from "@/lib/documents.functions";
import { decideCaseUpdateProposal, getCaseUpdateProposalStatus } from "@/lib/case-updates.functions";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BrainCircuit,
  CalendarIcon,
  ChevronDown,
  FileText,
  ImagePlus,
  Loader2,
  Maximize2,
  Mic,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings2,
  Square,
  X,
  FolderOpen,
  BriefcaseBusiness,
  Eye,
  Files,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  CheckCircle2,
  ExternalLink,
  Gavel,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import {
  blobToBase64,
  concatFloat32,
  downsampleTo,
  encodeWavPcm16,
  rmsOf,
} from "@/lib/audio/wav-encoder";

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
import type { DocItem } from "@/components/documents/document-list";
import {
  PDFCard,
  PetitionCard,
  PresentationCard,
  TableCard,
} from "@/components/chat/artifact-cards";
import { toast } from "sonner";
import { isDocUsable } from "@/lib/documents/usable";
import { SourcesBlock } from "@/components/chat/sources-block";


interface Citation {
  ref?: string;
  chunk_id?: string;
  document_id: string;
  filename: string;
  snippet: string;
  location?: string | null;
  source_kind?: string;
  is_context?: boolean;
}
interface ToolStep {
  name: string;
  args_json: string;
  result_json: string;
}
interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  citations?: Citation[];
  steps?: ToolStep[];
  input_kind?: "text" | "voice";
  audio_path?: string | null;
  audio_duration_ms?: number | null;
  audio_blob_url?: string; // local playback for freshly sent audio
  reasoning?: string;
}

/** Precedente localizado em fonte oficial externa aos autos. */
interface JurisprudenceRef {
  ref: string;
  court: string;
  panel?: string | null;
  process_number?: string | null;
  date?: string | null;
  title: string;
  snippet: string;
  url: string;
  consulted_at: string;
}

interface ProcessConsultationResult {
  kind: "process_consultation";
  ok: boolean;
  proposal_id?: string;
  proposal_status?: "pending" | "applied" | "rejected";
  cnj: string;
  consulted_at: string;
  court?: string | null;
  degree?: string | null;
  class_name?: string | null;
  subjects?: string[];
  unit_name?: string | null;
  movements?: Array<{ date: string | null; name: string; complement: string | null; source: string; source_url: string | null }>;
  total_movements?: number;
  changes?: Array<{ field: string; label: string; current: string | null; proposed: string }>;
  sources?: Array<{ name: string; url: string; status: "ok" | "unavailable"; detail?: string }>;
  warnings?: string[];
  error?: string;
}

function parseToolResult(step: ToolStep): {
  kind?: string;
  titulo?: string;
  conteudo?: string;
  rows?: Array<Record<string, unknown>>;
  title?: string;
  subtitle?: string;
  slides?: Array<{ title?: string; content?: string[] }>;
  ok?: boolean;
  error?: string;
  query?: string;
  consulted_at?: string;
  results?: JurisprudenceRef[];
  proposal_id?: string;
  proposal_status?: "pending" | "applied" | "rejected";
  cnj?: string;
  court?: string | null;
  degree?: string | null;
  class_name?: string | null;
  subjects?: string[];
  unit_name?: string | null;
  movements?: ProcessConsultationResult["movements"];
  total_movements?: number;
  changes?: ProcessConsultationResult["changes"];
  sources?: ProcessConsultationResult["sources"];
  warnings?: string[];
} | null {
  try {
    return JSON.parse(step.result_json) as {
      kind?: string;
      titulo?: string;
      conteudo?: string;
      rows?: Array<Record<string, unknown>>;
      title?: string;
      subtitle?: string;
      slides?: Array<{ title?: string; content?: string[] }>;
      ok?: boolean;
      error?: string;
      query?: string;
      consulted_at?: string;
      results?: JurisprudenceRef[];
      proposal_id?: string;
      proposal_status?: "pending" | "applied" | "rejected";
      cnj?: string;
      court?: string | null;
      degree?: string | null;
      class_name?: string | null;
      subjects?: string[];
      unit_name?: string | null;
      movements?: ProcessConsultationResult["movements"];
      total_movements?: number;
      changes?: ProcessConsultationResult["changes"];
      sources?: ProcessConsultationResult["sources"];
      warnings?: string[];
    };
  } catch {
    return null;
  }
}


function getGeneratedDocumentKey(step: ToolStep): string | null {
  const result = parseToolResult(step);
  if (!result || (result.kind !== "petition" && result.kind !== "pdf")) return null;
  const body = (result.conteudo ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return body || `${result.kind}:${result.titulo ?? ""}`;
}

function dedupeGeneratedDocumentSteps(steps: ToolStep[]): ToolStep[] {
  const byKey = new Map<string, number>();
  const out: ToolStep[] = [];
  for (const step of steps) {
    const key = getGeneratedDocumentKey(step);
    if (!key) {
      out.push(step);
      continue;
    }
    const existingIndex = byKey.get(key);
    if (existingIndex == null) {
      byKey.set(key, out.length);
      out.push(step);
      continue;
    }
    const existing = parseToolResult(out[existingIndex]);
    const current = parseToolResult(step);
    if (existing?.kind === "pdf" && current?.kind === "petition") {
      out[existingIndex] = step;
    }
  }
  return out;
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

type QuickAction = { label: string; prompt: string };

// --- Retentativa automática da transcrição ---
const TRANSCRIBE_MAX_ATTEMPTS = 3;
const TRANSCRIBE_BACKOFF_MS = [500, 1200, 2500];
const SEGMENT_TIMEOUT_MS = 15_000;
const RETRYABLE_TRANSCRIBE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isRetryableTranscribeStatus(status: number): boolean {
  return RETRYABLE_TRANSCRIBE_STATUSES.has(status);
}

function computeBackoffDelay(attempt: number, retryAfterMs?: number): number {
  const base =
    TRANSCRIBE_BACKOFF_MS[Math.min(attempt - 1, TRANSCRIBE_BACKOFF_MS.length - 1)] ??
    2500;
  const jitter = base * (0.8 + Math.random() * 0.4);
  return Math.max(jitter, retryAfterMs ?? 0);
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const sec = Number(header);
  if (Number.isFinite(sec)) return Math.max(0, sec * 1000);
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}



const PRIMARY_ACTIONS: QuickAction[] = [
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
    label: "Extrair prazos",
    prompt:
      "Liste todos os prazos processuais e datas relevantes identificados nos documentos, e para cada um chame create_event para criar um lembrete na agenda (5 dias úteis antes).",
  },
];

const ACTION_GROUPS: Array<{ label: string; actions: QuickAction[] }> = [
  {
    label: "Peças jurídicas",
    actions: [
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
    ],
  },
  {
    label: "Perícia / Técnica",
    actions: [
      {
        label: "Quesitos periciais",
        prompt:
          "Proponha 12 quesitos periciais técnicos pertinentes ao objeto da causa, organizados por tema e fundamentados nos documentos.",
      },
      {
        label: "Manifestação técnica",
        prompt:
          "Use create_petition para elaborar manifestação técnica respondendo aos pontos centrais do laudo, com tópicos e fundamentação técnica e jurídica.",
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
    ],
  },
  {
    label: "Utilidades",
    actions: [
      {
        label: "Extrair partes",
        prompt:
          "Use create_table para gerar quadro completo das partes envolvidas (nome, qualificação, CPF/CNPJ, endereço, papel processual, advogado). Extraia dos documentos.",
      },
    ],
  },
];

const MODEL_LABELS: Record<ModelTier, string> = {
  fast: "Rápido",
  balanced: "Balanceado",
  max: "Máximo",
};

function formatDurationMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VoiceMessagePlayback({
  messageId,
  audioBlobUrl,
  hasAudio,
  durationMs,
  getAudioUrl,
}: {
  messageId?: string;
  audioBlobUrl?: string;
  hasAudio: boolean;
  durationMs: number | null;
  getAudioUrl: (opts: { data: { message_id: string } }) => Promise<{ url: string }>;
}) {
  const [url, setUrl] = useState<string | null>(audioBlobUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dur = formatDurationMs(durationMs);

  const load = async () => {
    if (url || !messageId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAudioUrl({ data: { message_id: messageId } });
      setUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar áudio.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasAudio) {
    return (
      <div className="mb-2 flex items-center gap-1.5 text-2xs opacity-80">
        <Mic className="h-3 w-3" />
        <span>Ditado por voz{dur ? ` · ${dur}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-2xs opacity-80">
        <Mic className="h-3 w-3" />
        <span>Ditado por voz{dur ? ` · ${dur}` : ""}</span>
      </div>
      {url ? (
        <audio
          controls
          src={url}
          className="h-8 w-full max-w-[280px]"
          preload="none"
        />
      ) : (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex w-fit items-center gap-1 rounded-md bg-background/20 px-2 py-1 text-2xs hover:bg-background/30 disabled:opacity-60"
        >
          {loading ? "Carregando…" : error ?? "Ouvir áudio"}
        </button>
      )}
    </div>
  );
}


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
  initialPrompt,
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
  /** Pedido pré-preenchido no campo de mensagem (atalhos do caso). */
  initialPrompt?: string | null;
}) {

  // askFn removido: agora usamos SSE em /api/chat/stream (streaming token-a-token)
  const getMessagesFn = useServerFn(getThreadMessages);
  const getAudioUrlFn = useServerFn(getMessageAudioUrl);
  const getDocumentUrlFn = useServerFn(getDocumentUrl);
  const pendingAudioRef = useRef<{ blob: Blob; durationMs: number } | null>(null);
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
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);
  const silenceSinceRef = useRef<number | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micSilent, setMicSilent] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // --- Live transcription (streaming) refs ---
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSampleRateRef = useRef<number>(48000);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSegCtrlRef = useRef<AbortController | null>(null);
  const baseInputRef = useRef<string>("");
  const committedRef = useRef<string>("");
  const livePartialRef = useRef<string>("");
  const [segmentInFlight, setSegmentInFlight] = useState(false);
  const liveSupportedRef = useRef<boolean>(true);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; max: number } | null>(null);
  const consecutiveSegmentFailuresRef = useRef<number>(0);

  // Atalho do caso: pré-preenche o pedido no campo de mensagem.
  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);




  // Seletor de microfone
  const MIC_STORAGE_KEY = "jurismind:mic-device-id";
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(MIC_STORAGE_KEY);
  });
  const [micPickerOpen, setMicPickerOpen] = useState(false);
  const [micLabelsUnlocked, setMicLabelsUnlocked] = useState(false);
  const [unlockingLabels, setUnlockingLabels] = useState(false);

  const [modelTier, setModelTier] = useState<ModelTier>(() => {
    if (typeof window === "undefined") return "fast";
    return (localStorage.getItem("jurismind:model") as ModelTier) || "fast";
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const micErrorRef = useRef<HTMLDivElement>(null);
  const [srStatus, setSrStatus] = useState<string>("");
  const prevMicErrorRef = useRef<string | null>(null);
  const prevTranscribingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jurismind:model", modelTier);
    }
  }, [modelTier]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Compose a screen-reader status string from recording/transcription state.
  useEffect(() => {
    let msg = "";
    if (recording) {
      if (micSilent) {
        msg = "Gravando. Microfone silencioso, verifique o dispositivo.";
      } else if (segmentInFlight) {
        msg = "Gravando. Transcrevendo em tempo real.";
      } else {
        msg = "Gravando.";
      }
    } else if (transcribing) {
      msg = "Transcrevendo áudio, aguarde.";
    } else if (prevTranscribingRef.current) {
      msg = "Transcrição concluída.";
      const t = setTimeout(() => setSrStatus(""), 2000);
      prevTranscribingRef.current = false;
      setSrStatus(msg);
      return () => clearTimeout(t);
    }
    prevTranscribingRef.current = transcribing;
    setSrStatus(msg);
  }, [recording, transcribing, micSilent, segmentInFlight]);

  // Move focus to the mic error banner when it appears; return focus to the
  // mic button when it is dismissed.
  useEffect(() => {
    const prev = prevMicErrorRef.current;
    if (micError && !prev) {
      // Defer to next tick so the element exists in the DOM.
      const id = window.setTimeout(() => {
        micErrorRef.current?.focus({ preventScroll: false });
      }, 0);
      prevMicErrorRef.current = micError;
      return () => window.clearTimeout(id);
    }
    if (!micError && prev) {
      micButtonRef.current?.focus({ preventScroll: true });
    }
    prevMicErrorRef.current = micError;
  }, [micError]);

  // ---------- Enumeração de microfones ----------
  const refreshMics = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setMics(inputs);
      if (inputs.some((d) => d.label)) setMicLabelsUnlocked(true);
      if (
        selectedMicId &&
        inputs.length > 0 &&
        !inputs.some((d) => d.deviceId === selectedMicId)
      ) {
        setSelectedMicId(null);
        try {
          localStorage.removeItem(MIC_STORAGE_KEY);
        } catch {}
      }
    } catch {
      // silencioso — sem permissão ainda
    }
  };

  const unlockMicLabels = async () => {
    if (unlockingLabels) return;
    setUnlockingLabels(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      await refreshMics();
    } catch (e) {
      toast.error(humanizeMicError(e));
    } finally {
      setUnlockingLabels(false);
    }
  };

  const chooseMic = (deviceId: string | null) => {
    setSelectedMicId(deviceId);
    try {
      if (deviceId) localStorage.setItem(MIC_STORAGE_KEY, deviceId);
      else localStorage.removeItem(MIC_STORAGE_KEY);
    } catch {}
    setMicPickerOpen(false);
    const label = deviceId
      ? mics.find((d) => d.deviceId === deviceId)?.label || "dispositivo selecionado"
      : "padrão do sistema";
    setSrStatus(`Microfone alterado para ${label}.`);
    window.setTimeout(() => setSrStatus((s) => (s.startsWith("Microfone alterado") ? "" : s)), 2000);
  };

  useEffect(() => {
    void refreshMics();
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const handler = () => void refreshMics();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            id: r.id,
            role: r.role,
            content: r.content,
            images: r.images ?? undefined,
            citations: (r.citations as unknown as Citation[]) ?? undefined,
            steps: (r.tool_steps as unknown as ToolStep[]) ?? undefined,
            input_kind: (r.input_kind ?? undefined) as
              | "text"
              | "voice"
              | undefined,
            audio_path: r.audio_path ?? undefined,
            audio_duration_ms: r.audio_duration_ms ?? undefined,
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

  // ---------- Gravação de voz -> transcrição ----------
  const MAX_RECORDING_MS = 60_000;

  const cleanupAudioMonitor = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    try {
      activeSegCtrlRef.current?.abort();
    } catch {}
    activeSegCtrlRef.current = null;
    pcmChunksRef.current = [];
    setSegmentInFlight(false);
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    silenceSinceRef.current = null;
    setAudioLevel(0);
    setMicSilent(false);
  };

  // Reflete base + committed + partial no textarea sem sobrescrever edições do usuário fora dos segmentos.
  const syncLiveInput = () => {
    const parts = [
      baseInputRef.current.trim(),
      committedRef.current.trim(),
      livePartialRef.current.trim(),
    ].filter(Boolean);
    setInput(parts.join(" "));
  };

  const setPartial = (text: string) => {
    livePartialRef.current = text;
    syncLiveInput();
  };

  const appendCommitted = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    committedRef.current = committedRef.current
      ? committedRef.current + " " + clean
      : clean;
    livePartialRef.current = "";
    syncLiveInput();
  };

  // Executa uma única tentativa de transcrição de segmento.
  // Retorna { ok, text } em sucesso, ou lança { retryable, status?, retryAfterMs?, cause } em falha.
  const runTranscribeAttempt = async (
    b64: string,
    outerSignal: AbortSignal,
    onDelta: (text: string) => void,
  ): Promise<string> => {
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), SEGMENT_TIMEOUT_MS);
    const onOuterAbort = () => timeoutCtrl.abort();
    outerSignal.addEventListener("abort", onOuterAbort, { once: true });

    let segmentText = "";
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sess.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`;
      const res = await fetch("/api/tools/transcribe-stream", {
        method: "POST",
        headers,
        body: JSON.stringify({ audio_base64: b64, format: "wav" }),
        signal: timeoutCtrl.signal,
      });

      if (!res.ok || !res.body) {
        const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
        const err = new Error(`transcribe_http_${res.status}`) as Error & {
          status?: number;
          retryable?: boolean;
          retryAfterMs?: number;
        };
        err.status = res.status;
        err.retryable = isRetryableTranscribeStatus(res.status);
        err.retryAfterMs = retryAfterMs;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = raw
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line) as {
              type?: string;
              delta?: string;
              text?: string;
            };
            if (evt.type === "transcript.text.delta" && evt.delta) {
              segmentText += evt.delta;
              onDelta(segmentText);
            } else if (evt.type === "transcript.text.done") {
              segmentText = evt.text ?? segmentText;
            }
          } catch {
            // ignore
          }
        }
      }
      return segmentText;
    } catch (e) {
      // Distinguir aborto externo vs. timeout interno
      if ((e as { name?: string })?.name === "AbortError") {
        if (outerSignal.aborted) {
          // cancelamento explícito — não retry
          throw e;
        }
        // timeout interno — retryable
        const err = new Error("transcribe_timeout") as Error & {
          retryable?: boolean;
        };
        err.retryable = true;
        throw err;
      }
      // erro de rede (TypeError do fetch) — retryable
      if (!(e as { status?: number })?.status) {
        (e as { retryable?: boolean }).retryable = true;
      }
      throw e;
    } finally {
      clearTimeout(timer);
      outerSignal.removeEventListener("abort", onOuterAbort);
    }
  };

  // Envia um segmento WAV com retentativa automática (backoff).
  const flushSegment = async (final: boolean): Promise<void> => {
    const srcRate = pcmSampleRateRef.current;
    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    if (chunks.length === 0) return;
    const merged = concatFloat32(chunks);
    // Descarta segmento muito curto (<400ms) se não for final.
    const minSamples = Math.floor(srcRate * 0.4);
    if (!final && merged.length < minSamples) {
      // devolve os chunks para o próximo flush não perder áudio
      pcmChunksRef.current.unshift(merged);
      return;
    }
    // Silêncio? Descarta.
    if (rmsOf(merged) < 0.008) return;

    const down = downsampleTo(merged, srcRate, 16000);
    const wav = encodeWavPcm16(down, 16000);
    if (wav.size < 1024) return;
    const b64 = await blobToBase64(wav);

    // Segmentos sequenciais: aborta o anterior se ainda não terminou.
    try {
      activeSegCtrlRef.current?.abort();
    } catch {}
    const ctrl = new AbortController();
    activeSegCtrlRef.current = ctrl;
    setSegmentInFlight(true);

    let lastText = "";
    let lastError: (Error & { status?: number; retryable?: boolean; retryAfterMs?: number }) | null = null;

    try {
      for (let attempt = 1; attempt <= TRANSCRIBE_MAX_ATTEMPTS; attempt++) {
        if (attempt > 1 && final) {
          setRetryInfo({ attempt, max: TRANSCRIBE_MAX_ATTEMPTS });
        }
        try {
          const text = await runTranscribeAttempt(b64, ctrl.signal, (t) => {
            lastText = t;
            setPartial(t);
          });
          lastText = text || lastText;
          appendCommitted(lastText);
          consecutiveSegmentFailuresRef.current = 0;
          lastError = null;
          return;
        } catch (e) {
          const err = e as Error & { name?: string; status?: number; retryable?: boolean; retryAfterMs?: number };
          if (err?.name === "AbortError" && ctrl.signal.aborted) {
            // Cancelado externamente (novo segmento, parar, cancelar) — não retry, não erro.
            return;
          }
          lastError = err;
          const canRetry = err.retryable === true && attempt < TRANSCRIBE_MAX_ATTEMPTS;
          if (!canRetry) break;
          const delay = computeBackoffDelay(attempt, err.retryAfterMs);
          try {
            await sleepWithAbort(delay, ctrl.signal);
          } catch {
            return; // aborted durante o sleep
          }
        }
      }

      // Esgotou tentativas ou erro não-retryable.
      if (lastError) {
        const status = lastError.status;
        if (status === 402) {
          toast.error("Créditos de IA esgotados.");
        } else if (final) {
          toast.error(humanizeTranscribeError(status ?? 0, lastError.message));
        } else {
          // Falha silenciosa em segmento parcial — só sinaliza depois de 2 seguidos.
          consecutiveSegmentFailuresRef.current += 1;
          if (consecutiveSegmentFailuresRef.current >= 2) {
            setMicError(
              "Instabilidade na transcrição — verifique a conexão. Continuarei tentando.",
            );
          }
        }
      }
    } finally {
      setRetryInfo(null);
      if (activeSegCtrlRef.current === ctrl) {
        activeSegCtrlRef.current = null;
        setSegmentInFlight(false);
      }
    }
  };




  const humanizeMicError = (e: unknown): string => {
    const err = e as { name?: string; message?: string } | undefined;
    const name = err?.name ?? "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError")
      return "Permissão de microfone negada. Habilite nas configurações do navegador.";
    if (name === "NotFoundError" || name === "DevicesNotFoundError")
      return "Nenhum microfone encontrado neste dispositivo.";
    if (name === "NotReadableError" || name === "TrackStartError")
      return "Microfone ocupado por outro aplicativo.";
    if (name === "OverconstrainedError")
      return "Configuração do microfone não suportada.";
    if (name === "SecurityError")
      return "Gravação bloqueada pelo navegador (contexto não seguro).";
    return err?.message || "Não foi possível acessar o microfone.";
  };

  const humanizeTranscribeError = (
    status: number,
    apiMsg?: string,
  ): string => {
    if (status === 401 || status === 403)
      return "Sessão expirada. Faça login novamente.";
    if (status === 413) return "Áudio muito grande. Grave um trecho mais curto.";
    if (status === 429) return "Muitas requisições. Aguarde alguns segundos.";
    if (status >= 500) return "Falha no serviço de transcrição. Tente novamente.";
    return apiMsg || "Não foi possível transcrever o áudio.";
  };

  const startRecording = async () => {
    if (recording || transcribing) return;
    setMicError(null);
    consecutiveSegmentFailuresRef.current = 0;
    setRetryInfo(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Seu navegador não suporta gravação de áudio.";
      setMicError(msg);
      toast.error(msg);
      return;
    }
    try {
      const buildConstraints = (deviceId: string | null): MediaStreamConstraints => ({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          buildConstraints(selectedMicId),
        );
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (
          selectedMicId &&
          (name === "OverconstrainedError" ||
            name === "NotFoundError" ||
            name === "NotReadableError")
        ) {
          try {
            localStorage.removeItem(MIC_STORAGE_KEY);
          } catch {}
          setSelectedMicId(null);
          toast.message(
            "Microfone selecionado indisponível — usando o padrão.",
          );
          stream = await navigator.mediaDevices.getUserMedia(
            buildConstraints(null),
          );
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      // Após conceder permissão, labels ficam disponíveis — re-enumera.
      void refreshMics();
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const durationMs = startedAtRef.current
          ? Date.now() - startedAtRef.current
          : 0;
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Preserva áudio para upload junto do envio (mesmo que a transcrição seja parcial).
        if (blob.size >= 500) {
          pendingAudioRef.current = { blob, durationMs };
        }
        // Não fecha o AudioContext aqui: o stopRecording já chamou o flush final.
        setTimeout(() => inputRef.current?.focus(), 30);
      };
      recorderRef.current = rec;
      rec.start();

      // Audio level monitor + PCM capture para transcrição parcial
      baseInputRef.current = input;
      committedRef.current = "";
      livePartialRef.current = "";
      pcmChunksRef.current = [];
      liveSupportedRef.current = true;
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          audioCtxRef.current = ctx;
          pcmSampleRateRef.current = ctx.sampleRate;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            const level = Math.min(1, rms * 2.5);
            setAudioLevel(level);
            const now = performance.now();
            if (level < 0.02) {
              if (silenceSinceRef.current == null) silenceSinceRef.current = now;
              if (now - silenceSinceRef.current > 2000) setMicSilent(true);
            } else {
              silenceSinceRef.current = null;
              setMicSilent(false);
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);

          // PCM processor para transcrição segmentada
          try {
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (ev) => {
              const ch = ev.inputBuffer.getChannelData(0);
              pcmChunksRef.current.push(new Float32Array(ch));
            };
            source.connect(processor);
            processor.connect(ctx.destination);
            processorRef.current = processor;
            // Dispara flush a cada 3s
            flushIntervalRef.current = setInterval(() => {
              void flushSegment(false);
            }, 3000);
          } catch {
            liveSupportedRef.current = false;
          }
        } else {
          liveSupportedRef.current = false;
        }
      } catch {
        liveSupportedRef.current = false;
      }

      startedAtRef.current = Date.now();
      setRecordingMs(0);
      timerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startedAtRef.current);
      }, 250);
      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          toast.message("Gravação encerrada aos 60s.");
          void stopRecording();
        }
      }, MAX_RECORDING_MS);

      setRecording(true);
    } catch (e) {
      cleanupAudioMonitor();
      const msg = humanizeMicError(e);
      setMicError(msg);
      toast.error(msg);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    // Para o timer/flush primeiro para não disparar novos segmentos.
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    // Desconecta o processor para congelar o buffer PCM.
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;

    // Flush final com timeout (não bloqueia UI por muito tempo).
    const finalFlush = flushSegment(true);
    await Promise.race([
      finalFlush,
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]).catch(() => {});

    try {
      recorderRef.current?.stop();
    } catch {}
    // cleanupAudioMonitor fecha o AudioContext e libera o mic.
    cleanupAudioMonitor();

    if (!committedRef.current.trim() && !livePartialRef.current.trim()) {
      // Nada foi transcrito — mostra dica leve, mas não trata como erro fatal.
      const msg =
        "Não consegui transcrever — fale mais próximo do microfone e tente de novo.";
      setMicError(msg);
    } else {
      setMicError(null);
    }
    livePartialRef.current = "";
  };


  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {}
      cleanupAudioMonitor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatRecordingTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
    () => documents.filter((d) => isDocUsable(d.processing_status)),
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

  const abortRef = useRef<AbortController | null>(null);

  const send = async (overridePrompt?: string) => {
    const q = (overridePrompt ?? input).trim();
    if ((!q && images.length === 0) || busy) return;
    if (!overridePrompt) setInput("");
    const sentImages = images;
    setImages([]);

    // Áudio pendente (apenas se este envio vem de um ditado por voz)
    const pendingAudio = overridePrompt ? null : pendingAudioRef.current;
    pendingAudioRef.current = null;
    const audioBlobUrl = pendingAudio
      ? URL.createObjectURL(pendingAudio.blob)
      : undefined;

    const userMsg: Msg = {
      role: "user",
      content: q || "(imagens enviadas)",
      images: sentImages,
      input_kind: pendingAudio ? "voice" : "text",
      audio_duration_ms: pendingAudio?.durationMs,
      audio_blob_url: audioBlobUrl,
    };
    // Placeholder do assistant que vai sendo preenchido pelos tokens
    const assistantIdx = messages.length + 1;
    const next: Msg[] = [
      ...messages,
      userMsg,
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setBusy(true);

    const selected = Array.from(selectedDocIds);

    const patchAssistant = (patch: Partial<Msg>) => {
      setMessages((prev) => {
        const copy = prev.slice();
        const cur = copy[assistantIdx];
        if (!cur || cur.role !== "assistant") return prev;
        copy[assistantIdx] = { ...cur, ...patch };
        return copy;
      });
    };
    const appendToken = (t: string) => {
      setMessages((prev) => {
        const copy = prev.slice();
        const cur = copy[assistantIdx];
        if (!cur || cur.role !== "assistant") return prev;
        copy[assistantIdx] = { ...cur, content: cur.content + t };
        return copy;
      });
    };
    const appendReasoning = (t: string) => {
      setMessages((prev) => {
        const copy = prev.slice();
        const cur = copy[assistantIdx];
        if (!cur || cur.role !== "assistant") return prev;
        copy[assistantIdx] = { ...cur, reasoning: (cur.reasoning ?? "") + t };
        return copy;
      });
    };

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      // Upload do áudio (best-effort) para o bucket `chat-audio`
      let uploadedAudioPath: string | undefined;
      if (pendingAudio) {
        try {
          const uid = sess.session?.user.id;
          if (uid) {
            const now = new Date();
            const path = `${uid}/${now.getFullYear()}-${String(
              now.getMonth() + 1,
            ).padStart(2, "0")}/${crypto.randomUUID()}.webm`;
            const { error: upErr } = await supabase.storage
              .from("chat-audio")
              .upload(path, pendingAudio.blob, {
                contentType: "audio/webm",
                upsert: false,
              });
            if (!upErr) uploadedAudioPath = path;
          }
        } catch {
          // se falhar o upload, seguimos sem áudio persistido
        }
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          case_id: caseId,
          question: q || "Analise as imagens enviadas.",
          selected_doc_ids: selected.length ? selected : undefined,
          images: sentImages.length ? sentImages : undefined,
          model_tier: modelTier,
          thread_id: threadId ?? undefined,
          input_kind: pendingAudio ? "voice" : "text",
          audio_path: uploadedAudioPath,
          audio_duration_ms: pendingAudio?.durationMs,
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collectedSteps: ToolStep[] = [];
      let collectedCitations: Citation[] | undefined;
      type DoneInfo = {
        answer?: string;
        citations?: Citation[];
        steps?: ToolStep[];
        thread_id?: string | null;
      };
      let doneInfo: DoneInfo | null = null;
      let streamError: string | null = null;

      // Parser simples de SSE (event: X\ndata: {...}\n\n)
      const handleEvent = (event: string, dataStr: string) => {
        let payload: unknown;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          return;
        }
        if (event === "token") {
          const t = (payload as { text?: string }).text;
          if (t) appendToken(t);
        } else if (event === "reasoning") {
          const t = (payload as { text?: string }).text;
          if (t) appendReasoning(t);
        } else if (event === "citations") {
          const c = (payload as { citations?: Citation[] }).citations;
          if (c) {
            collectedCitations = c;
            patchAssistant({ citations: c });
          }
        } else if (event === "tool_start") {
          // opcional: pode-se refletir "chamando ferramenta X" no UI
        } else if (event === "tool_result") {
          const p = payload as { name?: string; result?: unknown };
          if (p.name) {
            collectedSteps.push({
              name: p.name,
              args_json: "{}",
              result_json: JSON.stringify(p.result ?? null),
            });
            patchAssistant({ content: "", steps: dedupeGeneratedDocumentSteps(collectedSteps) });
          }
        } else if (event === "done") {
          doneInfo = payload as typeof doneInfo;
        } else if (event === "error") {
          streamError = (payload as { message?: string }).message ?? "Erro no stream.";
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of raw.split("\n")) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length > 0) handleEvent(eventName, dataLines.join("\n"));
        }
      }

      if (streamError) throw new Error(streamError);

      const finalDone = doneInfo as DoneInfo | null;
      if (finalDone) {
        patchAssistant({
          content: finalDone.answer ?? "",
          citations: finalDone.citations ?? collectedCitations,
          steps: dedupeGeneratedDocumentSteps(finalDone.steps ?? collectedSteps),
        });
        if (finalDone.thread_id && finalDone.thread_id !== threadId) {
          onThreadCreated?.(finalDone.thread_id);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const aborted =
        e instanceof DOMException && e.name === "AbortError"
          ? "Geração cancelada."
          : `Erro: ${msg}`;
      patchAssistant({ content: aborted });
    } finally {
      abortRef.current = null;
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const openDocument = async (document: DocItem) => {
    setPreviewDoc(document);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const result = await getDocumentUrlFn({ data: { id: document.id } });
      setPreviewUrl(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o documento");
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
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

  const sidebarInner = (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-1">
      <div className="shrink-0 border-b bg-card px-5 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {capitalize(caseInfo.status || "ativo")}
          </span>
          <span className="text-xs text-muted-foreground">{readyDocs.length} documentos</span>
        </div>
        <h2 className="font-heading text-lg font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {caseInfo.title}
        </h2>
        {caseInfo.client_name && (
          <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {caseInfo.client_name}
          </p>
        )}
      </div>

      <Tabs defaultValue="documentos" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-4 py-3">
          <TabsList className="grid w-full grid-cols-2 bg-muted/70">
            <TabsTrigger value="documentos" className="gap-2">
              <Files className="h-4 w-4" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="caso" className="gap-2">
              <BriefcaseBusiness className="h-4 w-4" /> Caso
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documentos" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 border-b px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-base font-semibold">Documentos do caso</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedDocIds.size} de {readyDocs.length} usados na resposta
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={onSelectAll}>
                  Todos
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={onDeselectAll}>
                  Nenhum
                </Button>
              </div>
            </div>
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-9"
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
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {filteredDocs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum documento pronto encontrado.
              </p>
            ) : (
              filteredDocs.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/40",
                    selectedDocIds.has(d.id) && "border-primary/50 bg-primary/5",
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedDocIds.has(d.id)}
                    onCheckedChange={() => onToggleSelect(d.id)}
                    aria-label={`Usar ${d.filename} nas respostas`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium leading-snug" title={d.filename}>{d.filename}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.file_type?.toUpperCase() || "ARQUIVO"}
                      {d.page_count ? ` · ${d.page_count} pág.` : ""}
                      {d.created_at ? ` · ${new Date(d.created_at).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void openDocument(d)}
                    title={`Abrir ${d.filename}`}
                    aria-label={`Abrir ${d.filename}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          </div>
        </TabsContent>

        <TabsContent value="caso" className="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
          <section>
            <h3 className="font-heading text-base font-semibold">Dados do caso</h3>
            <dl className="mt-4 space-y-4">
              {[
                ["Cliente", caseInfo.client_name],
                ["Parte representada", caseInfo.represented_party?.name],
                ["Número do processo", caseInfo.case_number],
                ["Vara / Tribunal", caseInfo.jurisdiction],
                ["Área", caseInfo.case_type],
              ].filter((item): item is [string, string] => Boolean(item[1])).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm leading-relaxed text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {(caseInfo.parties?.length ?? 0) > 0 && (
            <section className="mt-6 border-t pt-5">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
                <Users className="h-4 w-4" /> Partes envolvidas
              </h3>
              <ul className="mt-3 space-y-3">
                {(caseInfo.parties ?? []).map((party, index) => (
                  <li key={`${party.role}-${index}`} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm">
                    <span className="font-medium text-muted-foreground">{capitalize(party.role)}</span>
                    <span className="break-words text-foreground">{party.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div
      ref={chatRef}
      className={cn(
        "grid h-full min-h-0 grid-cols-1 overflow-hidden bg-background lg:transition-[grid-template-columns] lg:duration-200",
        contextOpen ? "lg:grid-cols-[21rem_minmax(0,1fr)]" : "lg:grid-cols-[0_minmax(0,1fr)]",
      )}
    >
      {/* Sidebar desktop */}
      <aside className={cn("hidden min-h-0 overflow-hidden border-r lg:flex", !contextOpen && "border-r-0")}>
        {sidebarInner}
      </aside>


      {/* Main chat */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-card">
          {pendingDocs > 0 && (
            <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {pendingDocs} documento(s) ainda sendo indexado(s) — as respostas
                podem ficar incompletas até o processamento concluir.
              </span>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden h-9 w-9 shrink-0 lg:inline-flex"
              onClick={() => setContextOpen((value) => !value)}
              aria-label={contextOpen ? "Recolher contexto do caso" : "Abrir contexto do caso"}
              title={contextOpen ? "Recolher contexto do caso" : "Abrir contexto do caso"}
            >
              {contextOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base">JurisMind AI</p>
              <p className="truncate text-2xs text-muted-foreground sm:text-xs">
                {selectedDocIds.size > 0
                  ? `${selectedDocIds.size} de ${readyDocs.length} doc(s) selecionado(s)`
                  : `${readyDocs.length} doc(s) no caso`}
              </p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0 lg:hidden"
                  aria-label="Ver documentos e detalhes do caso"
                  title="Documentos e detalhes"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[92vw] flex-col gap-4 overflow-y-auto p-4 sm:max-w-md">
                <SheetHeader className="text-left">
                  <SheetTitle>Documentos e detalhes</SheetTitle>
                </SheetHeader>
                {sidebarInner}
              </SheetContent>
            </Sheet>
            <Select
              value={modelTier}
              onValueChange={(v) => setModelTier(v as ModelTier)}
            >
              <SelectTrigger className="h-9 w-[92px] shrink-0 text-xs sm:w-[130px] sm:text-sm">
                <SelectValue>{MODEL_LABELS[modelTier]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="fast">Rápido · análise objetiva</SelectItem>
                <SelectItem value="balanced">Balanceado · análise completa</SelectItem>
                <SelectItem value="max">Máximo · verificação aprofundada</SelectItem>
              </SelectContent>
            </Select>
            {!fullscreen && (
              <Button asChild variant="ghost" size="icon" className="hidden shrink-0 sm:inline-flex" title="Abrir em tela cheia">
                <Link to="/assistencias/$caseId/chat" params={{ caseId }}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
            )}

          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-5 py-8">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <JurisMindMark size={44} context={JURISMIND_CONTEXT.chat} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Contexto da análise</p>
                      <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">Pronto para trabalhar neste caso</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        O JurisMind usará {selectedDocIds.size} documento(s) selecionado(s) de <span className="font-medium text-foreground">{caseInfo.title}</span>. Você pode revisar a seleção na barra lateral antes de pedir uma análise ou uma peça.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">Escolha uma sugestão abaixo ou descreva o que precisa.</p>
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
                      "w-full max-w-3xl rounded-lg px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <>
                        {m.reasoning && (
                          <details className="mb-3 border-b border-border/50 pb-3 text-xs text-muted-foreground">
                            <summary className="cursor-pointer font-medium text-foreground">Como a análise foi feita</summary>
                            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{m.reasoning}</p>
                          </details>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      </>
                    ) : (
                      <>
                        {m.input_kind === "voice" && (
                          <VoiceMessagePlayback
                            messageId={m.id}
                            audioBlobUrl={m.audio_blob_url}
                            hasAudio={
                              Boolean(m.audio_blob_url) ||
                              Boolean(m.audio_path && m.id)
                            }
                            durationMs={m.audio_duration_ms ?? null}
                            getAudioUrl={getAudioUrlFn}
                          />
                        )}
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </>
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
                    {dedupeGeneratedDocumentSteps(m.steps ?? []).map((s, idx) => {
                      try {
                        const r = parseToolResult(s);
                        if (!r) return null;
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
                        if (r.kind === "jurisprudence")
                          return (
                            <JurisprudenceCard
                              key={idx}
                              ok={r.ok !== false}
                              query={r.query}
                              error={r.error}
                              results={r.results ?? []}
                            />
                          );
                        if (r.kind === "process_consultation" && r.cnj)
                          return <ProcessConsultationCard key={idx} result={r as ProcessConsultationResult} />;
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

          <MaterialsSection
            messages={messages}
            onReuse={(label, content) => {
              setInput((prev) =>
                [
                  prev.trim(),
                  `Use o material "${label}" abaixo como base neste pedido:\n\n"""\n${content}\n"""`,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
              );
              toast.success(`"${label}" anexado ao pedido`);
            }}
          />


          <div className="shrink-0 border-t bg-card px-4 py-4 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-3xl">

            {messages.length === 0 && (
              <div className="mb-3">
                <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sugestões
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {PRIMARY_ACTIONS.map((qa) => (
                    <button
                      key={qa.label}
                      type="button"
                      disabled={busy}
                      onClick={() => send(qa.prompt)}
                      className="truncate rounded-md border bg-background px-2.5 py-2 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {qa.label}
                    </button>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-1 truncate rounded-md border bg-background px-2.5 py-2 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        Mais ações
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {ACTION_GROUPS.map((group, gi) => (
                        <div key={group.label}>
                          {gi > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            {group.label}
                          </DropdownMenuLabel>
                          {group.actions.map((qa) => (
                            <DropdownMenuItem
                              key={qa.label}
                              onSelect={(e) => {
                                e.preventDefault();
                                send(qa.prompt);
                              }}
                            >
                              {qa.label}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
            {/* Screen-reader live regions — silent visually, announce state changes. */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {srStatus}
            </div>
            <div role="alert" aria-live="assertive" className="sr-only">
              {micError ?? ""}
            </div>
            {(recording || transcribing || micError) && (
              <div
                className="mb-2 flex flex-wrap items-center gap-2 text-xs"
                aria-hidden={micError ? undefined : true}
              >
                {recording && (
                  <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    <span className="font-medium tabular-nums">
                      REC {formatRecordingTime(recordingMs)}
                    </span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-destructive/20">
                      <div
                        className="h-full bg-destructive transition-[width] duration-100"
                        style={{ width: `${Math.round(audioLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {recording && micSilent && (
                  <span className="text-muted-foreground">
                    Microfone parece silencioso — verifique o dispositivo.
                  </span>
                )}
                {(transcribing || (recording && segmentInFlight)) && (
                  <div className="flex items-center gap-2 rounded-full border bg-muted px-2.5 py-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>
                      {retryInfo
                        ? `Reprocessando… (tentativa ${retryInfo.attempt}/${retryInfo.max})`
                        : transcribing
                          ? "Transcrevendo…"
                          : "Transcrevendo em tempo real…"}
                    </span>
                  </div>
                )}

                {!recording && !transcribing && micError && (
                  <div
                    ref={micErrorRef}
                    role="alert"
                    tabIndex={-1}
                    aria-labelledby="mic-error-msg"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMicError(null);
                      }
                    }}
                    className="flex flex-1 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span id="mic-error-msg" className="flex-1">
                      {micError}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMicError(null);
                        setMicPickerOpen(true);
                      }}
                      className="rounded px-1.5 py-0.5 text-xs font-medium hover:bg-destructive/10"
                    >
                      Trocar microfone
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMicError(null);
                        void startRecording();
                      }}
                      className="rounded px-1.5 py-0.5 text-xs font-medium hover:bg-destructive/10"
                    >
                      Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={() => setMicError(null)}
                      aria-label="Fechar aviso do microfone"
                      className="rounded p-0.5 hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )}
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
            <div className="flex items-center gap-1.5 pb-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                disabled={busy || images.length >= 6}
                title="Anexar imagens (ou arraste / cole)"
                className="h-9 w-9 shrink-0"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                ref={micButtonRef}
                type="button"
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                onClick={() => (recording ? stopRecording() : void startRecording())}
                disabled={busy || transcribing}
                aria-pressed={recording}
                aria-label={
                  transcribing
                    ? "Transcrevendo áudio"
                    : recording
                      ? `Parar gravação (${formatRecordingTime(recordingMs)})`
                      : "Iniciar gravação de voz"
                }
                title={
                  transcribing
                    ? "Transcrevendo…"
                    : recording
                      ? `Parar gravação (${formatRecordingTime(recordingMs)})`
                      : "Ditar mensagem"
                }
                className={cn(
                  "h-9 w-9 shrink-0",
                  recording && "animate-pulse",
                )}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : recording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Popover open={micPickerOpen} onOpenChange={setMicPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={recording || transcribing}
                    aria-label="Escolher microfone"
                    title={
                      recording
                        ? "Pare a gravação para trocar o microfone"
                        : "Escolher microfone"
                    }
                    className="h-9 w-9 shrink-0"
                    onClick={() => void refreshMics()}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3" aria-label="Selecionar microfone">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Microfone</div>
                    <button
                      type="button"
                      onClick={() => void refreshMics()}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                      title="Atualizar lista"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Atualizar
                    </button>
                  </div>
                  {!micLabelsUnlocked && mics.every((d) => !d.label) && (
                    <div className="mb-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                      <p className="mb-2">
                        Autorize o acesso ao microfone para ver os nomes dos
                        dispositivos.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void unlockMicLabels()}
                        disabled={unlockingLabels}
                        aria-busy={unlockingLabels}
                        className="h-7 w-full"
                      >
                        {unlockingLabels ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        Autorizar
                      </Button>
                    </div>
                  )}
                  <RadioGroup
                    value={selectedMicId ?? "__default__"}
                    onValueChange={(v) =>
                      chooseMic(v === "__default__" ? null : v)
                    }
                    className="max-h-64 space-y-1 overflow-y-auto"
                  >
                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <RadioGroupItem value="__default__" id="mic-default" />
                      <Label
                        htmlFor="mic-default"
                        className="flex-1 cursor-pointer text-sm font-normal"
                      >
                        Padrão do sistema
                      </Label>
                    </div>
                    {mics.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        Nenhum microfone detectado.
                      </p>
                    )}
                    {mics.map((d, idx) => {
                      const id = `mic-${d.deviceId || idx}`;
                      const label =
                        d.label ||
                        (d.deviceId === "default"
                          ? "Microfone padrão"
                          : `Microfone ${idx + 1}`);
                      return (
                        <div
                          key={d.deviceId || idx}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <RadioGroupItem value={d.deviceId} id={id} />
                          <Label
                            htmlFor={id}
                            className="flex-1 cursor-pointer truncate text-sm font-normal"
                            title={label}
                          >
                            {label}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                  {recording && (
                    <p className="mt-2 text-2xs text-muted-foreground">
                      Pare a gravação para trocar o microfone.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              <div className="ml-auto text-2xs text-muted-foreground">
                Enter envia · Shift+Enter quebra
              </div>
            </div>
            <div className="flex items-end gap-2 rounded-lg border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
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
                className="min-h-[64px] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                disabled={busy}
              />
              {busy ? (
                <Button
                  onClick={stopStreaming}
                  size="icon"
                  variant="secondary"
                  className="h-11 w-11 shrink-0"
                  title="Parar geração"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => void send()}
                  disabled={!input.trim() && images.length === 0}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDoc(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="flex h-[90svh] max-w-[94vw] flex-col gap-0 p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle className="truncate" title={previewDoc?.filename}>{previewDoc?.filename}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/40">
            {previewLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Abrindo documento…
              </div>
            ) : previewUrl ? (
              <iframe src={previewUrl} title={previewDoc?.filename ?? "Documento"} className="h-full w-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProcessConsultationCard({ result }: { result: ProcessConsultationResult }) {
  const decideProposal = useServerFn(decideCaseUpdateProposal);
  const getProposalStatus = useServerFn(getCaseUpdateProposalStatus);
  const [status, setStatus] = useState(result.proposal_status ?? (result.proposal_id ? "pending" : undefined));
  const [deciding, setDeciding] = useState<"applied" | "rejected" | null>(null);

  useEffect(() => {
    if (!result.proposal_id) return;
    let active = true;
    void getProposalStatus({ data: { proposal_id: result.proposal_id } })
      .then((response) => {
        if (active) setStatus(response.status);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getProposalStatus, result.proposal_id]);

  const decide = async (decision: "applied" | "rejected") => {
    if (!result.proposal_id || deciding) return;
    setDeciding(decision);
    try {
      const response = await decideProposal({ data: { proposal_id: result.proposal_id, decision } });
      setStatus(response.status);
      toast.success(decision === "applied" ? "Dados do caso atualizados." : "Atualização descartada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setDeciding(null);
    }
  };

  const consulted = new Date(result.consulted_at);
  const movements = result.movements ?? [];
  const changes = result.changes ?? [];
  const sources = result.sources ?? [];

  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-primary/30 bg-card text-card-foreground">
      <header className="border-b bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Andamento processual</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{result.cnj}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Consultado em {Number.isNaN(consulted.getTime()) ? result.consulted_at : consulted.toLocaleString("pt-BR")}
            </p>
          </div>
          {result.ok ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><CheckCircle2 className="h-4 w-4" />Consulta concluída</span>
          ) : (
            <span className="text-xs font-medium text-destructive">Consulta incompleta</span>
          )}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {!result.ok ? <p className="text-sm text-destructive">{result.error ?? "A fonte oficial não retornou dados."}</p> : null}

        {result.ok ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {result.class_name ? <p><span className="text-muted-foreground">Classe:</span> {result.class_name}</p> : null}
            {result.unit_name ? <p><span className="text-muted-foreground">Órgão:</span> {result.unit_name}</p> : null}
            {result.court ? <p><span className="text-muted-foreground">Tribunal:</span> {result.court}{result.degree ? ` · ${result.degree}` : ""}</p> : null}
            {result.subjects?.length ? <p><span className="text-muted-foreground">Assuntos:</span> {result.subjects.slice(0, 3).join(", ")}</p> : null}
          </div>
        ) : null}

        {movements.length > 0 ? (
          <details className="group" open>
            <summary className="cursor-pointer text-sm font-semibold">Movimentações ({result.total_movements ?? movements.length})</summary>
            <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto border-l pl-4">
              {movements.map((movement, index) => (
                <li key={`${movement.date ?? "sem-data"}-${movement.name}-${index}`} className="text-sm">
                  <p className="font-medium">{movement.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {movement.date ? new Date(movement.date).toLocaleString("pt-BR") : "Data não informada"} · {movement.source.toUpperCase()}
                  </p>
                  {movement.complement ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{movement.complement}</p> : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {changes.length > 0 ? (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold">Atualização proposta</h4>
            <div className="mt-2 space-y-2">
              {changes.map((change) => (
                <div key={change.field} className="grid gap-1 rounded-md border p-3 text-sm sm:grid-cols-[9rem_1fr]">
                  <span className="font-medium">{change.label}</span>
                  <span><span className="text-muted-foreground">{change.current || "Não informado"}</span> → {change.proposed}</span>
                </div>
              ))}
            </div>
            {status === "pending" ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button size="sm" onClick={() => void decide("applied")} disabled={Boolean(deciding)}>
                  {deciding === "applied" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirmar atualização
                </Button>
                <Button size="sm" variant="outline" onClick={() => void decide("rejected")} disabled={Boolean(deciding)}>
                  Descartar
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                {status === "applied" ? "Atualização confirmada." : "Atualização descartada."}
              </p>
            )}
          </div>
        ) : result.ok ? <p className="text-sm text-muted-foreground">O cadastro do caso já corresponde aos dados encontrados.</p> : null}

        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-semibold">Fontes oficiais ({sources.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {sources.map((source) => (
              <li key={source.name} className="flex flex-wrap items-center gap-2 text-sm">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4">
                  {source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <span className="text-xs text-muted-foreground">{source.status === "ok" ? source.detail ?? "consultada" : source.detail ?? "indisponível"}</span>
              </li>
            ))}
          </ul>
        </details>
        {(result.warnings ?? []).map((warning) => <p key={warning} className="text-xs leading-relaxed text-muted-foreground">{warning}</p>)}
      </div>
    </section>
  );
}

/**
 * Jurisprudência localizada em fonte OFICIAL externa.
 * Fica separada das citações [F] dos autos para não se confundir com prova.
 */
function JurisprudenceCard({
  ok,
  query,
  error,
  results,
}: {
  ok: boolean;
  query?: string;
  error?: string;
  results: JurisprudenceRef[];
}) {
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Jurisprudência — fonte externa aos autos
          </p>
          {query && (
            <p className="text-sm text-muted-foreground">Pesquisa: “{query}”</p>
          )}
        </div>
      </div>

      {!ok && (
        <p className="mt-2 text-sm text-destructive">
          Pesquisa jurisprudencial indisponível agora. {error ?? ""} Nenhum precedente foi
          utilizado.
        </p>
      )}

      {ok && results.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum resultado nas fontes oficiais consultadas.
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {results.map((r) => (
          <li key={r.url} className="rounded-lg border bg-background p-2.5">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">[{r.ref}]</span>
              {r.court}
              {r.panel ? <span className="font-normal text-muted-foreground">· {r.panel}</span> : null}
              {r.process_number ? (
                <span className="font-normal text-muted-foreground">· {r.process_number}</span>
              ) : null}
              {r.date ? <span className="font-normal text-muted-foreground">· {r.date}</span> : null}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{r.title}</p>
            {r.snippet && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.snippet}</p>
            )}
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Abrir no site oficial do tribunal
            </a>
          </li>
        ))}
      </ul>

      {ok && results.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Trechos vindos de resultado de busca oficial — confira o inteiro teor no link antes de
          citar. Jurisprudência não substitui a prova dos autos.
        </p>
      )}
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
  search_jurisprudence: "Pesquisa de jurisprudência (fontes oficiais)",
  consult_process_status: "Consulta processual oficial",
};

function friendlyToolName(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

/**
 * Materiais gerados na conversa, agrupados em um só lugar para o advogado não
 * precisar rolar todo o histórico para reencontrar um arquivo.
 */
/** Texto reaproveitável de um material já gerado, para citar em novo pedido. */
function artifactAsText(r: NonNullable<ReturnType<typeof parseToolResult>>): string {
  if (r.kind === "table") {
    const rows = r.rows ?? [];
    return rows.map((row) => (Array.isArray(row) ? row.join(" | ") : String(row))).join("\n");
  }
  if (r.kind === "presentation") {
    const slides = r.slides ?? [];
    return slides
      .map((s: unknown) => {
        const slide = s as { title?: string; bullets?: string[] };
        return [slide.title, ...(slide.bullets ?? [])].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }
  return r.conteudo ?? "";
}

function MaterialsSection({
  messages,
  onReuse,
}: {
  messages: Msg[];
  onReuse?: (label: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const artifacts = useMemo(() => {
    const out: Array<
      NonNullable<ReturnType<typeof parseToolResult>> & { key: string }
    > = [];
    messages.forEach((m, mi) => {
      dedupeGeneratedDocumentSteps(m.steps ?? []).forEach((s, si) => {
        try {
          const r = parseToolResult(s);
          if (r) out.push({ ...r, key: `${mi}-${si}` });
        } catch {
          // ignora passo inválido
        }
      });
    });
    return out;
  }, [messages]);

  if (artifacts.length === 0) return null;

  return (
    <div className="shrink-0 border-t bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted"
      >
        <span>
          Materiais deste caso ({artifacts.length}{" "}
          {artifacts.length === 1 ? "arquivo" : "arquivos"})
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="max-h-[45vh] overflow-auto px-4 pb-4">
          {artifacts.map((r) => {
            const label =
              r.kind === "presentation"
                ? (r.title ?? "Apresentação")
                : (r.titulo ??
                  (r.kind === "table"
                    ? "Tabela"
                    : r.kind === "pdf"
                      ? "Documento"
                      : "Peça jurídica"));
            const card =
              r.kind === "petition" ? (
                <PetitionCard titulo={label} conteudo={r.conteudo ?? ""} />
              ) : r.kind === "pdf" ? (
                <PDFCard titulo={label} conteudo={r.conteudo ?? ""} />
              ) : r.kind === "table" ? (
                <TableCard titulo={label} rows={r.rows ?? []} />
              ) : r.kind === "presentation" ? (
                <PresentationCard
                  title={label}
                  subtitle={r.subtitle}
                  slides={r.slides ?? []}
                />
              ) : null;
            if (!card) return null;
            return (
              <div key={r.key}>
                {card}
                {onReuse && (
                  <div className="mb-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReuse(label, artifactAsText(r))}
                    >
                      Usar neste pedido
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
