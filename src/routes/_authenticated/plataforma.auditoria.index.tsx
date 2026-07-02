import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { listPlatformAudit } from "@/lib/platform.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";

export const Route = createFileRoute("/_authenticated/plataforma/auditoria/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  component: PlatformAudit,
});

function PlatformAudit() {
  const fn = useServerFn(listPlatformAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-audit"],
    queryFn: () => fn({ data: { limit: 200 } }),
  });

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/plataforma"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Plataforma
        </Link>
        <h1 className="mt-1 text-3xl font-bold font-heading tracking-tight">
          Log de auditoria
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ações administrativas da B2B — concessão/revogação de permissões e alterações
          em contas de clientes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Carregando…" : `${(data ?? []).length} eventos`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Quando</th>
                  <th className="px-4 py-2 text-left">Ação</th>
                  <th className="px-4 py-2 text-left">Ator</th>
                  <th className="px-4 py-2 text-left">Alvo</th>
                  <th className="px-4 py-2 text-left">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.action}</code>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {String(r.actor_user_id).slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {r.target_user_id ? `user:${String(r.target_user_id).slice(0, 8)}…` : "—"}
                      {r.target_customer_id
                        ? ` acc:${String(r.target_customer_id).slice(0, 8)}…`
                        : ""}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-[11px] text-muted-foreground">
                        {JSON.stringify(r.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
