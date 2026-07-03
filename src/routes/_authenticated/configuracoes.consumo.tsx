import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { getAiUsageSummary, getAiBudgetStatus, updateAiBudget, type UsageSummary } from "@/lib/ai-usage.functions";
import { BudgetCard } from "@/components/ai/budget-card";

export const Route = createFileRoute("/_authenticated/configuracoes/consumo")({
  component: ConsumoPage,
});

const FEATURE_LABELS: Record<string, string> = {
  chat_stream: "Chat JurisMind (streaming)",
  chat: "Chat JurisMind",
  embeddings: "Indexação (embeddings)",
  proposal: "Proposta comercial",
  petition: "Peças jurídicas",
  expert_opinion: "Parecer técnico",
  case_title: "Nome do caso",
  transcribe: "Transcrição de áudio",
  unknown: "Outros",
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function fmtUsd(n: number) {
  return `US$ ${n.toFixed(4)}`;
}

function fmtBrl(usd: number, rate: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(usd * rate);
}

function ConsumoPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [userFilter, setUserFilter] = useState<string>("all");
  // Taxa média estimada USD→BRL (ajustável). Guardada só na UI.
  const [rate, setRate] = useState<number>(5.5);

  const summaryFn = useServerFn(getAiUsageSummary);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["ai-usage", year, month, userFilter],
    queryFn: () =>
      summaryFn({
        data: {
          year,
          month,
          user_id: userFilter === "all" ? null : userFilter,
        },
      }),
  });

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [year, month],
  );

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  const maxDayTokens = data ? Math.max(1, ...data.by_day.map((d) => d.total_tokens)) : 1;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl font-medium tracking-tight">Consumo de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.scope === "workspace"
            ? "Consumo agregado do escritório (todos os usuários) com estimativa de custo."
            : "Seu consumo pessoal com estimativa de custo. Admins do escritório veem o total consolidado."}
        </p>
      </div>

      <BudgetCard />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium capitalize min-w-[9rem] text-center">
            {monthLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>

          {data?.scope === "workspace" && data.by_user.length > 0 && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-8 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {data.by_user.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Câmbio USD→BRL</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8">
              {isFetching && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isFetching && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !data || data.totals.calls === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum consumo registrado neste mês.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Chamadas" value={fmtInt(data.totals.calls)} />
            <MetricCard label="Tokens (total)" value={fmtInt(data.totals.total_tokens)} />
            <MetricCard
              label="Custo estimado"
              value={fmtUsd(data.totals.cost_usd)}
              hint={rate > 0 ? fmtBrl(data.totals.cost_usd, rate) : undefined}
            />
            <MetricCard
              label="Prompt / Resposta"
              value={`${fmtInt(data.totals.prompt_tokens)} / ${fmtInt(data.totals.completion_tokens)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Consumo diário
              </CardTitle>
              <CardDescription>Tokens por dia no mês selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {data.by_day.map((d) => {
                  const h = Math.max(2, Math.round((d.total_tokens / maxDayTokens) * 120));
                  return (
                    <div
                      key={d.day}
                      className="flex-1 min-w-[8px] rounded-t bg-primary/80 hover:bg-primary transition-colors"
                      style={{ height: `${h}px` }}
                      title={`${d.day} — ${fmtInt(d.total_tokens)} tokens · ${fmtUsd(d.cost_usd)}`}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{data.by_day[0]?.day ?? "—"}</span>
                <span>{data.by_day[data.by_day.length - 1]?.day ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Por funcionalidade"
              rows={data.by_feature.map((f) => ({
                key: f.feature,
                label: FEATURE_LABELS[f.feature] ?? f.feature,
                calls: f.calls,
                tokens: f.total_tokens,
                cost: f.cost_usd,
              }))}
              rate={rate}
            />
            <BreakdownCard
              title="Por modelo"
              rows={data.by_model.map((m) => ({
                key: m.model,
                label: m.model,
                calls: m.calls,
                tokens: m.total_tokens,
                cost: m.cost_usd,
              }))}
              rate={rate}
            />
          </div>

          {data.scope === "workspace" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por usuário</CardTitle>
                <CardDescription>
                  Total consolidado do escritório no mês. Custo estimado com base nos preços
                  públicos dos provedores.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Usuário</th>
                      <th className="text-right px-4 py-2 font-medium">Chamadas</th>
                      <th className="text-right px-4 py-2 font-medium">Tokens</th>
                      <th className="text-right px-4 py-2 font-medium">Custo (USD)</th>
                      {rate > 0 && <th className="text-right px-4 py-2 font-medium">Custo (BRL)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.by_user.map((u) => (
                      <tr key={u.user_id}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{u.name}</div>
                          {u.email && (
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtInt(u.calls)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtInt(u.total_tokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtUsd(u.cost_usd)}
                        </td>
                        {rate > 0 && (
                          <td className="px-4 py-2 text-right tabular-nums">
                            {fmtBrl(u.cost_usd, rate)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Estimativas baseadas em <code>src/lib/ai-pricing.ts</code>. Ajuste os preços por modelo
            para refletir o seu contrato com o provedor. Somente eventos após a ativação deste
            painel são contabilizados.
          </p>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-medium tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

interface BreakdownRow {
  key: string;
  label: string;
  calls: number;
  tokens: number;
  cost: number;
}

function BreakdownCard({
  title,
  rows,
  rate,
}: {
  title: string;
  rows: BreakdownRow[];
  rate: number;
}) {
  const total = Math.max(1, rows.reduce((s, r) => s + r.tokens, 0));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          rows.map((r) => {
            const pct = Math.round((r.tokens / total) * 100);
            return (
              <div key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {fmtInt(r.tokens)} tok · {fmtUsd(r.cost)}
                    {rate > 0 ? ` · ${fmtBrl(r.cost, rate)}` : ""}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
