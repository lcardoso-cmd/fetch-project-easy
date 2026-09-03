import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Building2,
  CreditCard,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Receipt,
  Timer,
} from "lucide-react";
import { getCommercialKpis } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import { KpiCard } from "@/components/platform/billing-ui";
import { ORG_STATUS_LABELS, formatMoneyCents } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) {
        throw new Error("nope");
      }
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Backoffice comercial — JurisMind" },
      {
        name: "description",
        content:
          "Painel B2B da JurisMind: clientes, assinaturas, receita recorrente, faturas e consumo de IA.",
      },
      { property: "og:title", content: "Backoffice comercial — JurisMind" },
      {
        property: "og:description",
        content: "Operação comercial do SaaS jurídico JurisMind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformOverview,
});

function PlatformOverview() {
  const fn = useServerFn(getCommercialKpis);
  const { data, isLoading, error } = useQuery({
    queryKey: ["commercial-kpis"],
    queryFn: () => fn(),
  });

  const dash = isLoading ? "…" : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backoffice comercial"
        subtitle="Operação B2B da JurisMind — clientes, receita recorrente, cobrança e consumo."
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Não foi possível carregar os indicadores: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Clientes"
          value={dash ?? String(data?.customers ?? 0)}
          hint={
            data
              ? `${data.newLast30} novos · ${data.churnedLast30} cancelados (30d)`
              : undefined
          }
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="MRR"
          value={dash ?? formatMoneyCents(data?.mrrCents ?? 0)}
          hint={data ? `ARR ${formatMoneyCents(data.arrCents)}` : undefined}
        />
        <KpiCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Clientes pagantes"
          value={dash ?? String(data?.payingCustomers ?? 0)}
          hint={data ? `${data.convertedLast30} conversões em 30 dias` : undefined}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Usuários ativos (30d)"
          value={dash ?? String(data?.activeUsersLast30 ?? 0)}
        />
        <KpiCard
          icon={<Timer className="h-4 w-4" />}
          label="Avaliações terminando em 7 dias"
          value={dash ?? String(data?.trialsEndingIn7 ?? 0)}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Inadimplentes"
          value={dash ?? String(data?.delinquentCustomers ?? 0)}
          hint={data ? `${formatMoneyCents(data.overdueInvoiceCents)} vencidos` : undefined}
        />
        <KpiCard
          icon={<Receipt className="h-4 w-4" />}
          label="Faturas em aberto"
          value={dash ?? formatMoneyCents(data?.openInvoiceCents ?? 0)}
        />
        <KpiCard
          label="Custo de IA no mês"
          value={dash ?? `US$ ${(data?.aiCostMonthUsd ?? 0).toFixed(2)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes por situação</CardTitle>
            <CardDescription>Base atual de contratos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {data &&
              Object.entries(data.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span>
                    {(ORG_STATUS_LABELS as Record<string, string>)[status] ?? status}
                  </span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            {data && Object.keys(data.byStatus).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regras comerciais vigentes</CardTitle>
            <CardDescription>Definidas em Configuração comercial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data ? (
              <>
                <Row label="Avaliação gratuita" value={`${data.settings.trial_days} dias`} />
                <Row label="Tolerância após vencimento" value={`${data.settings.grace_days} dias`} />
                <Row
                  label="Ao expirar a avaliação"
                  value={
                    data.settings.trial_expired_policy === "read_only"
                      ? "Somente leitura"
                      : "Bloqueio total"
                  }
                />
                <Row
                  label="Inadimplência"
                  value={
                    data.settings.delinquency_policy === "suspend_after_grace"
                      ? "Suspende após tolerância"
                      : "Mantém ativo"
                  }
                />
                <Row label="Moeda padrão" value={data.settings.default_currency} />
              </>
            ) : (
              <p className="text-muted-foreground">Carregando…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestão comercial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/plataforma/clientes" label="Clientes e contratos" />
          <QuickLink to="/plataforma/assinaturas" label="Assinaturas" />
          <QuickLink to="/plataforma/faturas" label="Faturas" />
          <QuickLink to="/plataforma/pagamentos" label="Pagamentos" />
          <QuickLink to="/plataforma/planos" label="Planos e limites" />
          <QuickLink to="/plataforma/consumo" label="Consumo de IA por cliente" />
          <QuickLink to="/plataforma/usuarios" label="Usuários da plataforma" />
          <QuickLink to="/plataforma/configuracoes" label="Configuração comercial" />
          <QuickLink to="/plataforma/auditoria" label="Auditoria" />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
