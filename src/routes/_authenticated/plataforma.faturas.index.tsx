import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listInvoicesAdmin, updateInvoiceStatus } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  BackToPlatform,
  EmptyRow,
  Money,
  ProviderBadge,
  StatusPill,
  dateBR,
} from "@/components/platform/billing-ui";
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, formatMoneyCents } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/faturas/")({
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
      { title: "Faturas — JurisMind" },
      {
        name: "description",
        content: "Faturas emitidas aos clientes JurisMind, vencimentos e inadimplência.",
      },
      { property: "og:title", content: "Faturas — JurisMind" },
      { property: "og:description", content: "Controle de faturamento do SaaS jurídico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInvoicesAdmin);
  const updateFn = useServerFn(updateInvoiceStatus);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-invoices", status],
    queryFn: () => listFn({ data: { status: (status || undefined) as never, limit: 200 } }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: "open" | "paid" | "void" | "overdue" }) =>
      updateFn({ data: { ...vars, justification: "Alteração manual pelo backoffice" } }),
    onSuccess: () => {
      toast.success("Fatura atualizada");
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      qc.invalidateQueries({ queryKey: ["commercial-kpis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openTotal = (data ?? [])
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((s, i) => s + (i.total_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Faturas"
        subtitle="Documentos de cobrança emitidos automaticamente pela cobrança online ou manualmente."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-base"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todas as situações</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex items-center rounded-md border px-3 text-sm sm:col-span-2">
          Em aberto no filtro: <strong className="ml-2">{formatMoneyCents(openTotal)}</strong>
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
            {isLoading ? "Carregando…" : `${data?.length ?? 0} faturas`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Número</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Emissão</th>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Origem</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((i) => (
                  <tr key={i.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2">{i.number ?? i.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <Link
                        to="/plataforma/clientes/$id"
                        params={{ id: i.organization_id }}
                        className="font-medium hover:underline"
                      >
                        {i.organization_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={i.status} kind="invoice" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={i.total_cents} currency={i.currency} />
                    </td>
                    <td className="px-4 py-2">{dateBR(i.issued_at)}</td>
                    <td className="px-4 py-2">{dateBR(i.due_date)}</td>
                    <td className="px-4 py-2">
                      <ProviderBadge provider={i.origin} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {i.hosted_url && (
                          <a href={i.hosted_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              Ver
                            </Button>
                          </a>
                        )}
                        {i.status !== "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ id: i.id, status: "paid" })}
                          >
                            Marcar paga
                          </Button>
                        )}
                        {i.status !== "void" && i.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ id: i.id, status: "void" })}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && (data ?? []).length === 0 && (
                  <EmptyRow colSpan={8}>Nenhuma fatura encontrada.</EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
