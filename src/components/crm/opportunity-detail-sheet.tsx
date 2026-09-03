import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, FileText, Pencil, ShieldAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_STATUS_LABELS,
  CONFLICT_STATUSES,
  CONFLICT_STATUS_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_STAGE_LABELS,
  PROPOSAL_STATUS_LABELS,
  formatCents,
  type ActivityKind,
  type ActivityStatus,
  type ConflictStatus,
  type CrmPriority,
  type CrmStage,
  type ProposalStatus,
} from "@/lib/crm-schema";
import {
  decideConflictCheck,
  getOpportunity,
  runConflictCheck,
  type CrmAccess,
} from "@/lib/crm.functions";
import { convertProposalToCase, createProposal } from "@/lib/crm-proposals.functions";
import { ActivityFormDialog } from "./activity-form-dialog";
import type { OrgMember } from "@/lib/organization.functions";

type Props = {
  opportunityId: string | null;
  onOpenChange: (open: boolean) => void;
  access: CrmAccess;
  members: OrgMember[];
  onEdit: (id: string) => void;
};

export function OpportunityDetailSheet({
  opportunityId,
  onOpenChange,
  access,
  members,
  onEdit,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOpp = useServerFn(getOpportunity);
  const runConflict = useServerFn(runConflictCheck);
  const decide = useServerFn(decideConflictCheck);
  const newProposal = useServerFn(createProposal);
  const convert = useServerFn(convertProposalToCase);
  const [terms, setTerms] = useState("");
  const [conflictNotes, setConflictNotes] = useState("");
  const [conflictStatus, setConflictStatus] = useState<ConflictStatus>("cleared");
  const [activityOpen, setActivityOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["crm-opportunity", opportunityId],
    queryFn: () => fetchOpp({ data: { id: opportunityId! } }),
    enabled: !!opportunityId,
  });

  const opp = query.data?.opportunity as any;
  const lead = query.data?.lead as any;
  const history = (query.data?.history ?? []) as any[];
  const activities = (query.data?.activities ?? []) as any[];
  const conflict = query.data?.conflict as any;
  const proposals = (query.data?.proposals ?? []) as any[];
  const tasks = (query.data?.tasks ?? []) as any[];
  const events = (query.data?.events ?? []) as any[];

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["crm-opportunity", opportunityId] });
    void qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    void qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
  }

  async function search() {
    if (!opportunityId) return;
    const list = terms
      .split(/[\n;,]/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (list.length === 0) {
      toast.error("Informe ao menos um nome para pesquisar.");
      return;
    }
    setBusy(true);
    try {
      await runConflict({ data: { opportunity_id: opportunityId, terms: list } });
      toast.success("Pesquisa registrada. A decisão continua sendo humana.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pesquisar.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDecision() {
    if (!conflict) return;
    setBusy(true);
    try {
      await decide({
        data: { id: conflict.id, status: conflictStatus, notes: conflictNotes.trim() || null },
      });
      toast.success("Decisão registrada.");
      setConflictNotes("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function startProposal() {
    if (!opportunityId || !opp) return;
    setBusy(true);
    try {
      const row = (await newProposal({
        data: {
          title: opp.title,
          opportunity_id: opportunityId,
          lead_id: opp.lead_id ?? null,
          content_html: "",
          form: {},
          fixed_value_cents: opp.estimated_value_cents ?? 0,
          recurring_value_cents: 0,
          currency: opp.currency ?? "BRL",
        },
      })) as { id: string };
      toast.success("Proposta criada. Abrindo o editor.");
      void navigate({ to: "/propostas", search: { proposal: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a proposta.");
    } finally {
      setBusy(false);
    }
  }

  async function convertToCase(proposalId: string) {
    setBusy(true);
    try {
      const res = (await convert({
        data: {
          proposal_id: proposalId,
          case_title: opp?.title,
          client_name: lead?.name ?? null,
        },
      })) as { case_id: string; already: boolean };
      toast.success(res.already ? "Esta proposta já havia sido convertida." : "Caso criado.");
      refresh();
      void navigate({ to: "/cases/$caseId", params: { caseId: res.case_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível converter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!opportunityId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{opp?.title ?? "Oportunidade"}</SheetTitle>
          <SheetDescription>
            {opp
              ? `${CRM_STAGE_LABELS[(opp.stage as CrmStage) ?? "new_contact"]} · ${
                  lead?.name ?? "sem cliente vinculado"
                }`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        {query.isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Carregando dados…</p>
        )}
        {query.isError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {(query.error as Error).message}
          </p>
        )}

        {opp && (
          <Tabs defaultValue="resumo" className="mt-4">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="conflito">Conflito</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              <TabsTrigger value="propostas">Propostas</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(opp.id)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                {access.proposalsCreate && (
                  <Button size="sm" disabled={busy} onClick={() => void startProposal()}>
                    <FileText className="mr-2 h-4 w-4" /> Nova proposta
                  </Button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {access.viewValues && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor estimado</dt>
                    <dd className="font-medium">
                      {formatCents(opp.estimated_value_cents, opp.currency)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Probabilidade</dt>
                  <dd>{opp.probability}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prioridade</dt>
                  <dd>{CRM_PRIORITY_LABELS[(opp.priority as CrmPriority) ?? "medium"]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fechamento previsto</dt>
                  <dd>{opp.expected_close_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Área</dt>
                  <dd>{opp.practice_area ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Origem</dt>
                  <dd>{opp.source ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Próxima interação</dt>
                  <dd>
                    {opp.next_activity_at
                      ? new Date(opp.next_activity_at).toLocaleString("pt-BR")
                      : "Nenhuma agendada"}
                  </dd>
                </div>
                {opp.description && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Descrição</dt>
                    <dd className="whitespace-pre-wrap">{opp.description}</dd>
                  </div>
                )}
              </dl>

              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Tarefas vinculadas</h3>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {tasks.map((t) => (
                      <li key={t.id} className="rounded border p-2">
                        {t.title}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t.due_date ?? "sem prazo"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Compromissos</h3>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {events.map((ev) => (
                      <li key={ev.id} className="rounded border p-2">
                        {ev.title}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(ev.starts_at).toLocaleString("pt-BR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </TabsContent>

            <TabsContent value="conflito" className="space-y-4 pt-4">
              <div className="rounded border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  {conflict
                    ? CONFLICT_STATUS_LABELS[(conflict.status as ConflictStatus) ?? "pending"]
                    : "Nenhuma verificação realizada"}
                </p>
                {conflict?.decided_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Decisão registrada em{" "}
                    {new Date(conflict.decided_at).toLocaleString("pt-BR")}
                  </p>
                )}
                {conflict?.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{conflict.notes}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="conflict-terms">
                  Nomes a verificar (um por linha)
                </Label>
                <Textarea
                  id="conflict-terms"
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder={lead?.name ?? "Nome do cliente e da contraparte"}
                />
                <Button size="sm" disabled={busy} onClick={() => void search()}>
                  Pesquisar base interna
                </Button>
              </div>

              {conflict?.results && (
                <div className="space-y-2 text-sm">
                  <h4 className="font-medium">Resultados da última pesquisa</h4>
                  {(conflict.results as any[]).map((r) => (
                    <div key={r.term} className="rounded border p-2">
                      <p className="font-medium">{r.term}</p>
                      {r.cases?.length === 0 && r.leads?.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma coincidência encontrada.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {r.cases?.map((c: any) => (
                            <li key={`c-${c.id}`}>Caso: {c.title}</li>
                          ))}
                          {r.leads?.map((l: any) => (
                            <li key={`l-${l.id}`}>Cadastro: {l.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {conflict && (
                <div className="space-y-2 rounded border p-3">
                  <h4 className="text-sm font-medium">Decisão humana</h4>
                  <Select
                    value={conflictStatus}
                    onValueChange={(v) => setConflictStatus(v as ConflictStatus)}
                  >
                    <SelectTrigger aria-label="Decisão do conflito">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONFLICT_STATUSES.filter((s) => s !== "pending").map((s) => (
                        <SelectItem key={s} value={s}>
                          {CONFLICT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    rows={2}
                    value={conflictNotes}
                    onChange={(e) => setConflictNotes(e.target.value)}
                    placeholder="Fundamento da decisão (obrigatório ao liberar com ressalva)"
                  />
                  <Button size="sm" disabled={busy} onClick={() => void saveDecision()}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar decisão
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="atividades" className="space-y-3 pt-4">
              <Button size="sm" onClick={() => setActivityOpen(true)}>
                Registrar atividade
              </Button>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade registrada.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activities.map((a) => (
                    <li key={a.id} className="rounded border p-2">
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTIVITY_KIND_LABELS[(a.kind as ActivityKind) ?? "note"]} ·{" "}
                        {ACTIVITY_STATUS_LABELS[(a.status as ActivityStatus) ?? "open"]}
                        {a.activity_at
                          ? ` · ${new Date(a.activity_at).toLocaleString("pt-BR")}`
                          : ""}
                      </p>
                      {a.outcome && <p className="mt-1 text-sm">{a.outcome}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="propostas" className="space-y-3 pt-4">
              {access.proposalsCreate && (
                <Button size="sm" disabled={busy} onClick={() => void startProposal()}>
                  <FileText className="mr-2 h-4 w-4" /> Nova proposta
                </Button>
              )}
              {proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma proposta vinculada a esta oportunidade.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {proposals.map((p) => (
                    <li key={p.id} className="space-y-2 rounded border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {p.number ? `${p.number} · ` : ""}
                            {p.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {PROPOSAL_STATUS_LABELS[(p.status as ProposalStatus) ?? "draft"]}
                            {access.viewValues
                              ? ` · ${formatCents(p.fixed_value_cents, p.currency)}`
                              : ""}
                            {p.view_count ? ` · ${p.view_count} visualizações` : ""}
                          </p>
                        </div>
                        <Badge variant={p.status === "accepted" ? "default" : "secondary"}>
                          {PROPOSAL_STATUS_LABELS[(p.status as ProposalStatus) ?? "draft"]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void navigate({ to: "/propostas", search: { proposal: p.id } })
                          }
                        >
                          Abrir editor
                        </Button>
                        {access.convert && p.status === "accepted" && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void convertToCase(p.id)}
                          >
                            {p.converted_case_id ? "Abrir caso" : "Converter em caso"}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-2 pt-4">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem movimentações registradas.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="rounded border p-2">
                      <p>
                        {h.from_stage
                          ? `${CRM_STAGE_LABELS[h.from_stage as CrmStage] ?? h.from_stage} → `
                          : ""}
                        <strong>
                          {CRM_STAGE_LABELS[h.to_stage as CrmStage] ?? h.to_stage}
                        </strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </p>
                      {h.note && <p className="mt-1 text-sm">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        )}

        <ActivityFormDialog
          open={activityOpen}
          onOpenChange={setActivityOpen}
          members={members}
          defaultOpportunityId={opportunityId ?? undefined}
          onSaved={refresh}
        />
      </SheetContent>
    </Sheet>
  );
}
