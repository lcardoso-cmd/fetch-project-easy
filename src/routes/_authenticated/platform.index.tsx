import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, CreditCard, Activity } from "lucide-react";

const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
      from: (t: string) => {
        select: (c: string, opts?: unknown) => Promise<{
          count: number | null;
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
    const isPlat = await admin.rpc("has_capability", {
      _user_id: context.userId,
      _capability: "platform_admin",
    });
    if (!isPlat.data) throw new Error("Sem permissão");

    const profiles = await admin.from("profiles").select("id", { count: "exact", head: true });
    return {
      customers: profiles.count ?? 0,
    };
  });

export const Route = createFileRoute("/_authenticated/platform/")({
  beforeLoad: async () => {
    // Guard via server call; if it throws, redirect to dashboard.
    try {
      const fn = getPlatformOverview;
      await fn();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PlatformOverview,
});

function PlatformOverview() {
  const fn = useServerFn(getPlatformOverview);
  const { data } = useQuery({ queryKey: ["platform-overview"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Plataforma JurisMind</h1>
        <p className="mt-1 text-muted-foreground">
          Visão B2B — clientes, assinaturas e uso agregado da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Escritórios/Profissionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data?.customers ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Usuários ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" /> MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" /> Uso último 30d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-muted-foreground">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximos módulos</CardTitle>
          <CardDescription>
            Área dedicada à operação B2B da JurisMind — separada da gestão de cada escritório.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Cadastro e busca de clientes (escritórios/profissionais)</p>
          <p>• Assinaturas, planos e faturamento consolidado</p>
          <p>• Métricas de engajamento e saúde da conta</p>
          <p>• Concessão manual de acessos e overrides de plano</p>
          <div className="pt-3">
            <Link to="/dashboard" className="text-primary underline">
              ← Voltar ao painel operacional
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
