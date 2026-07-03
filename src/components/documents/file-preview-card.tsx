import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Formata bytes de forma amigável (KB, MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Nome amigável do tipo. */
function typeLabel(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx")) return "Word (DOCX)";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "Excel";
  if (name.endsWith(".csv")) return "CSV";
  if (name.endsWith(".txt")) return "Texto";
  if (/\.(png|jpe?g)$/i.test(name)) return "Imagem";
  return file.type || "Arquivo";
}

function icon(file: File) {
  const name = file.name.toLowerCase();
  if (/\.(png|jpe?g)$/i.test(name))
    return <FileImage className="h-4 w-4 text-muted-foreground" />;
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
  if (name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt"))
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Extracted = {
  hash?: string;
  pageCount?: number;
  textSnippet?: string;
  imageDims?: { w: number; h: number };
};

export function FilePreviewCard({
  file,
  onRemove,
  onHashComputed,
}: {
  file: File;
  onRemove: () => void;
  onHashComputed?: (hash: string) => void;
}) {
  const [extracted, setExtracted] = useState<Extracted>({});
  const [loading, setLoading] = useState(true);
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const buf = await file.arrayBuffer();
        const hash = await sha256(buf);
        if (cancelled) return;
        const next: Extracted = { hash };
        const name = file.name.toLowerCase();
        if (name.endsWith(".pdf")) {
          try {
            const { PDFDocument } = await import("pdf-lib");
            const pdf = await PDFDocument.load(buf, {
              ignoreEncryption: true,
              throwOnInvalidObject: false,
            });
            next.pageCount = pdf.getPageCount();
          } catch {
            /* ignore */
          }
        } else if (
          name.endsWith(".txt") ||
          name.endsWith(".csv") ||
          file.type.startsWith("text/")
        ) {
          try {
            const text = new TextDecoder("utf-8", { fatal: false }).decode(
              buf.slice(0, 4096),
            );
            next.textSnippet = text.slice(0, 600);
          } catch {
            /* ignore */
          }
        } else if (/\.(png|jpe?g)$/i.test(name)) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              next.imageDims = { w: img.naturalWidth, h: img.naturalHeight };
              resolve();
            };
            img.onerror = () => resolve();
            img.src = objectUrl;
          });
        }
        if (cancelled) return;
        setExtracted(next);
        if (hash) onHashComputed?.(hash);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, objectUrl, onHashComputed]);

  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  const isImage = /\.(png|jpe?g)$/i.test(file.name);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon(file)}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {typeLabel(file)}
              </Badge>
              <span>{formatSize(file.size)}</span>
              {extracted.pageCount != null && (
                <span>· {extracted.pageCount} pág.</span>
              )}
              {extracted.imageDims && (
                <span>
                  · {extracted.imageDims.w}×{extracted.imageDims.h}px
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remover ${file.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className={cn(
            "flex min-h-32 items-center justify-center overflow-hidden rounded-md border bg-muted/40",
          )}
        >
          {isPdf ? (
            <iframe
              src={`${objectUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Prévia de ${file.name}`}
              className="h-48 w-full"
            />
          ) : isImage ? (
            <img
              src={objectUrl}
              alt={`Prévia de ${file.name}`}
              className="max-h-48 w-full object-contain"
            />
          ) : extracted.textSnippet ? (
            <pre className="max-h-48 w-full overflow-auto whitespace-pre-wrap break-words p-2 text-xs text-muted-foreground">
              {extracted.textSnippet}
              {extracted.textSnippet.length >= 600 && "…"}
            </pre>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Prévia não disponível para este formato.
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="truncate">{typeLabel(file)}</dd>
          <dt className="text-muted-foreground">Tamanho</dt>
          <dd>{formatSize(file.size)}</dd>
          <dt className="text-muted-foreground">Modificado</dt>
          <dd>
            {file.lastModified
              ? new Date(file.lastModified).toLocaleString("pt-BR")
              : "—"}
          </dd>
          {extracted.pageCount != null && (
            <>
              <dt className="text-muted-foreground">Páginas</dt>
              <dd>{extracted.pageCount}</dd>
            </>
          )}
          {extracted.imageDims && (
            <>
              <dt className="text-muted-foreground">Dimensões</dt>
              <dd>
                {extracted.imageDims.w} × {extracted.imageDims.h} px
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Hash</dt>
          <dd className="font-mono text-[10px]">
            {loading && !extracted.hash ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> calculando…
              </span>
            ) : extracted.hash ? (
              <span title={extracted.hash}>
                {extracted.hash.slice(0, 10)}…{extracted.hash.slice(-6)}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </div>
    </div>
  );
}
