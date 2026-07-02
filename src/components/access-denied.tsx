import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAPABILITY_LABELS, type Capability } from "@/lib/capabilities.functions";
import { RequestAccessDialog } from "@/components/request-access-dialog";

type Props = {
  requires?: Capability | null;
  /** Rota que o usuário tentou acessar, se disponível. */
  attemptedPath?: string;
};

const RETURN_STORAGE_KEY = "jm.accessReturn";

/**
 * Tela padronizada de "Sem permissão".
 * Preserva a rota original em `sessionStorage` e no query `?next=` do painel,
 * para que o usuário possa voltar direto à página assim que o acesso for concedido.
 */
export function AccessDenied({ requires, attemptedPath }: Props) {
  const navigate = useNavigate();
  const isPlatformScope =
    requires === "platform_admin" || requires === "super_admin";
  const capLabel = requires ? CAPABILITY_LABELS[requires] : null;
  const [requestOpen, setRequestOpen] = useState(false);

  // Preserva a rota original para retorno posterior.
  useEffect(() => {
    if (!attemptedPath || attemptedPath === "/painel") return;
    try {
      sessionStorage.setItem(RETURN_STORAGE_KEY, attemptedPath);
    } catch {
      /* noop */
    }
  }, [attemptedPath]);

  const showRetry = !!attemptedPath && attemptedPath !== "/painel";
  const panelSearch = showRetry ? { next: attemptedPath } : undefined;

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-destructive/10 p-3 text-destructive">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Sem permissão para acessar esta área
            </h1>
            <p className="text-sm text-muted-foreground">
              Sua conta não tem a permissão necessária para abrir esta tela.
              {capLabel ? (
                <>
                  {" "}
                  É preciso a permissão{" "}
                  <span className="font-medium text-foreground">«{capLabel}»</span>.
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm">
          {isPlatformScope ? (
            <p>
              Esta é uma área restrita da equipe <strong>JurisMind (B2B)</strong>.
              Se você acredita que deveria ter acesso, fale com o suporte
              interno da plataforma.
            </p>
          ) : (
            <p>
              Peça ao <strong>administrador do seu escritório</strong> para
              liberar esta permissão em{" "}
              <em>Configurações → Equipe e permissões</em>. Assim que ela for
              concedida, clique em <strong>Tentar novamente</strong> para
              retornar à página.
            </p>
          )}
        </div>

        {attemptedPath ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Tentativa de acesso: <code className="rounded bg-muted px-1 py-0.5">{attemptedPath}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link to="/painel" search={panelSearch as never}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao painel
            </Link>
          </Button>
          {showRetry ? (
            <Button
              variant="secondary"
              onClick={() => navigate({ to: attemptedPath! })}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          ) : null}
          {!isPlatformScope ? (
            <Button variant="outline" onClick={() => setRequestOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Solicitar por e-mail
            </Button>
          ) : null}
        </div>
      </div>

      {!isPlatformScope ? (
        <RequestAccessDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          requires={requires}
          attemptedPath={attemptedPath}
        />
      ) : null}
    </div>
  );
}
