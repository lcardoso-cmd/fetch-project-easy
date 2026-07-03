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

  useEffect(() => {
    if (data) {
      setLimit(String(data.limit_usd ?? 0));
      setWarn(String(data.warn_threshold_pct ?? 80));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAiBudget({
        data: {
          monthly_limit_usd: Number(limit) || 0,
          warn_threshold_pct: Math.min(100, Math.max(1, Number(warn) || 80)),
        },
      }),
    onSuccess: () => {
      toast.success("Orçamento atualizado.");
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

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="sm:w-auto"
              >
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
