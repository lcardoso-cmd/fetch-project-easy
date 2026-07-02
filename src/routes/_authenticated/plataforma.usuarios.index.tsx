import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  listPlatformUsers,
  grantCapability,
  revokeCapability,
} from "@/lib/platform.functions";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  getMyCapabilities,
  type Capability,
} from "@/lib/capabilities.functions";

export const Route = createFileRoute("/_authenticated/plataforma/usuarios/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PlatformUsers,
});

function PlatformUsers() {
  const listFn = useServerFn(listPlatformUsers);
  const grantFn = useServerFn(grantCapability);
  const revokeFn = useServerFn(revokeCapability);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState<string>("");
  const [myCaps, setMyCaps] = useState<Capability[]>([]);

  useQuery({
    queryKey: ["my-caps-platform"],
    queryFn: async () => {
      const c = await getMyCapabilities();
      setMyCaps(c);
      return c;
    },
  });
  const isSuper = myCaps.includes("super_admin");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users", search, capFilter],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          capability: (capFilter || undefined) as Capability | undefined,
          limit: 100,
          offset: 0,
        },
      }),
  });

  const grant = useMutation({
    mutationFn: (v: { user_id: string; capability: Capability }) => grantFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão concedida");
      qc.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  const revoke = useMutation({
    mutationFn: (v: { user_id: string; capability: Capability }) => revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão removida");
      qc.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/platform"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Plataforma
        </Link>
        <h1 className="mt-1 text-3xl font-bold font-heading tracking-tight">
          Usuários da plataforma
        </h1>
        <p className="mt-1 text-muted-foreground">
          Todos os usuários cadastrados no sistema. Aqui a B2B concede/revoga permissões
          de plataforma e administrador.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou escritório…"
              className="pl-8"
            />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={capFilter}
            onChange={(e) => setCapFilter(e.target.value)}
          >
            <option value="">Todas as permissões</option>
            {CAPABILITIES.map((c) => (
              <option key={c} value={c}>
                {CAPABILITY_LABELS[c]}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Carregando…" : `${data?.total ?? 0} usuários`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Usuário</th>
                  <th className="px-4 py-2 text-left">Escritório</th>
                  <th className="px-4 py-2 text-left">Permissões</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((u: any) => (
                  <tr key={u.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.practice_type ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{u.firm_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.capabilities.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem permissões</span>
                        )}
                        {u.capabilities.map((c: Capability) => (
                          <Badge key={c} variant="secondary" className="text-[10px]">
                            {CAPABILITY_LABELS[c]}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {CAPABILITIES.map((c) => {
                          const restricted = c === "super_admin" || c === "platform_admin";
                          if (restricted && !isSuper) return null;
                          const owns = u.capabilities.includes(c);
                          return (
                            <Button
                              key={c}
                              size="sm"
                              variant={owns ? "secondary" : "outline"}
                              className="h-7 px-2 text-[11px]"
                              onClick={() =>
                                owns
                                  ? revoke.mutate({ user_id: u.id, capability: c })
                                  : grant.mutate({ user_id: u.id, capability: c })
                              }
                            >
                              {owns ? "− " : "+ "}
                              {CAPABILITY_LABELS[c]}
                            </Button>
                          );
                        })}
                      </div>
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
