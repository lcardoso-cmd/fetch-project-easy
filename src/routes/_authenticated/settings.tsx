import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Users, UserCog, KeyRound, ChevronRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  listTeamMembers,
  deleteTeamMember,
  inviteTeamMember,
  listInvitations,
  revokeInvitation,
} from "@/lib/team.functions";
import {
  updateMyProfile,
  PRACTICE_TYPES,
  type PracticeType,
} from "@/lib/profile.functions";
import {
  PRACTICE_TYPE_LABELS,
  SPECIALTY_SUGGESTIONS,
} from "@/lib/practice-labels";
import { useProfile } from "@/hooks/use-profile";
import { isCurrentUserAdmin } from "@/lib/oauth-settings.functions";
import {
  listMemberCapabilities,
  setMemberCapabilities,
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/capabilities.functions";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamMembers);
  const inviteFn = useServerFn(inviteTeamMember);
  const deleteFn = useServerFn(deleteTeamMember);
  const listInvFn = useServerFn(listInvitations);
  const revokeInvFn = useServerFn(revokeInvitation);
  const updateProfileFn = useServerFn(updateMyProfile);
  const isAdminFn = useServerFn(isCurrentUserAdmin);
  const { data: profile } = useProfile();
  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => isAdminFn(),
  });
  const isAdmin = adminInfo?.isAdmin ?? false;

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => listFn(),
  });
  const { data: invites = [] } = useQuery({
    queryKey: ["team-invitations"],
    queryFn: () => listInvFn(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [accessRole, setAccessRole] = useState<"viewer" | "editor" | "admin">("editor");

  // Perfil profissional
  const [practiceType, setPracticeType] = useState<PracticeType>("advogado");
  const [specialty, setSpecialty] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (profile) {
      setPracticeType((profile.practice_type as PracticeType) ?? "advogado");
      setSpecialty(profile.specialty ?? "");
      setFullName(profile.full_name ?? "");
    }
  }, [profile]);

  const inviteMut = useMutation({
    mutationFn: () =>
      inviteFn({
        data: {
          name: name.trim(),
          email: email.trim(),
          role: role.trim() || null,
          access_role: accessRole,
        },
      }),
    onSuccess: (res) => {
      const link = `${window.location.origin}/invite/${res.invitation.token}`;
      if (res.alreadyRegistered) {
        toast.success(`${name} já tem conta — acesso liberado imediatamente.`);
      } else {
        navigator.clipboard?.writeText(link).catch(() => {});
        toast.success("Convite criado — link copiado para a área de transferência.");
      }
      setName("");
      setEmail("");
      setRole("");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao convidar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeInvFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Convite revogado");
      qc.invalidateQueries({ queryKey: ["team-invitations"] });
    },
  });

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado"));
  }


  const profileMut = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          practice_type: practiceType,
          specialty: practiceType === "advogado" ? null : specialty.trim() || null,
          full_name: fullName.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar perfil"),
  });

  const needsSpecialty = practiceType !== "advogado";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seu perfil profissional, equipe e preferências.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="h-5 w-5" /> Perfil profissional
          </CardTitle>
          <CardDescription>
            Define o vocabulário do app e os modelos de documento sugeridos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="p-name">Nome</Label>
              <Input
                id="p-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-type">Atuação principal</Label>
              <Select value={practiceType} onValueChange={(v) => setPracticeType(v as PracticeType)}>
                <SelectTrigger id="p-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRACTICE_TYPE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {needsSpecialty && (
            <div className="space-y-1">
              <Label htmlFor="p-specialty">Especialidade</Label>
              <Input
                id="p-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Contábil, Engenharia civil, Médica..."
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SPECIALTY_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialty(s)}
                    className="text-xs rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-accent/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => profileMut.mutate()}
              disabled={profileMut.isPending}
            >
              {profileMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Salvar perfil
            </Button>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Equipe
          </CardTitle>
          <CardDescription>
            Convide membros por e-mail. Eles criam conta, fazem login e passam a ver os casos
            onde estão alocados — e podem conversar com você no chat interno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : team.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado ainda.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {team.map((m) => {
                const inv = invites.find(
                  (i) => i.team_member_id === m.id && i.status === "pending",
                );
                const linked = Boolean(m.member_user_id);
                return (
                  <li key={m.id} className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[m.role, m.email].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="text-xs">
                          {linked ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ✓ Conta vinculada · {m.access_role ?? "editor"}
                            </span>
                          ) : inv ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              ⏳ Convite pendente
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sem convite ativo</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => copyInviteLink(inv.token)}
                            >
                              Copiar link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive"
                              onClick={() => revokeMut.mutate(inv.id)}
                            >
                              Revogar
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover ${m.name}?`)) deleteMut.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {linked && m.member_user_id && (
                      <MemberCapabilities userId={m.member_user_id} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Convidar membro</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="m-name">Nome *</Label>
                <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-email">E-mail *</Label>
                <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-role">Cargo</Label>
                <Input id="m-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="Ex.: Sócio, Estagiário" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-access">Acesso</Label>
                <Select value={accessRole} onValueChange={(v) => setAccessRole(v as typeof accessRole)}>
                  <SelectTrigger id="m-access"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizar</SelectItem>
                    <SelectItem value="editor">Editar</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => inviteMut.mutate()}
              disabled={!name.trim() || !email.trim() || inviteMut.isPending}
            >
              {inviteMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Convidar e copiar link
            </Button>
            <p className="text-xs text-muted-foreground">
              Compartilhe o link com a pessoa. Ao acessá-lo logada com o e-mail informado, ela
              ganha acesso aos casos onde está alocada.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Identidade do escritório
          </CardTitle>
          <CardDescription>
            Logo, razão social, CNPJ/CPF e endereço usados no cabeçalho dos documentos exportados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/settings/firm"
            className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"
          >
            <span className="text-sm">Abrir identidade do escritório</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Credenciais OAuth
            </CardTitle>
            <CardDescription>
              Configure Client ID e Client Secret do Google e do Microsoft/Outlook.
              Valores criptografados no banco.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/settings/oauth"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"
            >
              <span className="text-sm">Abrir configurações OAuth</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
