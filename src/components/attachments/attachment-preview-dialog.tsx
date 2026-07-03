import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type PreviewKind = "image" | "pdf" | "text" | "audio" | "video" | "other";

export function detectPreviewKind(fileName: string, mimeType?: string | null): PreviewKind {
  const mt = (mimeType ?? "").toLowerCase();
  const name = fileName.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return "image";
  if (mt === "application/pdf" || ext === "pdf") return "pdf";
  if (mt.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "webm"].includes(ext)) return "audio";
  if (mt.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  if (
    mt.startsWith("text/") ||
    mt === "application/json" ||
    ["txt", "md", "csv", "log", "json", "xml", "html", "css", "js", "ts"].includes(ext)
  )
    return "text";
  return "other";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fileName: string;
  mimeType?: string | null;
  /** Resolve a fresh signed URL on demand. */
  resolveUrl: () => Promise<string>;
}

export function AttachmentPreviewDialog({
  open,
  onOpenChange,
  fileName,
  mimeType,
  resolveUrl,
}: Props) {
  const kind = detectPreviewKind(fileName, mimeType);
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setTextContent(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const signed = await resolveUrl();
        if (cancelled) return;
        setUrl(signed);
        if (kind === "text") {
          const res = await fetch(signed);
          const text = await res.text();
          if (!cancelled) setTextContent(text.slice(0, 200_000));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, resolveUrl]);

  const handleDownload = async () => {
    try {
      const signed = url ?? (await resolveUrl());
      const a = document.createElement("a");
      a.href = signed;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar");
    }
  };

  const openExternal = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
          <DialogDescription>
            {mimeType || "Prévia do documento"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px] max-h-[70vh] overflow-auto rounded-md border bg-muted/30">
          {loading && (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando prévia…
            </div>
          )}
          {!loading && error && (
            <div className="flex h-64 items-center justify-center p-6 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && url && (
            <>
              {kind === "image" && (
                <img
                  src={url}
                  alt={fileName}
                  className="mx-auto max-h-[65vh] object-contain"
                />
              )}
              {kind === "pdf" && (
                <iframe
                  src={url}
                  title={fileName}
                  className="h-[65vh] w-full bg-white"
                />
              )}
              {kind === "audio" && (
                <div className="flex h-40 items-center justify-center p-6">
                  <audio controls src={url} className="w-full" />
                </div>
              )}
              {kind === "video" && (
                <video controls src={url} className="mx-auto max-h-[65vh]" />
              )}
              {kind === "text" && (
                <pre className="whitespace-pre-wrap p-4 text-xs leading-relaxed">
                  {textContent ?? ""}
                </pre>
              )}
              {kind === "other" && (
                <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p>Prévia não disponível para este tipo de arquivo.</p>
                  <p className="text-xs">
                    Use as opções abaixo para abrir em nova aba ou baixar.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={openExternal}
            disabled={!url}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova aba
          </Button>
          <Button type="button" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
