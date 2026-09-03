import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, ArrowLeft, MoreHorizontal, ShieldCheck, Loader2 } from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "Usuários da plataforma | JurisMind B2B" },
      {
        name: "description",
        content:
          "Gestão de usuários da plataforma JurisMind: escritórios, funções, status de acesso e permissões administrativas.",
      },
      { property: "og:title", content: "Usuários da plataforma | JurisMind B2B" },
      {
        property: "og:description",
        content: "Backoffice B2B para administrar usuários, funções e permissões do JurisMind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  component: PlatformUsers,
});

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  viewer: "Leitor",
};

type UserRow = {
  id: string;
  full_name: string | null;
  firm_name: string | null;
  practice_type: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  organization_name: string | null;
  organization_role: string | null;
  capabilities: Capability[];
  created_at: string;
};

function initials(name: string | null, email: string | null) {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatDateTime(value: string | null) {
  if (!value) return "Nunca acessou";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlatformUsers() {
  const listFn = useServerFn(listPlatformUsers);
  const grantFn = useServerFn(grantCapability);
  const revokeFn = useServerFn(revokeCapability);
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<{
    user: UserRow;
    capability: Capability;
  } | null>(null);

  const { data: myCaps } = useQuery({
    queryKey: ["my-caps-platform"],
    queryFn: () => getMyCapabilities(),
  });
  const isSuper = (myCaps ?? []).includes("super_admin");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform-users", search, capFilter, page],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          capability: (capFilter || undefined) as Capability | undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  const rows = (data?.rows ?? []) as UserRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const assignable = useMemo(
    () =>
      CAPABILITIES.filter((c) =>
        c === "super_admin" || c === "platform_admin" ? isSuper : true,
      ),
    [isSuper],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-users"] });
  };

  const grant = useMutation({
    mutationFn: (v: { user_id: string; capability: Capability }) => grantFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão concedida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível conceder a permissão"),
  });

  const revoke = useMutation({
    mutationFn: (v: { user_id: string; capability: Capability }) => revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover a permissão"),
  });

  const drawerRow = drawerUser
    ? (rows.find((r) => r.id === drawerUser.id) ?? drawerUser)
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          to="/plataforma"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Plataforma
        </Link>
        <div>
          <h1 className="text-page-title text-foreground">Usuários da plataforma</h1>
          <p className="mt-2 text-base prose-measure text-muted-foreground">
            Todos os usuários cadastrados no JurisMind. A equipe B2B concede ou revoga
            permissões de plataforma e de administração.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Label htmlFor="user-search" className="sr-only">
            Buscar usuário
          </Label>
          <Input
            id="user-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou escritório…"
            className="pl-9"
          />
        </div>
        <div>
          <Label htmlFor="cap-filter" className="sr-only">
            Filtrar por permissão
          </Label>
          <select
            id="cap-filter"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            value={capFilter}
            onChange={(e) => {
              setPage(0);
              setCapFilter(e.target.value);
            }}
          >
            <option value="">Todas as permissões</option>
            {CAPABILITIES.map((c) => (
              <option key={c} value={c}>
                {CAPABILITY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="h-11 md:w-auto">
          Buscar
        </Button>
      </form>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <CardTitle className="text-card-title">
            {isLoading ? "Carregando usuários…" : `${total} ${total === 1 ? "usuário" : "usuários"}`}
          </CardTitle>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="space-y-3 p-6">
              <p className="text-base text-destructive">
                Não foi possível carregar os usuários: {(error as any)?.message ?? "erro inesperado"}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 p-6 text-base text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-base text-muted-foreground">
              Nenhum usuário encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-ui">
                <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Usuário
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Escritório
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Função
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Permissões
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Último acesso
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const visible = u.capabilities.slice(0, 2);
                    const extra = u.capabilities.length - visible.length;
                    return (
                      <tr key={u.id} className="border-t border-border align-middle">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground"
                            >
                              {initials(u.full_name, u.email)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-foreground">
                                {u.full_name ?? "Sem nome cadastrado"}
                              </span>
                              <span className="block truncate text-sm text-muted-foreground">
                                {u.email ?? "E-mail não disponível"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="block text-foreground">
                            {u.organization_name ?? u.firm_name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {u.organization_role
                            ? (ROLE_LABELS[u.organization_role] ?? u.organization_role)
                            : "Sem organização ativa"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.capabilities.length === 0 && (
                              <span className="text-sm text-muted-foreground">Sem permissões</span>
                            )}
                            {visible.map((c) => (
                              <Badge key={c} variant="secondary">
                                {CAPABILITY_LABELS[c]}
                              </Badge>
                            ))}
                            {extra > 0 && <Badge variant="outline">+{extra}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {formatDateTime(u.last_sign_in_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={`Ações para ${u.full_name ?? u.email ?? "usuário"}`}
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setDrawerUser(u)}>
                                Gerenciar permissões
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Exibindo {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} de {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!drawerRow} onOpenChange={(open) => !open && setDrawerUser(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {drawerRow && (
            <>
              <SheetHeader>
                <SheetTitle className="text-section-title">
                  {drawerRow.full_name ?? drawerRow.email ?? "Usuário"}
                </SheetTitle>
                <SheetDescription className="text-base">
                  {drawerRow.email ?? "E-mail não disponível"} ·{" "}
                  {drawerRow.organization_name ?? drawerRow.firm_name ?? "Sem organização"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-3">
                <h2 className="text-card-title">Permissões da plataforma</h2>
                <p className="text-sm text-muted-foreground">
                  Alterações são aplicadas imediatamente e registradas na auditoria.
                </p>
                <ul className="space-y-2">
                  {assignable.map((c) => {
                    const owns = drawerRow.capabilities.includes(c);
                    const critical = c === "super_admin" || c === "platform_admin";
                    const busy = grant.isPending || revoke.isPending;
                    return (
                      <li
                        key={c}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-3"
                      >
                        <span className="flex items-center gap-2 text-ui">
                          {critical && (
                            <ShieldCheck
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                          {CAPABILITY_LABELS[c]}
                        </span>
                        <Button
                          size="sm"
                          variant={owns ? "outline" : "default"}
                          disabled={busy}
                          onClick={() => {
                            if (owns) {
                              setPendingRevoke({ user: drawerRow, capability: c });
                            } else {
                              grant.mutate({ user_id: drawerRow.id, capability: c });
                            }
                          }}
                        >
                          {owns ? "Remover" : "Conceder"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingRevoke} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover permissão?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {pendingRevoke &&
                `A permissão "${CAPABILITY_LABELS[pendingRevoke.capability]}" será removida de ${
                  pendingRevoke.user.full_name ?? pendingRevoke.user.email ?? "este usuário"
                }. O acesso é revogado imediatamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRevoke) {
                  revoke.mutate({
                    user_id: pendingRevoke.user.id,
                    capability: pendingRevoke.capability,
                  });
                }
                setPendingRevoke(null);
              }}
            >
              Remover permissão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
