import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { listUsageByOrganization } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import { BackToPlatform, EmptyRow } from "@/components/platform/billing-ui";

export const Route = createFileRoute("/_authenticated/plataforma/consumo/")({
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
      { title: "Consumo de IA por cliente — JurisMind" },
      {
        name: "description",
        content: "Custo e volume de uso de inteligência artificial por cliente do SaaS JurisMind.",
      },
      { property: "og:title", content: "Consumo de IA por cliente — JurisMind" },
      { property: "og:description", content: "Custo de IA por tenant e margem do contrato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  const listFn = useServerFn(listUsageByOrganization);
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usage", days],
    queryFn: () => listFn({ data: { days } }),
  });

  const totalCost = (data ?? []).reduce((s, r) => s + r.costUsd, 0);

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Consumo de IA por cliente"
        subtitle="Custo real de inteligência artificial por organização, para acompanhar margem por contrato."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-base"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <div className="flex items-center rounded-md border px-3 text-sm sm:col-span-2">
          Custo total no período: <strong className="ml-2">US$ {totalCost.toFixed(2)}</strong>
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
            {isLoading ? "Carregando…" : `${data?.length ?? 0} clientes com uso`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-right">Chamadas</th>
                  <th className="px-4 py-2 text-right">Tokens</th>
                  <th className="px-4 py-2 text-right">Custo (USD)</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((r) => (
                  <tr key={r.organization_id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">
                      {r.organization_id === "sem-organizacao" ? (
                        r.organization_name
                      ) : (
                        <Link
                          to="/plataforma/clientes/$id"
                          params={{ id: r.organization_id }}
                          className="hover:underline"
                        >
                          {r.organization_name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.calls}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.tokens.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">${r.costUsd.toFixed(2)}</td>
                  </tr>
                ))}
                {!isLoading && (data ?? []).length === 0 && (
                  <EmptyRow colSpan={4}>Nenhum consumo de IA registrado no período.</EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
