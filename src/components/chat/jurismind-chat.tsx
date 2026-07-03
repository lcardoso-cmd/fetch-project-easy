import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getThreadMessages, getMessageAudioUrl } from "@/lib/threads.functions";
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
  Search,
  Send,
  Settings2,
  Square,
  X,
  FolderOpen,
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
}

function parseToolResult(step: ToolStep): {
  kind?: string;
  titulo?: string;
  conteudo?: string;
  rows?: Array<Record<string, unknown>>;
  title?: string;
  subtitle?: string;
  slides?: Array<{ title?: string; content?: string[] }>;
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
      <div className="mb-2 flex items-center gap-1.5 text-[11px] opacity-80">
        <Mic className="h-3 w-3" />
        <span>Ditado por voz{dur ? ` · ${dur}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] opacity-80">
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
          className="inline-flex w-fit items-center gap-1 rounded-md bg-background/20 px-2 py-1 text-[11px] hover:bg-background/30 disabled:opacity-60"
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
  // askFn removido: agora usamos SSE em /api/chat/stream (streaming token-a-token)
  const getMessagesFn = useServerFn(getThreadMessages);
  const getAudioUrlFn = useServerFn(getMessageAudioUrl);
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

    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));
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
          history,
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
    <>
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
                ? ` (${capitalize(caseInfo.represented_party.role)})`
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
                      {capitalize(p.role)}
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
    </>
  );

  return (
    <div
      ref={chatRef}
      className="grid h-full min-h-0 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-3"
    >
      {/* Sidebar desktop */}
      <aside className="hidden min-h-0 flex-col gap-4 lg:col-span-1 lg:flex">
        {sidebarInner}
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
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
            <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base">JurisMind AI</p>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
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
                <SelectItem value="fast">Rápido · Flash</SelectItem>
                <SelectItem value="balanced">Balanceado · 2.5 Flash</SelectItem>
                <SelectItem value="max">Máximo · 2.5 Pro</SelectItem>
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

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <JurisMindMark size={56} context={JURISMIND_CONTEXT.chat} />
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
              <div className="mb-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Pare a gravação para trocar o microfone.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              <div className="ml-auto text-[11px] text-muted-foreground">
                Enter envia · Shift+Enter quebra
              </div>
            </div>
            <div className="flex items-end gap-2">
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
                className="min-h-[44px] flex-1 resize-none"
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
