import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLastAiInteraction } from "@/lib/ai-usage.functions";

/**
 * Auditoria da última chamada de IA do usuário: mostra os limites efetivamente
 * aplicados (max_tokens, truncamento de contexto e tentativas usadas) para
 * ajudar a explicar o gasto reportado no painel.
 */
export function LastInteractionCard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["ai-last-interaction"],
    queryFn: () => getLastAiInteraction(),
    refetchOnWindowFocus: false,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Última interação
            </CardTitle>
            <CardDescription>
              Limites efetivamente aplicados na chamada mais recente ao gateway de IA.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma chamada registrada ainda. Após a primeira interação com a IA os limites
            aplicados aparecem aqui.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Quando" value={fmtDate(data.created_at)} hint={data.feature} />
            <Field label="Modelo" value={data.model || "—"} hint={`US$ ${data.cost_usd.toFixed(6)}`} />
            <Field
              label="Máx. tokens aplicado"
              value={data.max_tokens_applied ? fmtInt(data.max_tokens_applied) : "Sem limite"}
              hint={`Resposta: ${fmtInt(data.completion_tokens)} tokens`}
            />
            <Field
              label="Contexto"
              value={
                data.context_chars_after !== null
                  ? `${fmtInt(data.context_chars_after)} car.`
                  : `${fmtInt(data.prompt_tokens)} tokens`
              }
              hint={
                data.messages_truncated && data.messages_truncated > 0
                  ? `Truncado: ${data.messages_truncated} msg (de ${fmtInt(
                      data.context_chars_before ?? 0,
                    )} car.)`
                  : "Nenhum truncamento"
              }
            />
            <Field
              label="Tentativas usadas"
              value={
                data.retries_used === null
                  ? "—"
                  : data.retries_used === 0
                    ? "1 (primeira)"
                    : `${data.retries_used + 1} (com fallback)`
              }
              hint="Retentativas por instabilidade / fallback de modelo"
            />
            <Field
              label="Prompt / Resposta"
              value={`${fmtInt(data.prompt_tokens)} / ${fmtInt(data.completion_tokens)}`}
              hint={`Total: ${fmtInt(data.total_tokens)} tokens`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
