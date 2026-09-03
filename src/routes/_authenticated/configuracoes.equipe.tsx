import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  listOrgTeam,
  inviteOrgMember,
  revokeOrgInvitation,
  updateOrgMemberRole,
  removeOrgMember,
  setOrgMemberPermission,
} from "@/lib/org-team.functions";
import {
  ORG_PERMISSION_GROUPS,
  ORG_PERMISSION_LABELS,
  ORG_ROLE_DEFAULT_PERMISSIONS,
  ORG_ROLE_LABELS,
  OWNER_ONLY_GRANTABLE,
  type OrgPermission,
  type OrgRole,
} from "@/lib/org-permissions";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/configuracoes/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe e permissões — JurisMind" },
      {
        name: "description",
        content:
          "Convide integrantes, defina papéis e ajuste permissões do escritório no JurisMind.",
      },
      { property: "og:title", content: "Equipe e permissões — JurisMind" },
      {
        property: "og:description",
        content: "Gestão de papéis, convites e permissões do escritório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { hasOrgPermission, isOwner } = useAccess();
  const listFn = useServerFn(listOrgTeam);
  const inviteFn = useServerFn(inviteOrgMember);
  const revokeInvFn = useServerFn(revokeOrgInvitation);
  const roleFn = useServerFn(updateOrgMemberRole);
  const removeFn = useServerFn(removeOrgMember);

  const { data, isLoading } = useQuery({
    queryKey: ["org-team"],
    queryFn: () => listFn(),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("lawyer");

  const assignable = data?.assignable_roles ?? [];
  const canInvite = hasOrgPermission("members.invite") && assignable.length > 0;
  const canManage = hasOrgPermission("members.manage");
  const canManagePermissions = hasOrgPermission("permissions.manage");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["org-team"] });
    qc.invalidateQueries({ queryKey: ["my-access"] });
    qc.invalidateQueries({ queryKey: ["org-members"] });
  };

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { email: email.trim().toLowerCase(), role } }),
    onSuccess: (res) => {
      const link = `${window.location.origin}/convite/${res.token}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      toast.success(
        res.reused
          ? "Convite atualizado — link copiado."
          : "Convite criado — link copiado para a área de transferência.",
      );
      setEmail("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao convidar"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeInvFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Convite revogado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao revogar"),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: OrgRole }) => roleFn({ data: v }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao alterar papel"),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => removeFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Acesso removido");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover acesso"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/configuracoes">
            <ArrowLeft className="h-4 w-4" />
            Configurações
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="font-heading text-xl font-medium tracking-tight">Equipe e permissões</h1>
        <p className="mt-1 text-ui text-muted-foreground">
          Papéis definem o acesso padrão. Ajustes individuais são exceções e ficam
          registrados na auditoria da organização.
        </p>
      </div>

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" /> Convidar integrante
            </CardTitle>
            <CardDescription>
              O convite vale por 14 dias e só pode ser aceito com o e-mail informado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="inv-email">E-mail</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pessoa@escritorio.com.br"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-role">Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                  <SelectTrigger id="inv-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ORG_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => inviteMut.mutate()}
                disabled={!email.trim() || inviteMut.isPending}
              >
                {inviteMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Convidar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Permissões padrão de «{ORG_ROLE_LABELS[role]}»:{" "}
              {ORG_ROLE_DEFAULT_PERMISSIONS[role]
                .map((p) => ORG_PERMISSION_LABELS[p])
                .join(", ")}
              .
            </p>
          </CardContent>
        </Card>
      )}

      {(data?.invitations.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {data!.invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-ui font-medium">{i.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {i.role_label} · expira em{" "}
                      {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          ?.writeText(`${window.location.origin}/convite/`)
                          .catch(() => {});
                        toast.info(
                          "Reenvie o convite para gerar novamente o link completo.",
                        );
                      }}
                    >
                      Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => revokeMut.mutate(i.id)}
                      disabled={revokeMut.isPending}
                    >
                      Revogar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Integrantes
          </CardTitle>
          <CardDescription>
            {data?.my_role
              ? `Você atua como ${ORG_ROLE_LABELS[data.my_role]}.`
              : "Somente integrantes ativos aparecem aqui."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-ui text-muted-foreground">Carregando equipe…</p>
          ) : (data?.members.length ?? 0) === 0 ? (
            <p className="text-ui text-muted-foreground">Nenhum integrante ativo.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data!.members.map((m) => {
                const editable =
                  canManage && !m.is_me && assignable.includes(m.role);
                return (
                  <li key={m.user_id} className="space-y-3 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-ui font-medium">
                          {m.name}
                          {m.is_me && (
                            <Badge variant="secondary" className="ml-2">
                              você
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {m.role_label}
                          {m.overrides.length > 0 &&
                            ` · ${m.overrides.length} ajuste(s) individual(is)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {editable ? (
                          <Select
                            value={m.role}
                            onValueChange={(v) =>
                              roleMut.mutate({ user_id: m.user_id, role: v as OrgRole })
                            }
                          >
                            <SelectTrigger className="h-9 w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assignable.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ORG_ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{m.role_label}</Badge>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remover acesso de ${m.name}`}
                            onClick={() => {
                              if (confirm(`Remover o acesso de ${m.name}?`)) {
                                removeMut.mutate(m.user_id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {canManagePermissions && !m.is_me && (
                      <MemberPermissions
                        userId={m.user_id}
                        role={m.role}
                        overrides={m.overrides}
                        isOwnerActor={isOwner}
                        onChanged={refresh}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberPermissions({
  userId,
  role,
  overrides,
  isOwnerActor,
  onChanged,
}: {
  userId: string;
  role: OrgRole;
  overrides: Array<{ permission: OrgPermission; granted: boolean }>;
  isOwnerActor: boolean;
  onChanged: () => void;
}) {
  const setFn = useServerFn(setOrgMemberPermission);
  const [open, setOpen] = useState(false);
  const overrideMap = new Map(overrides.map((o) => [o.permission, o.granted] as const));
  const defaults = new Set(ORG_ROLE_DEFAULT_PERMISSIONS[role]);

  const mut = useMutation({
    mutationFn: (v: { permission: OrgPermission; granted: boolean | null }) =>
      setFn({ data: { user_id: userId, ...v } }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar permissão"),
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="mr-1 h-4 w-4" />
          {open ? "Ocultar permissões" : "Ajustar permissões"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-md border bg-muted/30 p-3">
        {ORG_PERMISSION_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-sm font-semibold">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map((p) => {
                const override = overrideMap.get(p);
                const effective = override ?? defaults.has(p);
                const ownerOnly = OWNER_ONLY_GRANTABLE.includes(p);
                const disabled = mut.isPending || (ownerOnly && !isOwnerActor);
                return (
                  <label
                    key={p}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                    title={
                      ownerOnly && !isOwnerActor
                        ? "Somente o titular concede permissões de cobrança e contratação."
                        : undefined
                    }
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={effective}
                      disabled={disabled}
                      onCheckedChange={(v) => {
                        const next = Boolean(v);
                        mut.mutate({
                          permission: p,
                          granted: next === defaults.has(p) ? null : next,
                        });
                      }}
                    />
                    <span className="flex-1">
                      {ORG_PERMISSION_LABELS[p]}
                      {override !== undefined && (
                        <span className="ml-1 text-muted-foreground">
                          ({override ? "concedida" : "revogada"} manualmente)
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
