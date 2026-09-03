import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { listOrganizations, listPlansAdmin } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  BackToPlatform,
  EmptyRow,
  Money,
  StatusPill,
  dateBR,
} from "@/components/platform/billing-ui";
import { ORG_STATUSES, ORG_STATUS_LABELS } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/clientes/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error("no");
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Clientes do SaaS — JurisMind" },
      {
        name: "description",
        content: "Escritórios assinantes da JurisMind, planos contratados e receita recorrente.",
      },
      { property: "og:title", content: "Clientes do SaaS — JurisMind" },
      { property: "og:description", content: "Gestão de contratos e clientes JurisMind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformCustomers,
});

const PAGE_SIZE = 50;

function PlatformCustomers() {
  const listFn = useServerFn(listOrganizations);
  const plansFn = useServerFn(listPlansAdmin);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [onlyDelinquent, setOnlyDelinquent] = useState(false);
  const [page, setPage] = useState(0);

  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-organizations", search, status, planCode, onlyDelinquent, page],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          status: (status || undefined) as never,
          plan_code: planCode || undefined,
          only_delinquent: onlyDelinquent || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Clientes do SaaS"
        subtitle="Cada organização é um cliente da JurisMind, com seus próprios usuários, dados e contrato."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por nome, razão social, CNPJ ou e-mail…"
            className="pl-8"
          />
        </div>
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-base"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todas as situações</option>
          {ORG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORG_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-base"
          value={planCode}
          onChange={(e) => {
            setPlanCode(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos os planos</option>
          {(plans ?? []).map((p) => (
            <option key={p.id} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <Label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyDelinquent}
          onChange={(e) => {
            setOnlyDelinquent(e.target.checked);
            setPage(0);
          }}
        />
        Mostrar apenas inadimplentes
      </Label>

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
            {isLoading ? "Carregando…" : `${data?.total ?? 0} clientes`}
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
                  <th className="px-4 py-2 text-left">Assinatura</th>
                  <th className="px-4 py-2 text-right">MRR</th>
                  <th className="px-4 py-2 text-right">Integrantes</th>
                  <th className="px-4 py-2 text-left">Desde</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.billing_email ?? r.legal_name ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2">{r.plan_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={r.status} kind="organization" />
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={r.subscription_status} kind="subscription" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money cents={r.mrr_cents} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.active_members}</td>
                    <td className="px-4 py-2 text-muted-foreground">{dateBR(r.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to="/plataforma/clientes/$id" params={{ id: r.id }}>
                        <Button variant="ghost" size="sm">
                          Abrir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && (data?.rows ?? []).length === 0 && (
                  <EmptyRow colSpan={8}>Nenhum cliente encontrado com os filtros atuais.</EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-muted-foreground">Página {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={(data?.rows.length ?? 0) < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
