import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, CreditCard, Activity, ArrowRight } from "lucide-react";
import { getPlatformKpis } from "@/lib/platform.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";

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
  component: PlatformOverview,
});

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlatformOverview() {
  const fn = useServerFn(getPlatformKpis);
  const { data, isLoading } = useQuery({ queryKey: ["platform-kpis"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plataforma JurisMind"
        subtitle="Visão B2B — clientes do SaaS, assinaturas e uso agregado."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Building2 className="h-4 w-4" />}
          label="Clientes SaaS"
          value={isLoading ? "…" : String(data?.customers ?? 0)}
          hint={data ? `+${data.newLast30} nos últimos 30 dias` : undefined}
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Usuários ativos (30d)"
          value={isLoading ? "…" : String(data?.activeUsersLast30 ?? 0)}
        />
        <Kpi
          icon={<CreditCard className="h-4 w-4" />}
          label="MRR"
          value={isLoading ? "…" : money(data?.mrrCents ?? 0)}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Contas ativas"
          value={isLoading ? "…" : String(data?.statuses?.active ?? 0)}
          hint={
            data
              ? `${data.statuses?.trial ?? 0} trial · ${data.statuses?.suspended ?? 0} suspensas`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por status</CardTitle>
            <CardDescription>Situação atual dos clientes do SaaS.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data
              ? Object.entries(data.statuses).map(([k, v]) => (
                  <Badge key={k} variant="secondary">
                    {k}: {v}
                  </Badge>
                ))
              : "…"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por plano</CardTitle>
            <CardDescription>Free, Pro, Enterprise.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data
              ? Object.entries(data.plans).map(([k, v]) => (
                  <Badge key={k} variant="outline">
                    {k}: {v}
                  </Badge>
                ))
              : "…"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acessos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <QuickLink to="/plataforma/clientes" label="Gerir clientes SaaS" />
          <QuickLink to="/plataforma/usuarios" label="Gerir usuários da plataforma" />
          <QuickLink to="/plataforma/credenciais" label="Credenciais OAuth do SaaS" />
          <QuickLink to="/plataforma/auditoria" label="Log de auditoria" />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
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
