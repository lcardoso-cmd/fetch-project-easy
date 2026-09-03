import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getMyBilling,
  startSubscriptionCheckout,
  openBillingPortal,
  setSubscriptionCancellation,
} from "@/lib/billing.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { EmptyRow, Money, StatusPill, dateBR } from "@/components/platform/billing-ui";
import {
  BILLING_INTERVAL_LABELS,
  OPERATIONAL_STATE_LABELS,
  formatMoneyCents,
  type BillingInterval,
  type OperationalState,
} from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/organizacao/cobranca")({
  head: () => ({
    meta: [
      { title: "Assinatura e cobrança — JurisMind" },
      {
        name: "description",
        content:
          "Plano contratado, faturas, pagamentos e gestão da assinatura do seu escritório no JurisMind.",
      },
      { property: "og:title", content: "Assinatura e cobrança — JurisMind" },
      { property: "og:description", content: "Gerencie o plano e o faturamento do escritório." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrgBillingPage,
});

function OrgBillingPage() {
  const qc = useQueryClient();
  const env = (() => {
    try {
      return getStripeEnvironment();
    } catch {
      return null;
    }
  })();

  const billingFn = useServerFn(getMyBilling);
  const checkoutFn = useServerFn(startSubscriptionCheckout);
  const portalFn = useServerFn(openBillingPortal);
  const cancelFn = useServerFn(setSubscriptionCancellation);

  const [interval, setInterval] = useState<BillingInterval>("month");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-billing", env],
    queryFn: () => billingFn({ data: { environment: env ?? "sandbox" } }),
  });

  const checkout = useMutation({
    mutationFn: async (planCode: string) => {
      const res = await checkoutFn({
        data: {
          plan_code: planCode,
          interval,
          returnUrl: `${window.location.origin}/organizacao/cobranca?checkout=ok`,
          environment: env ?? "sandbox",
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res.clientSecret;
    },
    onSuccess: (secret) => setClientSecret(secret),
    onError: (e: Error) => toast.error(e.message),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await portalFn({
        data: {
          returnUrl: `${window.location.origin}/organizacao/cobranca`,
          environment: env ?? "sandbox",
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res.url;
    },
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (shouldCancel: boolean) => {
      const res = await cancelFn({
        data: { cancel: shouldCancel, environment: env ?? "sandbox" },
      });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      qc.invalidateQueries({ queryKey: ["my-billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const snapshot = data?.snapshot;
  const sub = snapshot?.subscription ?? null;

  return (
    <div className="space-y-6">
      <PaymentTestModeBanner />
      <PageHeader
        title="Assinatura e cobrança"
        subtitle="Plano do escritório, faturas emitidas, pagamentos e gestão da assinatura."
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Situação atual</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando…" : snapshot?.organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Estado operacional</p>
            <Badge variant="outline" className="mt-1">
              {snapshot ? OPERATIONAL_STATE_LABELS[snapshot.operationalState as OperationalState] : "—"}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Plano</p>
            <p className="mt-1 font-medium">{sub?.plan_name ?? "Sem plano contratado"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Assinatura</p>
            <div className="mt-1">
              {sub ? <StatusPill status={sub.status} kind="subscription" /> : "—"}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Fim do trial</p>
            <p className="mt-1">{dateBR(snapshot?.trialEndsAt ?? null)}</p>
          </div>
          {sub && (
            <>
              <div>
                <p className="text-muted-foreground">Ciclo</p>
                <p className="mt-1">
                  {BILLING_INTERVAL_LABELS[(sub.billing_interval as BillingInterval) ?? "month"]}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Valor</p>
                <p className="mt-1">
                  <Money cents={sub.amount_cents} currency={sub.currency} />
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Vigência</p>
                <p className="mt-1">
                  {dateBR(sub.current_period_start)} → {dateBR(sub.current_period_end)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Renovação</p>
                <p className="mt-1">
                  {sub.cancel_at_period_end ? "Cancelamento agendado" : "Renovação automática"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Planos disponíveis</CardTitle>
            <CardDescription>Escolha a periodicidade e contrate com pagamento online.</CardDescription>
          </div>
          <div className="flex gap-1 rounded-md border p-1">
            {(["month", "year"] as BillingInterval[]).map((i) => (
              <Button
                key={i}
                size="sm"
                variant={interval === i ? "default" : "ghost"}
                onClick={() => setInterval(i)}
              >
                {BILLING_INTERVAL_LABELS[i]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {(data?.plans ?? [])
            .filter((p) => !p.is_trial_default)
            .map((p) => {
              const cents = interval === "year" ? p.yearly_price_cents : p.monthly_price_cents;
              const isCurrent = sub?.plan_name === p.name;
              return (
                <div key={p.id} className="rounded-lg border p-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {cents == null ? "—" : formatMoneyCents(cents, p.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    por {interval === "year" ? "ano" : "mês"}
                  </p>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    disabled={
                      !p.purchasable || cents == null || checkout.isPending || isCurrent || !env
                    }
                    onClick={() => checkout.mutate(p.code)}
                  >
                    {isCurrent
                      ? "Plano atual"
                      : !p.purchasable || cents == null
                        ? "Falar com o comercial"
                        : "Contratar"}
                  </Button>
                </div>
              );
            })}
          {(data?.plans ?? []).length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">Nenhum plano publicado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gestão da assinatura</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
            Abrir portal de cobrança
          </Button>
          {sub && !sub.cancel_at_period_end && (
            <Button
              variant="outline"
              onClick={() => cancel.mutate(true)}
              disabled={cancel.isPending}
            >
              Cancelar ao fim do ciclo
            </Button>
          )}
          {sub?.cancel_at_period_end && (
            <Button onClick={() => cancel.mutate(false)} disabled={cancel.isPending}>
              Retomar renovação
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Faturas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Número</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.invoices ?? []).map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-2">{i.number ?? i.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={i.status} kind="invoice" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={i.total_cents} currency={i.currency} />
                    </td>
                    <td className="px-4 py-2">{dateBR(i.due_date)}</td>
                    <td className="px-4 py-2 text-right">
                      {i.hosted_url && (
                        <a href={i.hosted_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            Ver
                          </Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {(data?.invoices ?? []).length === 0 && (
                  <EmptyRow colSpan={5}>Nenhuma fatura emitida.</EmptyRow>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-left">Meio</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{dateBR(p.paid_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={p.amount_cents} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={p.status} kind="payment" />
                    </td>
                    <td className="px-4 py-2">{p.method_summary ?? p.method ?? "—"}</td>
                  </tr>
                ))}
                {(data?.payments ?? []).length === 0 && (
                  <EmptyRow colSpan={4}>Nenhum pagamento registrado.</EmptyRow>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(clientSecret)} onOpenChange={(o) => !o && setClientSecret(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Concluir contratação</DialogTitle>
          </DialogHeader>
          {clientSecret && (
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{ fetchClientSecret: async () => clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
