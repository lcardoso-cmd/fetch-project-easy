import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDocumentUrl } from "@/lib/documents.functions";

/** Citação tolerante: mensagens antigas não têm os campos de parte/página. */
export interface CitationLike {
  ref?: string;
  chunk_id?: string;
  document_id: string;
  filename: string;
  snippet?: string;
  location?: string | null;
  is_context?: boolean;
  group_key?: string;
  base_filename?: string;
  part_index?: number | null;
  part_count?: number | null;
  page?: number | null;
  page_in_part?: number | null;
}

export function citationPartLabel(c: CitationLike): string | null {
  if (c.part_index == null) return null;
  return `Parte ${c.part_index}${c.part_count ? ` de ${c.part_count}` : ""}`;
}

/** Rótulo curto do trecho: "Parte 2 · p. 143" (ou apenas a localização). */
export function citationSpotLabel(c: CitationLike): string {
  const part = citationPartLabel(c);
  const page = c.page != null ? `p. ${c.page}` : c.location;
  return [part, page].filter(Boolean).join(" · ") || "trecho";
}

export function citationGroupKey(c: CitationLike, index: number): string {
  return c.group_key ?? c.document_id ?? `c-${index}`;
}

export function citationDocumentName(c: CitationLike): string {
  return c.base_filename ?? c.filename;
}

/** Abre o arquivo da fonte já posicionado na página citada. */
export function SourceViewerDialog({
  citation,
  onOpenChange,
}: {
  citation: CitationLike | null;
  onOpenChange: (open: boolean) => void;
}) {
  const getUrl = useServerFn(getDocumentUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!citation) {
      setUrl(null);
      setError(null);
      return;
    }
    let active = true;
    setUrl(null);
    setError(null);
    getUrl({ data: { id: citation.document_id } })
      .then((res) => {
        if (!active) return;
        const page = citation.page_in_part ?? null;
        setUrl(page != null ? `${res.url}#page=${page}` : res.url);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citation?.document_id, citation?.page_in_part]);

  return (
    <Dialog open={!!citation} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-full max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="truncate text-base">
            {citation ? citationDocumentName(citation) : "Fonte"}
          </DialogTitle>
          <DialogDescription>
            {citation ? citationSpotLabel(citation) : null}
          </DialogDescription>
        </DialogHeader>

        {citation?.snippet ? (
          <ScrollArea className="max-h-28 rounded-md border border-border/60 bg-muted/40 p-3">
            <p className="text-sm leading-relaxed text-foreground/80">{citation.snippet}</p>
          </ScrollArea>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : url ? (
            <iframe src={url} title="Fonte" className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Abrindo o arquivo...
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={!url}
            onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova aba
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
