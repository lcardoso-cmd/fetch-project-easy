import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_STAGE_LABELS, formatCents } from "@/lib/crm-schema";
import { getCrmOverview, getCrmReport, type CrmAccess } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function CrmOverviewPanel({
  access,
  members,
}: {
  access: CrmAccess;
  members: OrgMember[];
}) {
  const overviewFn = useServerFn(getCrmOverview);
  const reportFn = useServerFn(getCrmReport);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState("");
  const [owner, setOwner] = useState("all");

  const range = useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    }),
    [from, to],
  );

  const overview = useQuery({
    queryKey: ["crm-overview", range.from, range.to, owner],
    queryFn: () =>
      overviewFn({
        data: {
          from: range.from,
          to: range.to,
          owner_user_id: owner === "all" ? undefined : owner,
        },
      }),
  });

  const report = useQuery({
    queryKey: ["crm-report", range.from, range.to],
    queryFn: () => reportFn({ data: { from: range.from, to: range.to } }),
  });

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  );

  const pipeline = overview.data?.pipeline;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr]">
        <div className="space-y-1">
          <Label htmlFor="ov-from" className="text-xs">
            De
          </Label>
          <Input
            id="ov-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ov-to" className="text-xs">
            Até
          </Label>
          <Input id="ov-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ov-owner" className="text-xs">
            Responsável
          </Label>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger id="ov-owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {overview.isError && (
        <p className="text-sm text-destructive" role="alert">
          {(overview.error as Error).message}
        </p>
      )}

      {overview.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Oportunidades em andamento</CardDescription>
                <CardTitle className="text-2xl">{pipeline?.open ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {pipeline?.withoutNextActivity ?? 0} sem próxima interação
              </CardContent>
            </Card>
            {access.viewValues && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Valor em negociação</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCents(pipeline?.openValueCents ?? 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Ganho no período: {formatCents(pipeline?.wonValueCents ?? 0)}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Taxa de conversão</CardDescription>
                <CardTitle className="text-2xl">
                  {pipeline?.conversionRate === null || pipeline?.conversionRate === undefined
                    ? "—"
                    : `${Math.round(pipeline.conversionRate * 100)}%`}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {pipeline?.won ?? 0} ganhas · {pipeline?.lost ?? 0} perdidas
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Atividades abertas</CardDescription>
                <CardTitle className="text-2xl">
                  {overview.data?.activities.open ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {overview.data?.activities.overdue ?? 0} em atraso
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por etapa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(pipeline?.byStage ?? []).every((s) => s.count === 0) ? (
                  <p className="text-muted-foreground">
                    Nenhuma oportunidade no período selecionado.
                  </p>
                ) : (
                  (pipeline?.byStage ?? []).map((s) => (
                    <div key={s.stage} className="flex items-center justify-between">
                      <span>{CRM_STAGE_LABELS[s.stage]}</span>
                      <span className="text-muted-foreground">
                        {s.count}
                        {access.viewValues ? ` · ${formatCents(s.valueCents)}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Propostas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>{overview.data?.proposals.total ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Enviadas</span>
                  <span>{overview.data?.proposals.sent ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aceitas</span>
                  <span>{overview.data?.proposals.accepted ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recusadas</span>
                  <span>{overview.data?.proposals.declined ?? 0}</span>
                </div>
                {access.viewValues && (
                  <div className="flex justify-between">
                    <span>Em aberto com o cliente</span>
                    <span>{formatCents(overview.data?.proposals.openValueCents ?? 0)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por responsável</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(report.data?.byOwner ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Sem dados no período.</p>
                ) : (
                  (report.data?.byOwner ?? []).map((r) => (
                    <div key={r.value} className="flex justify-between">
                      <span>
                        {r.value === "__none__"
                          ? "Sem responsável"
                          : (nameById.get(r.value) ?? "Membro removido")}
                      </span>
                      <span className="text-muted-foreground">
                        {r.count}
                        {access.viewValues ? ` · ${formatCents(r.valueCents)}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por origem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(report.data?.bySource ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Sem dados no período.</p>
                ) : (
                  (report.data?.bySource ?? []).map((r) => (
                    <div key={r.value} className="flex justify-between">
                      <span>{r.value === "__none__" ? "Não informada" : r.value}</span>
                      <span className="text-muted-foreground">{r.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motivos de perda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(report.data?.lossReasons ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma perda registrada.</p>
                ) : (
                  (report.data?.lossReasons ?? []).map((r) => (
                    <div key={r.reason} className="flex justify-between">
                      <span>{r.reason}</span>
                      <span className="text-muted-foreground">{r.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
