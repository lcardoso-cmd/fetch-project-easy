import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit } from "lucide-react";

import { getCase } from "@/lib/cases.functions";
import { listDocuments } from "@/lib/documents.functions";
import { JurisMindChat } from "@/components/chat/jurismind-chat";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cases/$caseId/chat")({
  component: CaseChatFullPage,
});

function CaseChatFullPage() {
  const { caseId } = Route.useParams();
  const getCaseFn = useServerFn(getCase);
  const listDocsFn = useServerFn(listDocuments);

  const { data: caseData } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCaseFn({ data: { id: caseId } }),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents", caseId],
    queryFn: () => listDocsFn({ data: { case_id: caseId } }),
    refetchInterval: 5000,
  });

  const readyDocIds = useMemo(
    () => docs.filter((d) => d.processing_status === "ready").map((d) => d.id),
    [docs],
  );
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelectedDocIds(new Set(readyDocIds));
  const deselectAll = () => setSelectedDocIds(new Set());

  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = readyDocIds.filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      return next;
    });
  }, [readyDocIds]);

  if (!caseData) {
    return <p className="p-6 text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex h-[calc(100svh-4.5rem)] min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cases/$caseId" params={{ caseId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao caso
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
          <p className="truncate font-semibold">
            JurisMind AI — {caseData.title}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <JurisMindChat
          caseId={caseId}
          caseInfo={{
            title: caseData.title,
            client_name: caseData.client_name,
            status: caseData.status,
            case_number: caseData.case_number,
            case_type: caseData.case_type,
            jurisdiction: caseData.jurisdiction,
            parties: (caseData.parties ?? []) as Array<{
              role: string;
              name: string;
              relation?: string | null;
            }>,
            represented_party: (caseData.represented_party ?? null) as {
              role: string;
              name: string;
            } | null,
          }}
          documents={docs}
          selectedDocIds={selectedDocIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
        />
      </div>
    </div>
  );
}
