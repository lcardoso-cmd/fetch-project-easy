import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Link2, PlusCircle, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
  formatCents,
  type ProposalStatus,
} from "@/lib/crm-schema";
import type { CrmAccess } from "@/lib/crm.functions";
import {
  approveProposal,
  convertProposalToCase,
  createProposal,
  getProposal,
  listProposals,
  recordProposalOutcome,
} from "@/lib/crm-proposals.functions";
import {
  createProposalShare,
  revokeProposalShare,
} from "@/lib/proposal-shares.functions";


const PAGE_SIZE = 25;

type ProposalRow = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  fixed_value_cents: number;
  recurring_value_cents: number;
  currency: string;
  valid_until: string | null;
  sent_at: string | null;
  view_count: number | null;
  responded_at: string | null;
  converted_case_id: string | null;
  opportunity_id: string | null;
  created_at: string;
};

export function CrmProposalsPanel({ access }: { access: CrmAccess }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listProposals);
  const approve = useServerFn(approveProposal);
  const outcome = useServerFn(recordProposalOutcome);
  const convert = useServerFn(convertProposalToCase);
  const create = useServerFn(createProposal);
  const fetchProposal = useServerFn(getProposal);
  const makeShare = useServerFn(createProposalShare);
  const revokeShare = useServerFn(revokeProposalShare);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProposalStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [outcomeRow, setOutcomeRow] = useState<{ row: ProposalRow; kind: "accepted" | "declined" } | null>(null);
  const [reason, setReason] = useState("");
  const [shareRow, setShareRow] = useState<ProposalRow | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareDays, setShareDays] = useState("30");
  const [shareList, setShareList] = useState<
    { id: string; token: string; revoked_at: string | null; expires_at: string | null; download_count: number }[]
  >([]);
  const [shareLoading, setShareLoading] = useState(false);


  const query = useQuery({
    queryKey: ["crm-proposals", search, status, page],
    queryFn: () =>
      list({
        data: {
          search: search.trim() || undefined,
          status,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  const rows = (query.data?.rows ?? []) as ProposalRow[];
  const total = query.data?.total ?? 0;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["crm-proposals"] });
    void qc.invalidateQueries({ queryKey: ["crm-overview"] });
    void qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
  }

  async function startBlank() {
    setBusy(true);
    try {
      const row = (await create({
        data: {
          title: "Nova proposta comercial",
          content_html: "",
          form: {},
          fixed_value_cents: 0,
          recurring_value_cents: 0,
          currency: "BRL",
        },
      })) as { id: string };
      void navigate({ to: "/propostas", search: { proposal: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  async function doApprove(id: string) {
    setBusy(true);
    try {
      await approve({ data: { id } });
      toast.success("Proposta aprovada internamente.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function saveOutcome() {
    if (!outcomeRow) return;
    setBusy(true);
    try {
      const res = (await outcome({
        data: {
          id: outcomeRow.row.id,
          outcome: outcomeRow.kind,
          comment: outcomeRow.kind === "accepted" ? reason.trim() || null : null,
          decline_reason: outcomeRow.kind === "declined" ? reason.trim() : null,
        },
      })) as { already: boolean };
      toast.success(
        res.already ? "Esta proposta já tinha resposta registrada." : "Resposta registrada.",
      );
      setOutcomeRow(null);
      setReason("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function doConvert(row: ProposalRow) {
    setBusy(true);
    try {
      const res = (await convert({
        data: { proposal_id: row.id, case_title: row.title },
      })) as { case_id: string };
      refresh();
      void navigate({ to: "/cases/$caseId", params: { caseId: res.case_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível converter.");
    } finally {
      setBusy(false);
    }
  }

  async function openShare(row: ProposalRow) {
    setShareRow(row);
    setSharePassword("");
    setShareDays("30");
    setShareList([]);
    setShareLoading(true);
    try {
      const res = (await fetchProposal({ data: { id: row.id } })) as {
        shares?: { id: string; token: string; revoked_at: string | null; expires_at: string | null; download_count: number }[];
      };
      setShareList(res.shares ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os links.");
    } finally {
      setShareLoading(false);
    }
  }

  async function generateShare() {
    if (!shareRow) return;
    setBusy(true);
    try {
      const full = (await fetchProposal({ data: { id: shareRow.id } })) as {
        proposal?: { content_html?: string | null; title?: string; client_name?: string | null };
      };
      const html = full.proposal?.content_html?.trim();
      if (!html) {
        toast.error("Escreva o conteúdo da proposta no editor antes de compartilhar.");
        return;
      }
      const days = Number(shareDays);
      const share = (await makeShare({
        data: {
          proposal_id: shareRow.id,
          title: shareRow.title,
          client_name: full.proposal?.client_name ?? null,
          html,
          page: { format: "A4", orientation: "portrait" },
          cover: null,
          watermark: null,
          password: sharePassword.trim() ? sharePassword.trim() : null,
          expires_in_days: Number.isFinite(days) && days > 0 ? Math.min(365, Math.round(days)) : null,
        },
      })) as { id: string; token: string; expires_at: string | null };
      const url = `${window.location.origin}/p/${share.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link gerado e copiado.");
      } catch {
        toast.success(`Link gerado: ${url}`);
      }
      setShareList((prev) => [
        { id: share.id, token: share.token, revoked_at: null, expires_at: share.expires_at, download_count: 0 },
        ...prev,
      ]);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function doRevokeShare(id: string) {
    setBusy(true);
    try {
      await revokeShare({ data: { id } });
      setShareList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s)),
      );
      toast.success("Link revogado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível revogar.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="prop-search" className="text-xs">
            Buscar por título
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="prop-search"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prop-status" className="text-xs">
            Situação
          </Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0);
              setStatus(v as ProposalStatus | "all");
            }}
          >
            <SelectTrigger id="prop-status" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PROPOSAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROPOSAL_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {access.proposalsCreate && (
          <div className="flex items-end">
            <Button disabled={busy} onClick={() => void startBlank()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nova proposta
            </Button>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando propostas…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhuma proposta registrada"
          description="As propostas criadas a partir das oportunidades aparecem aqui com status, visualizações e resposta do cliente."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {row.number ? `${row.number} · ` : ""}
                    {row.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {access.viewValues
                      ? `${formatCents(row.fixed_value_cents, row.currency)} · `
                      : ""}
                    {row.sent_at
                      ? `enviada em ${new Date(row.sent_at).toLocaleDateString("pt-BR")}`
                      : "não enviada"}
                    {row.view_count ? ` · ${row.view_count} visualizações` : ""}
                    {row.valid_until ? ` · válida até ${row.valid_until}` : ""}
                  </p>
                </div>
                <Badge variant={row.status === "accepted" ? "default" : "secondary"}>
                  {PROPOSAL_STATUS_LABELS[(row.status as ProposalStatus) ?? "draft"]}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigate({ to: "/propostas", search: { proposal: row.id } })}
                >
                  Abrir editor
                </Button>
                {access.proposalsApprove && ["draft", "in_review"].includes(row.status) && (
                  <Button size="sm" disabled={busy} onClick={() => void doApprove(row.id)}>
                    Aprovar
                  </Button>
                )}
                {access.proposalsShare && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void openShare(row)}
                  >
                    <Link2 className="mr-2 h-4 w-4" /> Compartilhar
                  </Button>
                )}

                {access.recordOutcome &&
                  !["accepted", "declined", "canceled"].includes(row.status) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReason("");
                          setOutcomeRow({ row, kind: "accepted" });
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar aceite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReason("");
                          setOutcomeRow({ row, kind: "declined" });
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Registrar recusa
                      </Button>
                    </>
                  )}
                {access.convert && row.status === "accepted" && (
                  <Button size="sm" disabled={busy} onClick={() => void doConvert(row)}>
                    {row.converted_case_id ? "Abrir caso" : "Converter em caso"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!outcomeRow} onOpenChange={(o) => !o && setOutcomeRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {outcomeRow?.kind === "accepted" ? "Registrar aceite" : "Registrar recusa"}
            </DialogTitle>
            <DialogDescription>
              A resposta atualiza a proposta e a etapa da oportunidade vinculada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="outcome-reason">
              {outcomeRow?.kind === "accepted" ? "Comentário (opcional)" : "Motivo da recusa"}
            </Label>
            <Textarea
              id="outcome-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutcomeRow(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              disabled={
                busy || (outcomeRow?.kind === "declined" && reason.trim().length < 3)
              }
              onClick={() => void saveOutcome()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareRow} onOpenChange={(o) => !o && setShareRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar proposta</DialogTitle>
            <DialogDescription>
              O link público permite ao cliente visualizar, aceitar ou recusar a proposta. Cada
              acesso e resposta fica registrado no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="share-days">Validade (dias)</Label>
              <Input
                id="share-days"
                inputMode="numeric"
                value={shareDays}
                onChange={(e) => setShareDays(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-password">Senha (opcional)</Label>
              <Input
                id="share-password"
                type="text"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Links existentes</h4>
            {shareLoading ? (
              <p className="text-sm text-muted-foreground">Carregando links…</p>
            ) : shareList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum link gerado ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {shareList.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">/p/{s.token}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.revoked_at
                        ? "revogado"
                        : s.expires_at
                          ? `até ${new Date(s.expires_at).toLocaleDateString("pt-BR")}`
                          : "sem expiração"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/p/${s.token}`)
                          .then(() => toast.success("Link copiado."))
                          .catch(() => toast.error("Copie manualmente o link."));
                      }}
                    >
                      Copiar
                    </Button>
                    {!s.revoked_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void doRevokeShare(s.id)}
                      >
                        Revogar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareRow(null)} disabled={busy}>
              Fechar
            </Button>
            <Button
              disabled={busy || (!!sharePassword.trim() && sharePassword.trim().length < 4)}
              onClick={() => void generateShare()}
            >
              Gerar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
