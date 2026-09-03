import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ORG_PERMISSION_GROUPS,
  ORG_PERMISSION_LABELS,
  ORG_ROLE_DEFAULT_PERMISSIONS,
  ORG_ROLE_LABELS,
  ORG_ROLES,
  OWNER_ONLY_GRANTABLE,
} from "@/lib/org-permissions";
import { useAccess } from "@/hooks/use-access";
import {
  ArrowLeft,
  ShieldCheck,
  UserPlus,
  MessageSquare,
  Lock,
  CheckCircle2,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda/permissoes")({
  head: () => ({
    meta: [
      { title: "Como liberar permissões — JurisMind" },
      {
        name: "description",
        content:
          "Entenda os papéis do escritório e como pedir ou conceder permissões no JurisMind.",
      },
      { property: "og:title", content: "Como liberar permissões — JurisMind" },
      {
        property: "og:description",
        content: "Papéis, permissões e caminhos para liberar acesso no escritório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PermissionsHelpPage,
});

function PermissionsHelpPage() {
  const { permissions, role, roleLabel, hasOrgPermission } = useAccess();
  const mine = new Set(permissions);
  const canManagePermissions = hasOrgPermission("permissions.manage");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/painel">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Central de permissões
        </div>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">
          Como liberar permissões no JurisMind
        </h1>
        <p className="text-ui text-muted-foreground">
          O acesso vem do seu <strong>papel no escritório</strong>
          {roleLabel ? ` (hoje: ${roleLabel})` : ""}. Ajustes individuais existem como
          exceção e ficam registrados na auditoria da organização.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Sou usuário — quero acesso</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-ui text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Identifique a permissão que falta na lista abaixo (o nome aparece sempre
                que o sistema bloqueia uma tela).
              </li>
              <li>
                Fale com o <strong>titular ou administrador do escritório</strong>.
              </li>
              <li>
                Peça para abrir{" "}
                <Link to="/configuracoes/equipe" className="text-primary underline">
                  Configurações → Equipe e permissões
                </Link>{" "}
                e ajustar o seu papel ou a permissão específica.
              </li>
              <li>Recarregue a página para aplicar a mudança.</li>
            </ol>
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm">
                Dica: informe o nome exato da permissão (ex.: «Usar propostas
                comerciais»).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                Sou gestor — quero liberar para meu time
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-ui text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Abra{" "}
                <Link to="/configuracoes/equipe" className="text-primary underline">
                  Configurações → Equipe e permissões
                </Link>
                .
              </li>
              <li>Escolha o papel adequado — ele já traz o acesso padrão.</li>
              <li>
                Use «Ajustar permissões» apenas para exceções pontuais em cima do papel.
              </li>
              <li>
                Cobrança, assinatura e contratação só podem ser concedidas pelo{" "}
                <strong>titular</strong>. Administração B2B é exclusiva da equipe interna.
              </li>
            </ol>
            {canManagePermissions ? (
              <Button asChild size="sm" className="w-full">
                <Link to="/configuracoes/equipe">Gerenciar equipe agora</Link>
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm">
                  Seu papel não permite alterar permissões da equipe.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Papéis do escritório</CardTitle>
          <p className="text-ui text-muted-foreground">
            Cada papel concede um conjunto padrão de permissões.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {ORG_ROLES.map((r) => (
            <div key={r} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui font-medium">{ORG_ROLE_LABELS[r]}</span>
                {r === role && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Seu papel
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {ORG_ROLE_DEFAULT_PERMISSIONS[r]
                  .map((p) => ORG_PERMISSION_LABELS[p])
                  .join(" · ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões disponíveis</CardTitle>
          <p className="text-ui text-muted-foreground">
            O que cada permissão libera e quem pode concedê-la.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {ORG_PERMISSION_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <p className="text-ui font-semibold">{group.label}</p>
              <div className="space-y-2">
                {group.permissions.map((p) => {
                  const ownerOnly = OWNER_ONLY_GRANTABLE.includes(p);
                  return (
                    <div
                      key={p}
                      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui text-foreground">
                          {ORG_PERMISSION_LABELS[p]}
                        </span>
                        {mine.has(p) && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Você tem
                          </Badge>
                        )}
                        {ownerOnly && (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Só o titular
                          </Badge>
                        )}
                      </div>
                      <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
                        {ownerOnly
                          ? "Concedida pelo titular do escritório"
                          : "Concedida pelo titular ou administrador"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
