import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadPhase =
  | "queued"
  | "hashing"
  | "uploading"
  | "registering"
  | "indexing"
  | "done"
  | "duplicate"
  | "cancelled"
  | "error";

export interface UploadItem {
  id: string;
  filename: string;
  size: number;
  pct: number;
  phase: UploadPhase;
  message?: string;
  chunks?: number;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  queued: "Aguardando…",
  hashing: "Calculando hash…",
  uploading: "Enviando…",
  registering: "Registrando…",
  indexing: "Indexando para busca…",
  done: "Pronto",
  duplicate: "Duplicado — ignorado",
  cancelled: "Cancelado",
  error: "Falhou",
};

function formatBytes(b: number) {
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function PhaseIcon({ phase }: { phase: UploadPhase }) {
  if (phase === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (phase === "error")
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (phase === "duplicate")
    return <AlertCircle className="h-4 w-4 text-amber-600" />;
  if (phase === "cancelled")
    return <X className="h-4 w-4 text-muted-foreground" />;
  return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
}

export function UploadProgressList({
  items,
  onRetry,
  onRemove,
  onCancel,
}: {
  items: UploadItem[];
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const isDone = it.phase === "done" || it.phase === "duplicate";
        const isError = it.phase === "error";
        const isCancelled = it.phase === "cancelled";
        const isFinal = isDone || isError || isCancelled;
        const canCancel = !isFinal && it.phase !== "registering" && it.phase !== "indexing";
        const displayPct = isDone ? 100 : it.pct;
        return (
          <li
            key={it.id}
            className={cn(
              "rounded-lg border bg-card p-3",
              isError && "border-destructive/50 bg-destructive/5",
              it.phase === "duplicate" && "border-amber-500/40 bg-amber-50/40",
              isCancelled && "border-muted-foreground/30 bg-muted/30 opacity-80",
            )}
          >
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{it.filename}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(it.size)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <PhaseIcon phase={it.phase} />
                  <span
                    className={cn(
                      "text-xs",
                      isError && "text-destructive",
                      it.phase === "duplicate" && "text-amber-700",
                      !isError && it.phase !== "duplicate" && "text-muted-foreground",
                    )}
                  >
                    {it.message ?? PHASE_LABEL[it.phase]}
                    {it.phase === "indexing" && it.chunks
                      ? ` (${it.chunks} trechos)`
                      : ""}
                  </span>
                  {!isFinal && (
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {Math.round(displayPct)}%
                    </span>
                  )}
                </div>
                {!isFinal && (
                  <Progress value={displayPct} className="mt-2 h-1.5" />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canCancel && onCancel && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onCancel(it.id)}
                    title="Cancelar envio"
                    aria-label={`Cancelar envio de ${it.filename}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isError && onRetry && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onRetry(it.id)}
                    title="Tentar novamente"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onRemove && isFinal && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onRemove(it.id)}
                    title="Remover da lista"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
