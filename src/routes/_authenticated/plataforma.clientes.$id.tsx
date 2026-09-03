import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createManualInvoice,
  getOrganizationDetail,
  listPlansAdmin,
  recordManualPayment,
  reconcileOrganizationBilling,
  setManualSubscription,
  setOrganizationLifecycle,
  updateOrganizationCommercial,
} from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  BackToPlatform,
  EmptyRow,
  Money,
  ProviderBadge,
  StatusPill,
  dateBR,
} from "@/components/platform/billing-ui";
import {
  BILLING_INTERVAL_LABELS,
  ENTITLEMENT_LABELS,
  OPERATIONAL_STATE_LABELS,
  formatMoneyCents,
  type BillingInterval,
} from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/clientes/$id")({
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
      { title: "Cliente do SaaS — JurisMind" },
      {
        name: "description",
        content: "Contrato, assinatura, faturas, pagamentos e consumo de um cliente JurisMind.",
      },
      { property: "og:title", content: "Cliente do SaaS — JurisMind" },
      { property: "og:description", content: "Ficha comercial completa do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetail,
});

function todayPlus(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function CustomerDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getOrganizationDetail);
  const plansFn = useServerFn(listPlansAdmin);
  const updateFn = useServerFn(updateOrganizationCommercial);
  const lifecycleFn = useServerFn(setOrganizationLifecycle);
  const manualSubFn = useServerFn(setManualSubscription);
  const invoiceFn = useServerFn(createManualInvoice);
  const paymentFn = useServerFn(recordManualPayment);
  const reconcileFn = useServerFn(reconcileOrganizationBilling);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-organization", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });

  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    tax_id: "",
    billing_email: "",
    primary_contact_name: "",
    phone: "",
    address_line: "",
    address_city: "",
    address_state: "",
    address_postal_code: "",
  });

  useEffect(() => {
    const org = data?.snapshot.organization;
    if (!org) return;
    setForm({
      name: org.name ?? "",
      legal_name: org.legal_name ?? "",
      tax_id: org.tax_id ?? "",
      billing_email: org.billing_email ?? "",
      primary_contact_name: org.primary_contact_name ?? "",
      phone: org.phone ?? "",
      address_line: org.address_line ?? "",
      address_city: org.address_city ?? "",
      address_state: org.address_state ?? "",
      address_postal_code: org.address_postal_code ?? "",
    });
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-organization", id] });
    qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    qc.invalidateQueries({ queryKey: ["commercial-kpis"] });
  };

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          name: form.name,
          legal_name: form.legal_name || null,
          tax_id: form.tax_id || null,
          billing_email: form.billing_email || null,
          primary_contact_name: form.primary_contact_name || null,
          phone: form.phone || null,
          address_line: form.address_line || null,
          address_city: form.address_city || null,
          address_state: form.address_state || null,
          address_postal_code: form.address_postal_code || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados cadastrais atualizados");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lifecycle = useMutation({
    mutationFn: (vars: { action: "suspend" | "reactivate" | "cancel" | "extend_trial"; days?: number; reason?: string }) =>
      lifecycleFn({ data: { id, environment: "sandbox", ...vars } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Contrato atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reconcile = useMutation({
    mutationFn: () => reconcileFn({ data: { organization_id: id, environment: "sandbox" } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Conciliação concluída: ${res.subscriptions} assinaturas e ${res.invoices} faturas.`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [sub, setSub] = useState({
    plan_id: "",
    interval: "month" as BillingInterval,
    seats: 1,
    amount: "",
    start: new Date().toISOString().slice(0, 10),
    end: todayPlus(30),
    notes: "",
  });
  const manualSub = useMutation({
    mutationFn: () =>
      manualSubFn({
        data: {
          organization_id: id,
          plan_id: sub.plan_id,
          interval: sub.interval,
          seats: Number(sub.seats) || 1,
          amount_cents: Math.round(Number(sub.amount.replace(",", ".")) * 100) || 0,
          period_start: sub.start,
          period_end: sub.end,
          notes: sub.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Assinatura registrada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [inv, setInv] = useState({ description: "", amount: "", due: todayPlus(7), notes: "" });
  const createInvoice = useMutation({
    mutationFn: () =>
      invoiceFn({
        data: {
          organization_id: id,
          description: inv.description,
          amount_cents: Math.round(Number(inv.amount.replace(",", ".")) * 100) || 0,
          due_date: inv.due,
          notes: inv.notes || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Fatura ${res.number} emitida`);
      setInv({ description: "", amount: "", due: todayPlus(7), notes: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pay, setPay] = useState({
    invoice_id: "",
    amount: "",
    method: "pix" as "pix" | "transferencia" | "boleto" | "cartao_externo" | "outro",
    paid_at: new Date().toISOString().slice(0, 10),
    reference: "",
    justification: "",
  });
  const recordPayment = useMutation({
    mutationFn: () =>
      paymentFn({
        data: {
          organization_id: id,
          invoice_id: pay.invoice_id || undefined,
          amount_cents: Math.round(Number(pay.amount.replace(",", ".")) * 100) || 0,
          method: pay.method,
          paid_at: pay.paid_at,
          reference: pay.reference || undefined,
          justification: pay.justification,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setPay({ ...pay, amount: "", reference: "", justification: "", invoice_id: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? (
          <span className="text-destructive">{(error as Error).message}</span>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando cliente…
          </>
        )}
      </div>
    );
  }

  const snap = data.snapshot;
  const org = snap.organization;

  return (
    <div className="space-y-6">
      <BackToPlatform label="Clientes" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            {org.legal_name ?? "Sem razão social"} · {org.tax_id ?? "sem CNPJ"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusPill status={org.status} kind="organization" />
            <span className="text-muted-foreground">
              {(OPERATIONAL_STATE_LABELS as Record<string, string>)[snap.operationalState] ??
              snap.operationalState}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reconcile.mutate()}
          disabled={reconcile.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${reconcile.isPending ? "animate-spin" : ""}`} />
          Conciliar com provedor
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Plano atual"
          value={snap.subscription?.plan_name ?? "Sem plano"}
          hint={
            snap.subscription
              ? `${BILLING_INTERVAL_LABELS[(snap.subscription.billing_interval as BillingInterval) ?? "month"]} · ${formatMoneyCents(snap.subscription.amount_cents, snap.subscription.currency)}`
              : "Nenhuma assinatura vigente"
          }
        />
        <SummaryCard
          label="Avaliação até"
          value={dateBR(snap.trialEndsAt)}
          hint={org.trial_extension_days ? `+${org.trial_extension_days} dias concedidos` : undefined}
        />
        <SummaryCard
          label="Consumo de IA (mês)"
          value={`US$ ${data.usageMonth.costUsd.toFixed(2)}`}
          hint={`${data.usageMonth.calls} chamadas · ${data.usageMonth.tokens.toLocaleString("pt-BR")} tokens`}
        />
        <SummaryCard
          label="Integrantes ativos"
          value={String(data.members.filter((m) => m.status === "active").length)}
        />
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais e de cobrança</CardTitle>
              <CardDescription>Usados nas faturas e comunicações comerciais.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do cliente" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Razão social" value={form.legal_name} onChange={(v) => setForm({ ...form, legal_name: v })} />
              <Field label="CNPJ/CPF" value={form.tax_id} onChange={(v) => setForm({ ...form, tax_id: v })} />
              <Field
                label="E-mail de cobrança"
                value={form.billing_email}
                onChange={(v) => setForm({ ...form, billing_email: v })}
              />
              <Field
                label="Contato principal"
                value={form.primary_contact_name}
                onChange={(v) => setForm({ ...form, primary_contact_name: v })}
              />
              <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Endereço" value={form.address_line} onChange={(v) => setForm({ ...form, address_line: v })} />
              <Field label="Cidade" value={form.address_city} onChange={(v) => setForm({ ...form, address_city: v })} />
              <Field label="UF" value={form.address_state} onChange={(v) => setForm({ ...form, address_state: v })} />
              <Field label="CEP" value={form.address_postal_code} onChange={(v) => setForm({ ...form, address_postal_code: v })} />
              <div className="sm:col-span-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Salvando…" : "Salvar cadastro"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ciclo de vida do contrato</CardTitle>
              <CardDescription>
                Ações refletem imediatamente no acesso do cliente e ficam registradas na auditoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ action: "extend_trial", days: 15 })}
              >
                Estender avaliação em 15 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={lifecycle.isPending || org.status === "suspended"}
                onClick={() => lifecycle.mutate({ action: "suspend", reason: "Suspensão administrativa" })}
              >
                Suspender
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={lifecycle.isPending || org.status === "active"}
                onClick={() => lifecycle.mutate({ action: "reactivate" })}
              >
                Reativar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={lifecycle.isPending || org.status === "cancelled"}
                onClick={() => lifecycle.mutate({ action: "cancel", reason: "Cancelamento administrativo" })}
              >
                Cancelar contrato
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assinatura</CardTitle>
              <CardDescription>
                {snap.subscription
                  ? `Vigente até ${dateBR(snap.subscription.current_period_end)} · ${snap.subscription.provider === "manual" ? "contrato manual" : "cobrança online"}`
                  : "Nenhuma assinatura vigente. Registre um contrato manual ou aguarde o pagamento online."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Plano</Label>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                  value={sub.plan_id}
                  onChange={(e) => {
                    const plan = (plans ?? []).find((p) => p.id === e.target.value);
                    setSub({
                      ...sub,
                      plan_id: e.target.value,
                      amount: plan
                        ? String(
                            ((sub.interval === "year"
                              ? plan.yearly_price_cents ?? plan.monthly_price_cents * 12
                              : plan.monthly_price_cents) / 100
                            ).toFixed(2),
                          )
                        : sub.amount,
                    });
                  }}
                >
                  <option value="">Selecione…</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm">Periodicidade</Label>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                  value={sub.interval}
                  onChange={(e) => setSub({ ...sub, interval: e.target.value as BillingInterval })}
                >
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </select>
              </div>
              <Field label="Valor (R$)" value={sub.amount} onChange={(v) => setSub({ ...sub, amount: v })} />
              <Field
                label="Licenças"
                value={String(sub.seats)}
                type="number"
                onChange={(v) => setSub({ ...sub, seats: Number(v) || 1 })}
              />
              <Field label="Início do ciclo" type="date" value={sub.start} onChange={(v) => setSub({ ...sub, start: v })} />
              <Field label="Fim do ciclo" type="date" value={sub.end} onChange={(v) => setSub({ ...sub, end: v })} />
              <div className="sm:col-span-2">
                <Label className="text-sm">Observações</Label>
                <Textarea
                  className="mt-1"
                  value={sub.notes}
                  onChange={(e) => setSub({ ...sub, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => manualSub.mutate()}
                  disabled={manualSub.isPending || !sub.plan_id || !sub.amount}
                >
                  {manualSub.isPending ? "Registrando…" : "Registrar assinatura"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limites do plano</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {Object.entries(snap.entitlements).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum limite definido para o plano atual.
                </p>
              )}
              {Object.entries(snap.entitlements).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(ENTITLEMENT_LABELS as Record<string, string>)[key] ?? key}
                  </span>
                  <span className="font-medium">
                    {typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faturas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emitir fatura manual</CardTitle>
              <CardDescription>Para contratos fora da cobrança automática.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Descrição"
                value={inv.description}
                onChange={(v) => setInv({ ...inv, description: v })}
              />
              <Field label="Valor (R$)" value={inv.amount} onChange={(v) => setInv({ ...inv, amount: v })} />
              <Field label="Vencimento" type="date" value={inv.due} onChange={(v) => setInv({ ...inv, due: v })} />
              <Field label="Observações" value={inv.notes} onChange={(v) => setInv({ ...inv, notes: v })} />
              <div className="sm:col-span-2">
                <Button
                  onClick={() => createInvoice.mutate()}
                  disabled={createInvoice.isPending || !inv.description || !inv.amount}
                >
                  {createInvoice.isPending ? "Emitindo…" : "Emitir fatura"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Faturas ({data.invoices.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Número</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-left">Emissão</th>
                      <th className="px-4 py-2 text-left">Vencimento</th>
                      <th className="px-4 py-2 text-left">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="px-4 py-2">{i.number ?? i.id.slice(0, 8)}</td>
                        <td className="px-4 py-2">
                          <StatusPill status={i.status} kind="invoice" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Money cents={i.total_cents} currency={i.currency} />
                        </td>
                        <td className="px-4 py-2">{dateBR(i.issued_at)}</td>
                        <td className="px-4 py-2">{dateBR(i.due_date)}</td>
                        <td className="px-4 py-2">
                          <ProviderBadge provider={i.origin ?? i.provider} />
                        </td>
                      </tr>
                    ))}
                    {data.invoices.length === 0 && (
                      <EmptyRow colSpan={6}>Nenhuma fatura emitida para este cliente.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar pagamento recebido fora do sistema</CardTitle>
              <CardDescription>
                Exige justificativa, que fica registrada na auditoria com seu usuário.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Fatura (opcional)</Label>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                  value={pay.invoice_id}
                  onChange={(e) => setPay({ ...pay, invoice_id: e.target.value })}
                >
                  <option value="">Sem vínculo</option>
                  {data.invoices
                    .filter((i) => i.status !== "paid")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number ?? i.id.slice(0, 8)} — {formatMoneyCents(i.total_cents, i.currency)}
                      </option>
                    ))}
                </select>
              </div>
              <Field label="Valor (R$)" value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} />
              <div>
                <Label className="text-sm">Meio</Label>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                  value={pay.method}
                  onChange={(e) => setPay({ ...pay, method: e.target.value as typeof pay.method })}
                >
                  <option value="pix">Pix</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao_externo">Cartão externo</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <Field label="Data" type="date" value={pay.paid_at} onChange={(v) => setPay({ ...pay, paid_at: v })} />
              <Field label="Referência" value={pay.reference} onChange={(v) => setPay({ ...pay, reference: v })} />
              <Field
                label="Justificativa"
                value={pay.justification}
                onChange={(v) => setPay({ ...pay, justification: v })}
              />
              <div className="sm:col-span-2">
                <Button
                  onClick={() => recordPayment.mutate()}
                  disabled={
                    recordPayment.isPending || !pay.amount || pay.justification.trim().length < 3
                  }
                >
                  {recordPayment.isPending ? "Registrando…" : "Registrar pagamento"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pagamentos ({data.payments.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                      <th className="px-4 py-2 text-left">Meio</th>
                      <th className="px-4 py-2 text-left">Referência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-2">{dateBR(p.paid_at)}</td>
                        <td className="px-4 py-2 text-right">
                          <Money cents={p.amount_cents} />
                        </td>
                        <td className="px-4 py-2">
                          <StatusPill status={p.status} kind="payment" />
                        </td>
                        <td className="px-4 py-2">{p.method_summary ?? p.method ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {p.reference ?? p.failure_reason ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {data.payments.length === 0 && (
                      <EmptyRow colSpan={5}>Nenhum pagamento registrado.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Integrantes ({data.members.length})</CardTitle>
              <CardDescription>Vínculos ativos e revogados desta organização.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Pessoa</th>
                      <th className="px-4 py-2 text-left">Papel</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                      <th className="px-4 py-2 text-left">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.user_id} className="border-t">
                        <td className="px-4 py-2">{m.full_name ?? m.user_id.slice(0, 8)}</td>
                        <td className="px-4 py-2">{m.role}</td>
                        <td className="px-4 py-2">{m.status === "active" ? "Ativo" : "Revogado"}</td>
                        <td className="px-4 py-2">{dateBR(m.created_at)}</td>
                      </tr>
                    ))}
                    {data.members.length === 0 && (
                      <EmptyRow colSpan={4}>Nenhum integrante vinculado.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico do contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.events.map((e) => (
                <div key={e.id} className="border-b pb-2 text-sm last:border-0">
                  <div className="font-medium">{e.event}</div>
                  <div className="text-muted-foreground">
                    {dateBR(e.created_at)}
                    {e.from_status || e.to_status
                      ? ` · ${e.from_status ?? "—"} → ${e.to_status ?? "—"}`
                      : ""}
                  </div>
                  {e.reason && <div className="text-muted-foreground">{e.reason}</div>}
                </div>
              ))}
              {data.events.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditoria da organização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.audit.map((a) => (
                <div key={a.id} className="border-b pb-2 text-sm last:border-0">
                  <div className="font-medium">{a.action}</div>
                  <div className="text-muted-foreground">{dateBR(a.created_at)}</div>
                </div>
              ))}
              {data.audit.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem registros de auditoria.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold">{value}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Input className="mt-1" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
