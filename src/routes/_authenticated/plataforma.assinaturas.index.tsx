import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { listSubscriptionsAdmin } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  BackToPlatform,
  EmptyRow,
  Money,
  ProviderBadge,
  StatusPill,
  dateBR,
} from "@/components/platform/billing-ui";
import {
  BILLING_INTERVAL_LABELS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  formatMoneyCents,
  type BillingInterval,
} from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/assinaturas/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Assinaturas — JurisMind" },
      {
        name: "description",
        content: "Assinaturas vigentes da JurisMind, ciclos de cobrança e receita recorrente.",
      },
      { property: "og:title", content: "Assinaturas — JurisMind" },
      { property: "og:description", content: "Controle de contratos recorrentes do SaaS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const listFn = useServerFn(listSubscriptionsAdmin);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-subscriptions", status, provider],
    queryFn: () =>
      listFn({
        data: {
          status: (status || undefined) as never,
          provider: (provider || undefined) as never,
          limit: 200,
        },
      }),
  });

  const totalMrr = (data ?? [])
    .filter((s) => s.status === "active" || s.status === "past_due")
    .reduce((sum, s) => sum + s.mrr_cents, 0);

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Assinaturas"
        subtitle="Contratos recorrentes vigentes e encerrados, com receita mensal equivalente."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todas as situações</option>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUBSCRIPTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Todas as origens</option>
          <option value="stripe">Cobrança online</option>
          <option value="manual">Contrato manual</option>
        </select>
        <div className="flex items-center rounded-md border px-3 text-sm">
          MRR filtrado: <strong className="ml-2">{formatMoneyCents(totalMrr)}</strong>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Carregando…" : `${data?.length ?? 0} assinaturas`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Plano</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-left">Ciclo</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">MRR</th>
                  <th className="px-4 py-2 text-left">Vigência</th>
                  <th className="px-4 py-2 text-left">Origem</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">{s.organization_name}</td>
                    <td className="px-4 py-2">{s.plan_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={s.status} kind="subscription" />
                      {s.cancel_at_period_end && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          cancela no fim do ciclo
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {BILLING_INTERVAL_LABELS[(s.billing_interval as BillingInterval) ?? "month"]}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={s.amount_cents} currency={s.currency} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={s.mrr_cents} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {dateBR(s.current_period_start)} → {dateBR(s.current_period_end)}
                    </td>
                    <td className="px-4 py-2">
                      <ProviderBadge provider={s.provider} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link to="/plataforma/clientes/$id" params={{ id: s.organization_id }}>
                        <Button variant="ghost" size="sm">
                          Abrir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && (data ?? []).length === 0 && (
                  <EmptyRow colSpan={9}>Nenhuma assinatura encontrada.</EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
