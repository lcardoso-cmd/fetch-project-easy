import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CalendarPlus, ListTodo } from "lucide-react";
import { toast } from "sonner";

import { getCase, updateCase } from "@/lib/cases.functions";
import { listDocuments } from "@/lib/documents.functions";
import { listEvents, deleteEvent } from "@/lib/events.functions";
import { listTasks, toggleTask } from "@/lib/tasks.functions";
import { getOrCreateCaseConversation } from "@/lib/conversations.functions";
import { DocumentList } from "@/components/documents/document-list";
import { CaseSummaryCard } from "@/components/cases/case-summary-card";
import { CaseJurisMindPanel } from "@/components/chat/case-jurismind-panel";
import { useAccess } from "@/hooks/use-access";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { CaseTasksDialog } from "@/components/tasks/case-tasks-dialog";
import { ConversationView } from "@/components/chat/conversation-view";
import { QuesitosCard } from "@/components/cases/quesitos-card";
import { PieceGenerator } from "@/components/generators/piece-generator";
import { AddEventDialog } from "@/components/work/add-event-dialog";
import { AgendaPanel, type UnifiedEvent } from "@/components/work/agenda-panel";
import { EmptyState } from "@/components/empty-state";
import { ClipboardCheck } from "lucide-react";
import type { MatterKind } from "@/lib/practice-labels";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const TABS = ["visao-geral", "documentos", "producao", "prazos", "atividade"] as const;
// "jurismind" permanece aceito apenas para links antigos: abre o painel lateral.
const LEGACY_TABS = [...TABS, "jurismind"] as const;

const searchSchema = z.object({ tab: z.enum(LEGACY_TABS).optional() });

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function CaseDataRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex min-w-0 items-baseline gap-2 text-sm text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground">{label}:</span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{value}</span>
    </li>
  );
}

export const Route = createFileRoute("/_authenticated/assistencias/$caseId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CaseWorkspacePage,
});

function CaseWorkspacePage() {
  const { caseId } = Route.useParams();
  const { tab } = Route.useSearch();
  const qc = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const updateCaseFn = useServerFn(updateCase);
  const listDocsFn = useServerFn(listDocuments);
  const listEventsFn = useServerFn(listEvents);
  const listTasksFn = useServerFn(listTasks);
  const toggleTaskFn = useServerFn(toggleTask);
  const deleteEventFn = useServerFn(deleteEvent);
  const caseConvFn = useServerFn(getOrCreateCaseConversation);

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
  const { data: conversation } = useQuery({
    queryKey: ["case-conversation", caseId],
    queryFn: () => caseConvFn({ data: { case_id: caseId } }),
  });

  // Seleção compartilhada entre lista de documentos e JurisMind AI
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

  // ── JurisMind AI: ação principal do caso (painel lateral) ──
  const { hasOrgPermission } = useAccess();
  const canUseAi = hasOrgPermission("ai.use");
  const canUpload = hasOrgPermission("documents.upload");
  const [aiOpen, setAiOpen] = useState(tab === "jurismind");
  // Thread persistida compartilhada entre o painel e a rota de tela inteira.
  const [aiThreadId, setAiThreadId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const openAi = (prompt?: string) => {
    setAiPrompt(prompt ?? null);
    setAiOpen(true);
  };



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

  const editDirty =
    editing &&
    !!caseData &&
    (form.title !== (caseData.title ?? "") ||
      form.case_number !== (caseData.case_number ?? "") ||
      form.jurisdiction !== (caseData.jurisdiction ?? "") ||
      form.case_type !== (caseData.case_type ?? "") ||
      form.client_name !== (caseData.client_name ?? "") ||
      form.description !== (caseData.description ?? ""));
  const { dialog: unsavedDialog } = useUnsavedChangesGuard({ when: editDirty });

  const unifiedEvents: UnifiedEvent[] = useMemo(
    () =>
      events.map((e) => ({
        id: `local-${e.id}`,
        localId: e.id,
        title: e.title,
        description: e.description ?? null,
        starts_at: e.starts_at,
        event_type: e.event_type,
        case_id: e.case_id,
        source: "local" as const,
      })),
    [events],
  );

  const removeEvent = async (id: string) => {
    await deleteEventFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["events"] });
    toast.success("Compromisso excluído");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!caseData) return <p className="text-sm text-muted-foreground">Caso não encontrado.</p>;

  const parties = (caseData.parties ?? []) as Array<{
    role: string;
    name: string;
    relation?: string | null;
  }>;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/assistencias">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para casos
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-medium tracking-tight break-words">
              {caseData.title}
            </h1>
            {caseData.client_name && (
              <p className="mt-1 text-sm text-muted-foreground">
                Cliente: {caseData.client_name}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEdit} className="h-10">
              Editar dados
            </Button>
          </div>
        </div>
      </header>

      {/* ── Ação principal do caso: JurisMind AI ── */}
      {canUseAi && (
        <section
          aria-label="JurisMind AI neste caso"
          className="rounded-xl bg-[#000038] p-5 text-white shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <JurisMindMark
                size={40}
                context={JURISMIND_CONTEXT.chipDark}
                className="shrink-0"
              />
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-medium">
                  Perguntar ao JurisMind sobre este caso
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  {readyDocIds.length > 0
                    ? `${readyDocIds.length} ${readyDocIds.length === 1 ? "documento" : "documentos"} deste caso já podem ser consultados, com as fontes citadas na resposta.`
                    : "Envie documentos ao caso para que as respostas venham com as fontes citadas."}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => openAi()}
              aria-haspopup="dialog"
              aria-expanded={aiOpen}
              className="bg-[#00FFFF] font-medium text-[#000038] hover:bg-[#00FFFF]/85"
            >
              Abrir JurisMind
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Analisar documentos",
                prompt:
                  "Analise os documentos deste caso e aponte as conclusões principais, citando as fontes.",
              },
              {
                label: "Redigir peça",
                prompt:
                  "Redija uma minuta de peça com base nos documentos selecionados deste caso.",
              },
              {
                label: "Gerar planilha",
                prompt:
                  "Organize em uma planilha comparativa os valores e datas relevantes dos documentos deste caso.",
              },
              {
                label: "Montar apresentação",
                prompt:
                  "Prepare uma apresentação executiva deste caso para reunião com o cliente.",
              },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => openAi(a.prompt)}
                className="rounded-lg border border-white/25 bg-white/5 px-3 py-2.5 text-left text-[15px] font-medium text-white transition hover:border-[#00FFFF]/70 hover:bg-white/10"
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}


      <Tabs defaultValue={tab && tab !== "jurismind" ? tab : "visao-geral"} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral" className="text-sm">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-sm">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="producao" className="text-sm">
            Produção
          </TabsTrigger>
          <TabsTrigger value="prazos" className="text-sm">
            Prazos e tarefas
          </TabsTrigger>
          <TabsTrigger value="atividade" className="text-sm">
            Atividade
          </TabsTrigger>
        </TabsList>

        {/* ─────────── Visão geral ─────────── */}
        <TabsContent value="visao-geral" className="space-y-6">
          {editing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Editar dados do caso</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm">Título do caso</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Cliente</Label>
                  <Input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Número do processo</Label>
                  <Input
                    value={form.case_number}
                    onChange={(e) => setForm({ ...form, case_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Vara / Tribunal</Label>
                  <Input
                    value={form.jurisdiction}
                    onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Área</Label>
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm">Descrição</Label>
                  <Textarea
                    className="text-sm"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button onClick={saveEdit}>Salvar</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <h2 className="font-heading text-base font-medium">Dados do caso</h2>
              <ul className="space-y-1.5 border-y border-black/5 py-3 dark:border-white/10">
                {caseData.client_name && (
                  <CaseDataRow label="Cliente" value={caseData.client_name} />
                )}
                {caseData.case_number && (
                  <CaseDataRow label="Número do processo" value={caseData.case_number} />
                )}
                {caseData.jurisdiction && (
                  <CaseDataRow label="Vara / Tribunal" value={caseData.jurisdiction} />
                )}
                {caseData.case_type && <CaseDataRow label="Área" value={caseData.case_type} />}
                {!caseData.client_name &&
                  !caseData.case_number &&
                  !caseData.jurisdiction &&
                  !caseData.case_type && (
                    <li className="text-sm text-muted-foreground">
                      Nenhum dado cadastrado. Use "Editar dados".
                    </li>
                  )}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-base font-medium">Partes envolvidas</h2>
              <ul className="space-y-1.5 border-y border-black/5 py-3 dark:border-white/10">
                {parties.length === 0 ? (
                  <li className="text-sm text-muted-foreground">Nenhuma parte cadastrada.</li>
                ) : (
                  parties.map((party, i) => (
                    <CaseDataRow key={i} label={capitalize(party.role)} value={party.name} />
                  ))
                )}
              </ul>
            </section>
          </div>

          <CaseSummaryCard
            caseId={caseId}
            caseTitle={caseData.title}
            summary={caseData.summary ?? null}
            summaryUpdatedAt={caseData.summary_updated_at ?? null}
            hasReadyDocs={readyDocIds.length > 0}
          />

          {caseData.matter_kind && caseData.matter_kind !== "processo" && (
            <QuesitosCard caseId={caseId} matterKind={caseData.matter_kind as MatterKind} />
          )}
        </TabsContent>

        {/* ─────────── Documentos ─────────── */}
        <TabsContent value="documentos">
          <DocumentList
            caseId={caseId}
            documents={docs}
            selectedDocIds={selectedDocIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        </TabsContent>

        {/* ─────────── Produção ─────────── */}
        <TabsContent value="producao">
          <PieceGenerator fixedCaseId={caseId} fixedCaseTitle={caseData.title} />
        </TabsContent>

        {/* ─────────── Prazos e tarefas ─────────── */}
        <TabsContent value="prazos" className="space-y-8">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-base font-medium">Prazos e compromissos</h2>
              <AddEventDialog defaultCaseId={caseId}>
                <Button size="sm" variant="outline">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Novo compromisso
                </Button>
              </AddEventDialog>
            </div>
            <AgendaPanel
              events={unifiedEvents}
              caseTitle={() => null}
              onDelete={removeEvent}
              emptyTitle="Nenhum prazo cadastrado para este caso"
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-base font-medium">Tarefas</h2>
              <CaseTasksDialog
                caseId={caseId}
                caseTitle={caseData.title}
                trigger={
                  <Button size="sm" variant="outline">
                    <ListTodo className="mr-2 h-4 w-4" /> Gerenciar tarefas
                  </Button>
                }
              />
            </div>
            {tasks.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Nenhuma tarefa para este caso" />
            ) : (
              <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-3">
                    <Checkbox
                      className="mt-0.5 shrink-0"
                      checked={t.status === "done"}
                      aria-label={`Concluir ${t.title}`}
                      onCheckedChange={async (c) => {
                        await toggleTaskFn({ data: { id: t.id, done: Boolean(c) } });
                        await qc.invalidateQueries({ queryKey: ["tasks", caseId] });
                      }}
                    />
                    <span
                      className={`min-w-0 flex-1 break-words text-sm ${
                        t.status === "done" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* ─────────── Atividade ─────────── */}
        <TabsContent value="atividade">
          <div className="h-[calc(100svh-20rem)] min-h-[28rem] overflow-hidden rounded-lg border">
            {conversation?.id ? (
              <ConversationView
                conversationId={conversation.id}
                title="Atividade do caso"
                subtitle="Conversa da equipe vinculada a este caso"
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Carregando atividade...</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {canUseAi && caseData && (
        <CaseJurisMindPanel
          open={aiOpen}
          onOpenChange={setAiOpen}
          caseId={caseId}
          threadId={aiThreadId}
          onThreadChange={setAiThreadId}
          canUpload={canUpload}
          initialPrompt={aiPrompt}

          caseInfo={{
            title: caseData.title,
            client_name: caseData.client_name,
            status: caseData.status,
            case_number: caseData.case_number,
            case_type: caseData.case_type,
            jurisdiction: caseData.jurisdiction,
            parties,
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
      )}

      {unsavedDialog}
    </div>
  );
}
