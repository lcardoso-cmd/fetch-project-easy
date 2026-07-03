import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getAiBudgetStatus, updateAiBudget } from "@/lib/ai-usage.functions";
import {
  AI_BUDGET_LIMITS as LIMITS,
  tryDecodeValidationError,
} from "@/lib/ai-budget-schema";
import { toast } from "sonner";

const FormSchema = z.object({
  limit: z.number().min(LIMITS.limit.min).max(LIMITS.limit.max),
  warn: z.number().int().min(LIMITS.warn.min).max(LIMITS.warn.max),
  maxTokens: z.number().int().min(LIMITS.maxTokens.min).max(LIMITS.maxTokens.max),
  maxCtx: z.number().int().min(LIMITS.maxCtx.min).max(LIMITS.maxCtx.max),
  maxRetries: z.number().int().min(LIMITS.maxRetries.min).max(LIMITS.maxRetries.max),
});

type FieldKey = keyof typeof LIMITS;
type Errors = Partial<Record<FieldKey, string>>;

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function validate(values: Record<FieldKey, string>): { errors: Errors; parsed: z.infer<typeof FormSchema> | null } {
  const errors: Errors = {};
  const nums: Partial<Record<FieldKey, number>> = {};
  (Object.keys(LIMITS) as FieldKey[]).forEach((k) => {
    const n = parseNumber(values[k]);
    const { min, max, label } = LIMITS[k];
    if (n === null) {
      errors[k] = `${label} é obrigatório.`;
      return;
    }
    if (k !== "limit" && !Number.isInteger(n)) {
      errors[k] = `${label} deve ser um inteiro.`;
      return;
    }
    if (n < min || n > max) {
      errors[k] = `Use um valor entre ${min} e ${max.toLocaleString("pt-BR")}.`;
      return;
    }
    nums[k] = n;
  });
  if (Object.keys(errors).length > 0) return { errors, parsed: null };
  const result = FormSchema.safeParse(nums);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as FieldKey;
      errors[key] = issue.message;
    }
    return { errors, parsed: null };
  }
  return { errors, parsed: result.data };
}

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
  const [forceFallback, setForceFallback] = useState<boolean>(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Errors>({});

  useEffect(() => {
    if (data) {
      setLimit(String(data.limit_usd ?? 0));
      setWarn(String(data.warn_threshold_pct ?? 80));
      setMaxTokens(String(data.max_tokens ?? 0));
      setMaxCtx(String(data.max_context_chars ?? 0));
      setMaxRetries(String(data.max_retries ?? 1));
      setForceFallback(Boolean(data.force_fallback_on_retry));
      setTouched({});
      setServerErrors({});
    }
  }, [data]);


  const { errors, parsed } = useMemo(
    () => validate({ limit, warn, maxTokens, maxCtx, maxRetries }),
    [limit, warn, maxTokens, maxCtx, maxRetries],
  );
  const isValid = parsed !== null;
  const markTouched = (k: FieldKey) => setTouched((t) => ({ ...t, [k]: true }));
  const errFor = (k: FieldKey) =>
    serverErrors[k] ?? (touched[k] ? errors[k] : undefined);

  const mutation = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error("Corrija os campos destacados antes de salvar.");
      return updateAiBudget({
        data: {
          monthly_limit_usd: parsed.limit,
          warn_threshold_pct: parsed.warn,
          max_tokens: parsed.maxTokens,
          max_context_chars: parsed.maxCtx,
          max_retries: parsed.maxRetries,
          force_fallback_on_retry: forceFallback,
        },
      });
    },

    onSuccess: () => {
      setServerErrors({});
      toast.success("Configurações de IA atualizadas.");
      qc.invalidateQueries({ queryKey: ["ai-budget-status"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha ao salvar.";
      const decoded = tryDecodeValidationError(msg);
      if (decoded) {
        setServerErrors(decoded.fieldErrors as Errors);
        setTouched({ limit: true, warn: true, maxTokens: true, maxCtx: true, maxRetries: true });
        toast.error(decoded.message);
      } else {
        toast.error(msg);
      }
    },
  });

  const handleSave = () => {
    if (!isValid) {
      setTouched({ limit: true, warn: true, maxTokens: true, maxCtx: true, maxRetries: true });
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }
    mutation.mutate();
  };


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
                  inputMode="decimal"
                  min={LIMITS.limit.min}
                  max={LIMITS.limit.max}
                  step="0.5"
                  value={limit}
                  aria-invalid={!!errFor("limit")}
                  onChange={(e) => setLimit(e.target.value)}
                  onBlur={() => markTouched("limit")}
                  className={errFor("limit") ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errFor("limit") && <p className="text-xs text-destructive">{errFor("limit")}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-budget-warn" className="text-xs">
                  Avisar em (%)
                </Label>
                <Input
                  id="ai-budget-warn"
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.warn.min}
                  max={LIMITS.warn.max}
                  step="1"
                  value={warn}
                  aria-invalid={!!errFor("warn")}
                  onChange={(e) => setWarn(e.target.value)}
                  onBlur={() => markTouched("warn")}
                  className={errFor("warn") ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errFor("warn") && <p className="text-xs text-destructive">{errFor("warn")}</p>}
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
                    inputMode="numeric"
                    min={LIMITS.maxTokens.min}
                    max={LIMITS.maxTokens.max}
                    step="256"
                    value={maxTokens}
                    aria-invalid={!!errFor("maxTokens")}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    onBlur={() => markTouched("maxTokens")}
                    className={errFor("maxTokens") ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errFor("maxTokens") && <p className="text-xs text-destructive">{errFor("maxTokens")}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-max-ctx" className="text-xs">
                    Contexto máx. (caracteres) — 0 = sem limite
                  </Label>
                  <Input
                    id="ai-max-ctx"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.maxCtx.min}
                    max={LIMITS.maxCtx.max}
                    step="1000"
                    value={maxCtx}
                    aria-invalid={!!errFor("maxCtx")}
                    onChange={(e) => setMaxCtx(e.target.value)}
                    onBlur={() => markTouched("maxCtx")}
                    className={errFor("maxCtx") ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errFor("maxCtx") && <p className="text-xs text-destructive">{errFor("maxCtx")}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-max-retries" className="text-xs">
                    Tentativas por chamada (0–5)
                  </Label>
                  <Input
                    id="ai-max-retries"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.maxRetries.min}
                    max={LIMITS.maxRetries.max}
                    step="1"
                    value={maxRetries}
                    aria-invalid={!!errFor("maxRetries")}
                    onChange={(e) => setMaxRetries(e.target.value)}
                    onBlur={() => markTouched("maxRetries")}
                    className={errFor("maxRetries") ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errFor("maxRetries") && <p className="text-xs text-destructive">{errFor("maxRetries")}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao passar do contexto, mensagens antigas são resumidas em um marcador; ao passar
                do teto de tokens, a resposta é truncada pelo próprio modelo.
              </p>
              <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-force-fallback" className="text-sm">
                    Forçar fallback automático em erros retentáveis
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, qualquer erro (mesmo os que normalmente seriam apenas
                    re-tentados) muda imediatamente para o modelo mais barato — mantendo o
                    streaming quando o gateway permitir.
                  </p>
                </div>
                <Switch
                  id="ai-force-fallback"
                  checked={forceFallback}
                  onCheckedChange={setForceFallback}
                />
              </div>
            </div>


            <div className="flex items-center justify-end gap-3">
              {!isValid && (
                <span className="text-xs text-destructive">
                  Ajuste os campos destacados para habilitar o salvamento.
                </span>
              )}
              <Button onClick={handleSave} disabled={mutation.isPending || !isValid}>
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
