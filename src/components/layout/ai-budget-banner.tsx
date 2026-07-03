import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Ban } from "lucide-react";
import { getAiBudgetStatus } from "@/lib/ai-usage.functions";

/**
 * Banner global de orçamento de IA.
 * - Mostra em amarelo quando o consumo passa do `warn_threshold_pct` (default 80%).
 * - Mostra em vermelho quando o consumo iguala ou supera o limite mensal
 *   (novas chamadas ao gateway serão bloqueadas server-side por `assertAiBudget`).
 * - Fica oculto quando `limit_usd = 0` (sem orçamento configurado).
 */
export function AiBudgetBanner() {
  const { data } = useQuery({
    queryKey: ["ai-budget-status"],
    queryFn: () => getAiBudgetStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!data || data.limit_usd <= 0) return null;
  if (!data.warn && !data.blocked) return null;

  const remaining = Math.max(0, data.limit_usd - data.spent_usd);
  const tone = data.blocked
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  const Icon = data.blocked ? Ban : AlertTriangle;

  return (
    <div className={`border-b px-4 py-2 text-sm ${tone}`} role="alert">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span>
            {data.blocked ? (
              <>
                Orçamento mensal de IA esgotado — novas chamadas estão bloqueadas
                (US$ {data.spent_usd.toFixed(4)} / US$ {data.limit_usd.toFixed(2)}).
              </>
            ) : (
              <>
                Você usou {data.pct.toFixed(1)}% do orçamento mensal de IA.
                Restam US$ {remaining.toFixed(4)} de US$ {data.limit_usd.toFixed(2)}.
              </>
            )}
          </span>
        </div>
        <Link
          to="/configuracoes/consumo"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          Ajustar limite
        </Link>
      </div>
    </div>
  );
}
