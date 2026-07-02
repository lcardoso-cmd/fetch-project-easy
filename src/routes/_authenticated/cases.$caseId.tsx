import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  ClipboardCheck,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";

import { getCase, updateCase } from "@/lib/cases.functions";
import { listDocuments } from "@/lib/documents.functions";
import { listEvents } from "@/lib/events.functions";
import { listTasks, toggleTask } from "@/lib/tasks.functions";
import { DocumentList } from "@/components/documents/document-list";
import { CaseSummaryCard } from "@/components/cases/case-summary-card";
import { JurisMindChat } from "@/components/chat/jurismind-chat";
import { CaseTasksDialog } from "@/components/tasks/case-tasks-dialog";
import { FloatingTeamChat } from "@/components/chat/floating-team-chat";
import { QuesitosCard } from "@/components/cases/quesitos-card";
import type { MatterKind } from "@/lib/practice-labels";

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const qc = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const updateCaseFn = useServerFn(updateCase);
  const listDocsFn = useServerFn(listDocuments);
  const listEventsFn = useServerFn(listEvents);
  const listTasksFn = useServerFn(listTasks);
  const toggleTaskFn = useServerFn(toggleTask);

  const { data: caseData, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCaseFn({ data: { id: caseId } }),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents", caseId],
    queryFn: () => listDocsFn({ data: { case_id: caseId } }),
    refetchInterval: 5000,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events", caseId],
    queryFn: () => listEventsFn({ data: { case_id: caseId } }),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", caseId],
    queryFn: () => listTasksFn({ data: { case_id: caseId, status: "all" } }),
  });

  // Seleção compartilhada entre Lista de documentos e Chat
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const readyDocIds = useMemo(
    () => docs.filter((d) => d.processing_status === "ready").map((d) => d.id),
    [docs],
  );
  const selectAll = () => setSelectedDocIds(new Set(readyDocIds));
  const deselectAll = () => setSelectedDocIds(new Set());

  // Auto-marca novos docs prontos (apenas adiciona; nunca remove escolhas manuais).
  const seenReadyRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = readyDocIds.filter((id) => !seenReadyRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenReadyRef.current.add(id));
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      return next;
    });
  }, [readyDocIds]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: "",
    case_number: "",
    jurisdiction: "",
    case_type: "",
    client_name: "",
    description: "",
  });
  const openEdit = () => {
    if (!caseData) return;
    setForm({
      title: caseData.title ?? "",
      case_number: caseData.case_number ?? "",
      jurisdiction: caseData.jurisdiction ?? "",
      case_type: caseData.case_type ?? "",
      client_name: caseData.client_name ?? "",
      description: caseData.description ?? "",
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    await updateCaseFn({ data: { id: caseId, ...form } });
    await qc.invalidateQueries({ queryKey: ["case", caseId] });
    setEditing(false);
    toast.success("Caso atualizado");
  };

  if (isLoading)
    return <p className="text-muted-foreground">Carregando...</p>;
  if (!caseData)
    return <p className="text-muted-foreground">Caso não encontrado.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/cases">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {caseData.title}
          </h1>
        </div>

        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={openEdit}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Editar dados
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="lg">
                <BrainCircuit className="mr-2 h-5 w-5" /> JurisMind AI
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex h-svh w-full flex-col p-0 sm:max-w-5xl lg:max-w-[min(96vw,1440px)]"
            >
              <SheetHeader className="border-b p-4">
                <SheetTitle className="flex items-center gap-2 truncate">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  JurisMind AI — {caseData.title}
                </SheetTitle>
              </SheetHeader>
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
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Dados do caso — quadro branco */}
      {(caseData.case_number || caseData.jurisdiction || caseData.case_type) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do caso</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {caseData.case_number && (
                <li className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Número do processo:</span>{" "}
                  {caseData.case_number}
                </li>
              )}
              {caseData.jurisdiction && (
                <li className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Vara / Tribunal:</span>{" "}
                  {caseData.jurisdiction}
                </li>
              )}
              {caseData.case_type && (
                <li className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Área:</span>{" "}
                  {caseData.case_type}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Partes envolvidas — quadro branco */}
      {caseData.parties && (caseData.parties as Array<{ role: string; name: string; relation?: string | null }>).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partes Envolvidas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {(caseData.parties as Array<{ role: string; name: string; relation?: string | null }>).map((party, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {capitalize(party.role)}:
                  </span>{" "}
                  {party.name}
                  {party.relation ? ` (${capitalize(party.relation)})` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}


      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Editar caso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Título do caso</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input
                value={form.client_name}
                onChange={(e) =>
                  setForm({ ...form, client_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Número do processo</Label>
              <Input
                value={form.case_number}
                onChange={(e) =>
                  setForm({ ...form, case_number: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Jurisdição</Label>
              <Input
                value={form.jurisdiction}
                onChange={(e) =>
                  setForm({ ...form, jurisdiction: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.case_type}
                onValueChange={(v) => setForm({ ...form, case_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contencioso">Contencioso</SelectItem>
                  <SelectItem value="Arbitragem">Arbitragem</SelectItem>
                  <SelectItem value="Consultivo">Consultivo</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={saveEdit}>Salvar</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo (linha cheia) */}
      <CaseSummaryCard
        caseId={caseId}
        caseTitle={caseData.title}
        summary={caseData.summary ?? null}
        summaryUpdatedAt={caseData.summary_updated_at ?? null}
        hasReadyDocs={readyDocIds.length > 0}
      />

      {/* Documentos (linha cheia para caber a tabela) */}
      <DocumentList
        caseId={caseId}
        documents={docs}
        selectedDocIds={selectedDocIds}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
      />

      {/* Eventos + Tarefas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Prazos e eventos
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/calendar">Ver agenda</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum evento. O assistente pode criar usando a tool{" "}
                <code>create_event</code>.
              </p>
            ) : (
              <ul className="divide-y">
                {events.slice(0, 8).map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {new Date(ev.starts_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Tarefas
            </CardTitle>
            <CaseTasksDialog
              caseId={caseId}
              caseTitle={caseData.title}
              trigger={
                <Button size="sm" variant="ghost">
                  <ListTodo className="mr-1 h-4 w-4" /> Gerenciar
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma tarefa para este caso.
              </p>
            ) : (
              <ul className="divide-y">
                {tasks.slice(0, 8).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={async (c) => {
                        await toggleTaskFn({
                          data: { id: t.id, done: Boolean(c) },
                        });
                        await qc.invalidateQueries({
                          queryKey: ["tasks", caseId],
                        });
                      }}
                    />
                    <span
                      className={
                        t.status === "done"
                          ? "line-through text-muted-foreground"
                          : ""
                      }
                    >
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quesitos para perícia / assistência técnica */}
      {caseData.matter_kind && caseData.matter_kind !== "processo" && (
        <QuesitosCard
          caseId={caseId}
          matterKind={caseData.matter_kind as MatterKind}
        />
      )}
      {/* Chat flutuante da equipe (canto inferior direito) */}
      <FloatingTeamChat caseId={caseId} />
    </div>
  );
}
