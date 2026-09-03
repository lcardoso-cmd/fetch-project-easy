import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  UserCog,
  Users,
  KeyRound,
  ChevronRight,
  Building2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { updateMyProfile } from "@/lib/profile.functions";
import { useProfile } from "@/hooks/use-profile";
import { isCurrentUserAdmin } from "@/lib/oauth-settings.functions";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — JurisMind" },
      {
        name: "description",
        content:
          "Perfil profissional, equipe, identidade do escritório, credenciais e consumo de IA.",
      },
      { property: "og:title", content: "Configurações — JurisMind" },
      {
        property: "og:description",
        content: "Central de configurações do escritório no JurisMind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const updateProfileFn = useServerFn(updateMyProfile);
  const isAdminFn = useServerFn(isCurrentUserAdmin);
  const { data: profile } = useProfile();
  const { hasOrgPermission, roleLabel } = useAccess();

  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => isAdminFn(),
  });
  const isAdmin = adminInfo?.isAdmin ?? false;

  const canViewTeam = hasOrgPermission("members.view");
  const canViewUsage =
    hasOrgPermission("usage.view_self") || hasOrgPermission("usage.view_organization");

  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setOabNumber(profile.oab_number ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const profileMut = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          full_name: fullName.trim() || null,
          oab_number: oabNumber.trim() || null,
          phone: phone.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar perfil"),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-xl font-medium tracking-tight">Configurações</h1>
        <p className="mt-1 text-ui text-muted-foreground">
          Perfil profissional e administração do escritório
          {roleLabel ? ` · seu papel: ${roleLabel}` : ""}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5" /> Perfil profissional
          </CardTitle>
          <CardDescription>
            Seus dados profissionais de advogado(a), usados nos documentos gerados.
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
              <Label htmlFor="p-oab">OAB</Label>
              <Input
                id="p-oab"
                value={oabNumber}
                onChange={(e) => setOabNumber(e.target.value)}
                maxLength={40}
                placeholder="Ex.: OAB/SP 123.456"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-phone">Telefone</Label>
              <Input
                id="p-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
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

      {canViewTeam && (
        <SettingsLinkCard
          icon={<Users className="h-5 w-5" />}
          title="Equipe e permissões"
          description="Convide integrantes, defina papéis do escritório e ajuste permissões individuais."
          to="/configuracoes/equipe"
          label="Abrir equipe e permissões"
        />
      )}

      <SettingsLinkCard
        icon={<Building2 className="h-5 w-5" />}
        title="Identidade do escritório"
        description="Logo, razão social, CNPJ/CPF e endereço usados no cabeçalho dos documentos exportados."
        to="/configuracoes/escritorio"
        label="Abrir identidade do escritório"
      />

      {isAdmin && (
        <SettingsLinkCard
          icon={<KeyRound className="h-5 w-5" />}
          title="Credenciais OAuth"
          description="Client ID e Client Secret do Google e do Microsoft/Outlook, criptografados no banco."
          to="/configuracoes/oauth"
          label="Abrir configurações OAuth"
        />
      )}

      {canViewUsage && (
        <SettingsLinkCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Consumo de IA"
          description="Tokens usados no mês por funcionalidade, modelo e usuário — com estimativa de custo."
          to="/configuracoes/consumo"
          label="Abrir painel de consumo"
        />
      )}
    </div>
  );
}

function SettingsLinkCard({
  icon,
  title,
  description,
  to,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  label: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          to={to}
          className="flex items-center justify-between rounded-lg border p-3 text-ui hover:bg-accent/50"
        >
          <span>{label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
