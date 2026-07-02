import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  CAPABILITY_DESCRIPTIONS,
  type Capability,
} from "@/lib/capabilities.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
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
          "Entenda como solicitar acesso ao seu gestor ou conceder permissões ao seu time no JurisMind.",
      },
    ],
  }),
  component: PermissionsHelpPage,
});

const B2B_ONLY: Capability[] = ["platform_admin", "super_admin"];

function PermissionsHelpPage() {
  const { capabilities, isOfficeAdmin } = useCapabilities();
  const myCaps = new Set(capabilities);

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
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Central de permissões
        </div>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">
          Como liberar permissões no JurisMind
        </h1>
        <p className="text-muted-foreground">
          Cada área do sistema (Casos, Parecer técnico, Proposta comercial…) depende de
          uma <strong>permissão</strong>. Aqui você aprende como pedir acesso ao seu
          gestor ou como conceder acesso ao seu time.
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
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Identifique qual permissão você precisa na lista abaixo (o nome aparece
                sempre que o sistema bloqueia uma tela).
              </li>
              <li>
                Fale com o <strong>administrador do seu escritório</strong> — quem
                gerencia a equipe e as configurações no JurisMind.
              </li>
              <li>
                Peça para ele abrir{" "}
                <Link to="/configuracoes/escritorio" className="text-primary underline">
                  Configurações → Escritório
                </Link>{" "}
                e marcar a permissão para o seu usuário.
              </li>
              <li>Faça logout e login novamente para que a permissão seja aplicada.</li>
            </ol>
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs">
                Dica: envie ao gestor o nome exato da permissão (ex.: «Proposta
                comercial»). Isso evita confusão.
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
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Abra{" "}
                <Link
                  to="/configuracoes/escritorio"
                  className="text-primary underline"
                >
                  Configurações → Escritório
                </Link>
                .
              </li>
              <li>Selecione o membro na lista da equipe.</li>
              <li>
                Marque ou desmarque as permissões desejadas e salve. A liberação vale
                para o próximo login do usuário.
              </li>
              <li>
                Permissões de <strong>Administração B2B</strong> não são concedidas por
                gestores de escritório — só pela equipe interna da B2B.
              </li>
            </ol>
            {isOfficeAdmin ? (
              <Button asChild size="sm" className="w-full">
                <Link to="/configuracoes/escritorio">
                  Gerenciar equipe agora
                </Link>
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs">
                  Você não é administrador do escritório. Só gestores conseguem liberar
                  permissões da equipe.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões disponíveis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada linha mostra a permissão, para que serve e quem pode conceder.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {CAPABILITIES.map((cap) => {
            const has = myCaps.has(cap);
            const isB2B = B2B_ONLY.includes(cap);
            return (
              <div
                key={cap}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {CAPABILITY_LABELS[cap]}
                    </span>
                    {has && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Você tem
                      </Badge>
                    )}
                    {isB2B && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Só B2B
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CAPABILITY_DESCRIPTIONS[cap]}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  {isB2B
                    ? "Concedida pela equipe B2B"
                    : "Concedida pelo admin do escritório"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
