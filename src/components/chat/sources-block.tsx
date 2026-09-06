import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  SourceViewerDialog,
  citationDocumentName,
  citationGroupKey,
  citationSpotLabel,
  type CitationLike,
} from "./source-viewer-dialog";

interface Group {
  key: string;
  name: string;
  items: CitationLike[];
}

/** Agrupa as citações por documento: as partes de um mesmo arquivo viram uma única fonte. */
export function groupCitations(citations: CitationLike[]): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  citations.forEach((c, idx) => {
    const key = citationGroupKey(c, idx);
    let g = byKey.get(key);
    if (!g) {
      g = { key, name: citationDocumentName(c), items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(c);
  });
  for (const g of groups) {
    g.items.sort((a, b) => (a.part_index ?? 0) - (b.part_index ?? 0) || (a.page ?? 0) - (b.page ?? 0));
  }
  return groups;
}

/** Bloco de fontes: um item por documento, com trechos clicáveis por parte e página. */
export function SourcesBlock({
  citations,
  defaultOpen = false,
}: {
  citations: CitationLike[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState<CitationLike | null>(null);
  const groups = useMemo(() => groupCitations(citations), [citations]);
  const evidence = citations.filter((c) => !c.is_context);
  const context = citations.filter((c) => c.is_context);

  return (
    <div className="mt-3 border-t border-border/40 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground"
      >
        <span>
          Fontes ({groups.length} documento{groups.length === 1 ? "" : "s"} ·{" "}
          {evidence.length} trecho{evidence.length === 1 ? "" : "s"}
          {context.length > 0 ? ` + ${context.length} de contexto` : ""})
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>

      <div className="mt-2 space-y-3">
        {(open ? groups : groups.slice(0, 2)).map((g) => (
          <div key={g.key} className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{g.name}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
              {g.items.map((c, idx) => (
                <button
                  key={c.chunk_id ?? `${g.key}-${idx}`}
                  type="button"
                  onClick={() => setActive(c)}
                  title={`Abrir ${g.name} — ${citationSpotLabel(c)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[13px] font-semibold text-primary transition hover:bg-primary/20"
                >
                  {c.ref ? `[${c.ref}]` : null}
                  <span className="font-normal text-foreground/80">{citationSpotLabel(c)}</span>
                  {c.is_context ? (
                    <span className="font-normal text-foreground/50">· contexto</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!open && groups.length > 2 ? (
          <p className="pl-5 text-sm text-foreground/60">
            + {groups.length - 2} documento{groups.length - 2 === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <SourceViewerDialog
        citation={active}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
      />
    </div>
  );
}
