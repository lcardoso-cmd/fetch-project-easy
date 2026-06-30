import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { getCase, updateCase } from "@/lib/cases.functions";
import { listDocuments, deleteDocument } from "@/lib/documents.functions";
import { summarizeCase } from "@/lib/chat.functions";
import { listEvents } from "@/lib/events.functions";
import { listTasks, toggleTask } from "@/lib/tasks.functions";
import { UploadZone } from "@/components/documents/upload-zone";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FileText, Loader2, Sparkles, Trash2, CalendarClock, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const queryClient = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const updateCaseFn = useServerFn(updateCase);
  const listDocsFn = useServerFn(listDocuments);
  const deleteDocFn = useServerFn(deleteDocument);
  const summarizeFn = useServerFn(summarizeCase);
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

  const [summarizing, setSummarizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    case_number: "",
    jurisdiction: "",
    case_type: "",
    client_name: "",
    description: "",
  });

  const openEdit = () => {
    if (!caseData) return;
    setForm({
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
    await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    setEditing(false);
    toast.success("Caso atualizado");
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      await summarizeFn({ data: { case_id: caseId } });
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      toast.success("Resumo gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no resumo");
    } finally {
      setSummarizing(false);
    }
  };

  const handleDeleteDoc = async (id: string, name: string) => {
    if (!confirm(`Excluir ${name}?`)) return;
    await deleteDocFn({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!caseData) return <p className="text-muted-foreground">Caso não encontrado.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/cases">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{caseData.title}</h1>
          {caseData.client_name && (
            <p className="mt-1 text-muted-foreground">Cliente: {caseData.client_name}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {caseData.case_number && <Badge variant="secondary">N° {caseData.case_number}</Badge>}
            {caseData.jurisdiction && <Badge variant="secondary">{caseData.jurisdiction}</Badge>}
            {caseData.case_type && <Badge variant="secondary">{caseData.case_type}</Badge>}
          </div>
        </div>
        <Button variant="outline" onClick={openEdit}>
          Editar dados
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Editar caso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Número do processo</Label>
              <Input
                value={form.case_number}
                onChange={(e) => setForm({ ...form, case_number: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Jurisdição</Label>
              <Input
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                placeholder="Ex.: TJSP — 3ª Vara Cível"
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
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadZone caseId={caseId} />
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{d.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(d.file_size ?? 0) > 0
                            ? `${Math.round((d.file_size ?? 0) / 1024)} KB · `
                            : ""}
                          <StatusBadge status={d.processing_status} />
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteDoc(d.id, d.filename)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Resumo IA */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Resumo do caso (IA)</CardTitle>
            <Button size="sm" onClick={handleSummarize} disabled={summarizing}>
              {summarizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {caseData.summary ? "Atualizar" : "Gerar resumo"}
            </Button>
          </CardHeader>
          <CardContent>
            {caseData.summary ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                {caseData.summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Indexe documentos e clique em "Gerar resumo" para um overview automático.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
                Nenhum evento. O assistente pode criar usando a tool <code>create_event</code>.
              </p>
            ) : (
              <ul className="divide-y">
                {events.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{ev.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
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
            <Button size="sm" variant="ghost" asChild>
              <Link to="/my-tasks">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa para este caso.</p>
            ) : (
              <ul className="divide-y">
                {tasks.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={async (c) => {
                        await toggleTaskFn({ data: { id: t.id, done: Boolean(c) } });
                        await queryClient.invalidateQueries({ queryKey: ["tasks", caseId] });
                      }}
                    />
                    <span
                      className={
                        t.status === "done" ? "line-through text-muted-foreground" : ""
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

      {/* Chat */}
      <div>
        <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground">
          Pergunte sobre este caso
        </h2>
        <ChatPanel
          caseId={caseId}
          pendingDocs={docs.filter((d) => d.processing_status === "pending" || d.processing_status === "processing").length}
          readyDocs={docs.filter((d) => d.processing_status === "ready").length}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "Aguardando",
    processing: "Indexando...",
    ready: "Pronto",
    empty: "Sem texto",
  };
  const label = map[status] ?? status;
  return <span>{label}</span>;
}
