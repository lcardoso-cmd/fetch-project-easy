import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getAiBudgetStatus, updateAiBudget } from "@/lib/ai-usage.functions";
import { toast } from "sonner";

/**
 * Card de orçamento mensal de IA (pessoal).
 * - Mostra saldo atual (gasto vs limite) e barra de progresso.
 * - Permite ajustar o limite (USD) e o percentual de aviso.
 * - Limite = 0 ⇒ sem bloqueio (ilimitado).
 */
export function BudgetCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-budget-status"],
    queryFn: () => getAiBudgetStatus(),
  });

  const [limit, setLimit] = useState<string>("");
  const [warn, setWarn] = useState<string>("80");
  const [maxTokens, setMaxTokens] = useState<string>("0");
  const [maxCtx, setMaxCtx] = useState<string>("0");
  const [maxRetries, setMaxRetries] = useState<string>("1");

  useEffect(() => {
    if (data) {
      setLimit(String(data.limit_usd ?? 0));
      setWarn(String(data.warn_threshold_pct ?? 80));
      setMaxTokens(String(data.max_tokens ?? 0));
      setMaxCtx(String(data.max_context_chars ?? 0));
      setMaxRetries(String(data.max_retries ?? 1));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAiBudget({
        data: {
          monthly_limit_usd: Number(limit) || 0,
          warn_threshold_pct: Math.min(100, Math.max(1, Number(warn) || 80)),
          max_tokens: Math.max(0, Math.min(200000, Math.floor(Number(maxTokens) || 0))),
          max_context_chars: Math.max(0, Math.min(2000000, Math.floor(Number(maxCtx) || 0))),
          max_retries: Math.max(0, Math.min(5, Math.floor(Number(maxRetries) || 0))),
        },
      }),
    onSuccess: () => {
      toast.success("Configurações de IA atualizadas.");
      qc.invalidateQueries({ queryKey: ["ai-budget-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const pct = data?.pct ?? 0;
  const remaining = Math.max(0, (data?.limit_usd ?? 0) - (data?.spent_usd ?? 0));

  const status = data?.blocked
    ? { Icon: Ban, tone: "text-destructive", label: "Bloqueado — limite atingido" }
    : data?.warn
      ? { Icon: AlertTriangle, tone: "text-amber-600", label: `Próximo do limite (${pct.toFixed(1)}%)` }
      : { Icon: CheckCircle2, tone: "text-emerald-600", label: "Dentro do orçamento" };
  const StatusIcon = status.Icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Orçamento mensal de IA
        </CardTitle>
        <CardDescription>
          Defina um teto de gasto mensal. Ao chegar no percentual de aviso você recebe um alerta;
          ao atingir o limite as chamadas ao gateway são bloqueadas com mensagem clara.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {data.limit_usd > 0 ? (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${status.tone}`}>
                  <StatusIcon className="h-4 w-4" /> {status.label}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${data.blocked ? "bg-destructive" : data.warn ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between text-xs text-muted-foreground">
                  <span>Gasto: US$ {data.spent_usd.toFixed(4)}</span>
                  <span>Restante: US$ {remaining.toFixed(4)}</span>
                  <span>Limite: US$ {data.limit_usd.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum limite configurado — as chamadas não são bloqueadas.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ai-budget-limit" className="text-xs">
                  Limite mensal (USD) — 0 = ilimitado
                </Label>
                <Input
                  id="ai-budget-limit"
                  type="number"
                  min="0"
                  step="0.5"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-budget-warn" className="text-xs">
                  Avisar em (%)
                </Label>
                <Input
                  id="ai-budget-warn"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={warn}
                  onChange={(e) => setWarn(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Limites por chamada
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="ai-max-tokens" className="text-xs">
                    Máx. tokens de resposta — 0 = sem limite
                  </Label>
                  <Input
                    id="ai-max-tokens"
                    type="number"
                    min="0"
                    max="200000"
                    step="256"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-max-ctx" className="text-xs">
                    Contexto máx. (caracteres) — 0 = sem limite
                  </Label>
                  <Input
                    id="ai-max-ctx"
                    type="number"
                    min="0"
                    max="2000000"
                    step="1000"
                    value={maxCtx}
                    onChange={(e) => setMaxCtx(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-max-retries" className="text-xs">
                    Tentativas por chamada (0–5)
                  </Label>
                  <Input
                    id="ai-max-retries"
                    type="number"
                    min="0"
                    max="5"
                    step="1"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao passar do contexto, mensagens antigas são resumidas em um marcador; ao passar
                do teto de tokens, a resposta é truncada pelo próprio modelo.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Salvar
              </Button>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
}
