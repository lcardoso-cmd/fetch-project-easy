import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { listPaymentsAdmin } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  BackToPlatform,
  EmptyRow,
  Money,
  ProviderBadge,
  StatusPill,
  dateBR,
} from "@/components/platform/billing-ui";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, formatMoneyCents } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/pagamentos/")({
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
      { title: "Pagamentos — JurisMind" },
      {
        name: "description",
        content: "Pagamentos recebidos, falhas de cobrança e conciliação dos clientes JurisMind.",
      },
      { property: "og:title", content: "Pagamentos — JurisMind" },
      { property: "og:description", content: "Conciliação financeira do SaaS jurídico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const listFn = useServerFn(listPaymentsAdmin);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payments", status],
    queryFn: () => listFn({ data: { status: (status || undefined) as never, limit: 200 } }),
  });

  const received = (data ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Pagamentos"
        subtitle="Recebimentos confirmados, tentativas falhas e registros manuais conciliados."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todas as situações</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex items-center rounded-md border px-3 text-sm sm:col-span-2">
          Confirmado no filtro: <strong className="ml-2">{formatMoneyCents(received)}</strong>
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
            {isLoading ? "Carregando…" : `${data?.length ?? 0} pagamentos`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-left">Meio</th>
                  <th className="px-4 py-2 text-left">Origem</th>
                  <th className="px-4 py-2 text-left">Referência</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2">{dateBR(p.paid_at)}</td>
                    <td className="px-4 py-2">
                      <Link
                        to="/plataforma/clientes/$id"
                        params={{ id: p.organization_id }}
                        className="font-medium hover:underline"
                      >
                        {p.organization_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={p.amount_cents} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={p.status} kind="payment" />
                    </td>
                    <td className="px-4 py-2">{p.method_summary ?? p.method ?? "—"}</td>
                    <td className="px-4 py-2">
                      <ProviderBadge provider={p.provider} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.reference ?? p.failure_reason ?? "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && (data ?? []).length === 0 && (
                  <EmptyRow colSpan={7}>Nenhum pagamento registrado.</EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
