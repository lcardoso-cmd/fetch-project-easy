import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Fallback amigável usado tanto pelo TanStack Router (defaultErrorComponent /
 * errorComponent) quanto pelo React Error Boundary global. Registra o erro em
 * telemetria (reportLovableError + console.error) e permite retry.
 */
export function ErrorFallback({
  error,
  reset,
  boundary = "route",
}: {
  error: Error;
  reset?: () => void;
  boundary?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log estruturado para observabilidade + Lovable telemetry.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${boundary}]`, error);
    reportLovableError(error, {
      boundary,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      message: error?.message,
    });
  }, [error, boundary]);

  const details = [
    `Rota: ${typeof window !== "undefined" ? window.location.pathname : "?"}`,
    `Boundary: ${boundary}`,
    `Erro: ${error?.name ?? "Error"}: ${error?.message ?? ""}`,
    error?.stack ? `\n${error.stack}` : "",
  ].join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado nesta tela
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Registramos os detalhes automaticamente. Você pode tentar de novo ou voltar ao início.
        </p>

        <details className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Detalhes técnicos
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
            {details}
          </pre>
        </details>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {copied ? "Copiado!" : "Copiar detalhes"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}
