import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { archivePlan, listPlansAdmin, savePlan } from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import { BackToPlatform, Money } from "@/components/platform/billing-ui";
import { ENTITLEMENT_KEYS, ENTITLEMENT_LABELS, type EntitlementKey } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/planos/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Planos e limites — JurisMind" },
      {
        name: "description",
        content: "Planos comerciais da JurisMind, preços mensais e anuais e limites de cada contrato.",
      },
      { property: "og:title", content: "Planos e limites — JurisMind" },
      { property: "og:description", content: "Catálogo comercial do SaaS jurídico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

const BOOLEAN_KEYS: EntitlementKey[] = [
  "ai_overage_allowed",
  "feature_rag",
  "feature_legal_drafting",
  "feature_proposals",
  "feature_monitoring",
  "feature_communication",
  "feature_crm",
  "feature_integrations",
  "feature_audit",
];

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  monthly: string;
  yearly: string;
  active: boolean;
  sort_order: number;
  provider_product_id: string;
  provider_monthly_price_id: string;
  provider_yearly_price_id: string;
  entitlements: Record<string, string | number | boolean>;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  description: "",
  monthly: "0",
  yearly: "",
  active: true,
  sort_order: 50,
  provider_product_id: "",
  provider_monthly_price_id: "",
  provider_yearly_price_id: "",
  entitlements: {},
};

function PlansPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlansAdmin);
  const saveFn = useServerFn(savePlan);
  const archiveFn = useServerFn(archivePlan);
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => listFn(),
  });

  const save = useMutation({
    mutationFn: (f: FormState) =>
      saveFn({
        data: {
          id: f.id,
          code: f.code,
          name: f.name,
          description: f.description || null,
          monthly_price_cents: Math.round(Number(f.monthly.replace(",", ".")) * 100) || 0,
          yearly_price_cents: f.yearly
            ? Math.round(Number(f.yearly.replace(",", ".")) * 100)
            : null,
          currency: "BRL",
          active: f.active,
          sort_order: Number(f.sort_order) || 50,
          provider_product_id: f.provider_product_id || null,
          provider_monthly_price_id: f.provider_monthly_price_id || null,
          provider_yearly_price_id: f.provider_yearly_price_id || null,
          entitlements: f.entitlements as never,
        },
      }),
    onSuccess: () => {
      toast.success("Plano salvo");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: (vars: { id: string; archived: boolean }) => archiveFn({ data: vars }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Plano atualizado");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Planos e limites"
          subtitle="Cada plano define preço, periodicidade e os limites técnicos aplicados ao cliente."
        />
        <Button onClick={() => setForm({ ...EMPTY })}>Novo plano</Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando planos…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((p) => (
          <Card key={p.id} className={p.archived_at ? "opacity-60" : undefined}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>{p.description ?? p.code}</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {p.archived_at ? (
                    <Badge variant="secondary">Arquivado</Badge>
                  ) : p.active ? (
                    <Badge variant="outline">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{p.code}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-4">
                <span>
                  Mensal: <Money cents={p.monthly_price_cents} />
                </span>
                <span>
                  Anual:{" "}
                  {p.yearly_price_cents ? <Money cents={p.yearly_price_cents} /> : "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <span>{p.customers} contratos vigentes</span>
                <span>
                  MRR <Money cents={p.mrr_cents} />
                </span>
              </div>
              <div className="grid gap-1">
                {Object.entries(p.entitlements).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {(ENTITLEMENT_LABELS as Record<string, string>)[k] ?? k}
                    </span>
                    <span className="font-medium">
                      {typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v)}
                    </span>
                  </div>
                ))}
                {Object.keys(p.entitlements).length === 0 && (
                  <span className="text-muted-foreground">Nenhum limite configurado.</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      code: p.code,
                      name: p.name,
                      description: p.description ?? "",
                      monthly: (p.monthly_price_cents / 100).toFixed(2),
                      yearly: p.yearly_price_cents ? (p.yearly_price_cents / 100).toFixed(2) : "",
                      active: p.active,
                      sort_order: p.sort_order,
                      provider_product_id: p.provider_product_id ?? "",
                      provider_monthly_price_id: p.provider_monthly_price_id ?? "",
                      provider_yearly_price_id: p.provider_yearly_price_id ?? "",
                      entitlements: { ...p.entitlements } as Record<string, string | number | boolean>,
                    })
                  }
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archive.mutate({ id: p.id, archived: !p.archived_at })}
                  disabled={archive.isPending}
                >
                  {p.archived_at ? "Restaurar" : "Arquivar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {form && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {form.id ? `Editar plano ${form.name}` : "Novo plano"}
            </CardTitle>
            <CardDescription>
              Os identificadores do provedor de pagamento ligam o plano ao preço online.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Text
                label="Código (interno)"
                value={form.code}
                onChange={(v) => setForm({ ...form, code: v })}
              />
              <Text
                label="Preço mensal (R$)"
                value={form.monthly}
                onChange={(v) => setForm({ ...form, monthly: v })}
              />
              <Text
                label="Preço anual (R$)"
                value={form.yearly}
                onChange={(v) => setForm({ ...form, yearly: v })}
              />
              <Text
                label="Produto no provedor"
                value={form.provider_product_id}
                onChange={(v) => setForm({ ...form, provider_product_id: v })}
              />
              <Text
                label="Ordem de exibição"
                value={String(form.sort_order)}
                onChange={(v) => setForm({ ...form, sort_order: Number(v) || 0 })}
              />
              <Text
                label="Preço mensal no provedor"
                value={form.provider_monthly_price_id}
                onChange={(v) => setForm({ ...form, provider_monthly_price_id: v })}
              />
              <Text
                label="Preço anual no provedor"
                value={form.provider_yearly_price_id}
                onChange={(v) => setForm({ ...form, provider_yearly_price_id: v })}
              />
            </div>
            <div>
              <Label className="text-sm">Descrição</Label>
              <Textarea
                className="mt-1"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Label className="flex w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Disponível para contratação
            </Label>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Limites do plano</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ENTITLEMENT_KEYS.map((key) => {
                  const isBool = BOOLEAN_KEYS.includes(key);
                  const value = form.entitlements[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{ENTITLEMENT_LABELS[key]}</span>
                      {isBool ? (
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              entitlements: { ...form.entitlements, [key]: e.target.checked },
                            })
                          }
                        />
                      ) : (
                        <Input
                          className="h-9 w-32"
                          value={value === undefined ? "" : String(value)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              entitlements: {
                                ...form.entitlements,
                                [key]:
                                  key === "support_level"
                                    ? e.target.value
                                    : Number(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.name || !form.code}
              >
                {save.isPending ? "Salvando…" : "Salvar plano"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
