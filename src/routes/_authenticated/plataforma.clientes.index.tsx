import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowLeft } from "lucide-react";
import { listCustomerAccounts } from "@/lib/platform.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";

export const Route = createFileRoute("/_authenticated/plataforma/clientes/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) {
        throw new Error("no");
      }
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  component: PlatformCustomers,
});

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_COLOR: Record<string, string> = {
  trial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  suspended: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  canceled: "bg-muted text-muted-foreground",
};

function PlatformCustomers() {
  const listFn = useServerFn(listCustomerAccounts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [plan, setPlan] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-customers", search, status, plan],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          status: status || undefined,
          plan: plan || undefined,
          limit: 100,
          offset: 0,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1">
            <Link
              to="/plataforma"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Plataforma
            </Link>
          </div>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Clientes SaaS</h1>
          <p className="mt-1 text-muted-foreground">
            Escritórios e profissionais que assinaram a JurisMind. Cada conta é um
            tenant do sistema.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="pl-8"
            />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="trial">Trial</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="canceled">Cancelado</option>
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="">Todos os planos</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </CardContent>
      </Card>

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
                  <th className="px-4 py-2 text-left">E-mail cobrança</th>
                  <th className="px-4 py-2 text-left">Plano</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">MRR</th>
                  <th className="px-4 py-2 text-left">Desde</th>
                  <th className="px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {r.name || r.owner_firm_name || r.owner_full_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.owner_full_name ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.billing_email ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{r.plan}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[r.status] ?? ""}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {money(r.mrr_cents ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
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
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum cliente encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
