import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getCommercialSettingsAdmin,
  saveCommercialSettingsAdmin,
  listBillingWebhookEvents,
  listBillingEmails,
} from "@/lib/platform-billing.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import { BackToPlatform, EmptyRow, dateBR } from "@/components/platform/billing-ui";
import { commercialSettingsSchema, type CommercialSettings } from "@/lib/billing-shared";

export const Route = createFileRoute("/_authenticated/plataforma/configuracoes/")({
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
      { title: "Configuração comercial — JurisMind" },
      {
        name: "description",
        content:
          "Regras de trial, tolerância de inadimplência, moeda e avisos automáticos do SaaS JurisMind.",
      },
      { property: "og:title", content: "Configuração comercial — JurisMind" },
      { property: "og:description", content: "Parâmetros de cobrança e comunicação comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommercialSettingsPage,
});

function CommercialSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCommercialSettingsAdmin);
  const saveFn = useServerFn(saveCommercialSettingsAdmin);
  const eventsFn = useServerFn(listBillingWebhookEvents);
  const emailsFn = useServerFn(listBillingEmails);

  const settingsQuery = useQuery({ queryKey: ["commercial-settings"], queryFn: () => getFn() });
  const eventsQuery = useQuery({
    queryKey: ["billing-webhook-events"],
    queryFn: () => eventsFn({ data: { limit: 25 } }),
  });
  const emailsQuery = useQuery({
    queryKey: ["billing-emails"],
    queryFn: () => emailsFn({ data: { limit: 25 } }),
  });

  const [form, setForm] = useState<CommercialSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data as CommercialSettings);
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: (values: CommercialSettings) => saveFn({ data: values }),
    onSuccess: () => {
      toast.success("Configuração comercial salva");
      qc.invalidateQueries({ queryKey: ["commercial-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!form) return;
    const parsed = commercialSettingsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Valores inválidos");
      return;
    }
    save.mutate(parsed.data);
  }

  return (
    <div className="space-y-6">
      <BackToPlatform />
      <PageHeader
        title="Configuração comercial"
        subtitle="Regras aplicadas a todos os clientes: trial, tolerância de inadimplência, moeda e avisos."
      />

      {settingsQuery.error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {(settingsQuery.error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de contrato</CardTitle>
          <CardDescription>
            Valores usados na criação de novas contas e no controle de inadimplência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!form ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="trial_days">Dias de trial</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    min={1}
                    max={365}
                    value={form.trial_days}
                    onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grace_days">Tolerância após vencimento (dias)</Label>
                  <Input
                    id="grace_days"
                    type="number"
                    min={0}
                    max={90}
                    value={form.grace_days}
                    onChange={(e) => setForm({ ...form, grace_days: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due_soon_days">Aviso de vencimento (dias antes)</Label>
                  <Input
                    id="due_soon_days"
                    type="number"
                    min={1}
                    max={60}
                    value={form.due_soon_days}
                    onChange={(e) => setForm({ ...form, due_soon_days: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Moeda</Label>
                  <select
                    id="currency"
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                    value={form.default_currency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        default_currency: e.target
                          .value as CommercialSettings["default_currency"],
                      })
                    }
                  >
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="support_identity">Identidade de suporte</Label>
                  <Input
                    id="support_identity"
                    value={form.support_identity}
                    onChange={(e) => setForm({ ...form, support_identity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notify">E-mails de aviso (separados por vírgula)</Label>
                  <Input
                    id="notify"
                    value={form.alert_recipients.join(", ")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        alert_recipients: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="trial_policy">Ao expirar o trial</Label>
                  <select
                    id="trial_policy"
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                    value={form.trial_expired_policy}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        trial_expired_policy: e.target
                          .value as CommercialSettings["trial_expired_policy"],
                      })
                    }
                  >
                    <option value="block">Bloquear o acesso</option>
                    <option value="read_only">Manter apenas leitura</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delinquency_policy">Em caso de inadimplência</Label>
                  <select
                    id="delinquency_policy"
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                    value={form.delinquency_policy}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        delinquency_policy: e.target
                          .value as CommercialSettings["delinquency_policy"],
                      })
                    }
                  >
                    <option value="keep_active">Manter ativo e cobrar</option>
                    <option value="suspend_after_grace">Suspender após a tolerância</option>
                  </select>
                </div>
              </div>


              <Button onClick={submit} disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar configuração"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Eventos de cobrança recebidos</CardTitle>
            <CardDescription>
              Notificações do provedor de pagamento processadas de forma idempotente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Evento</th>
                  <th className="px-4 py-2 text-left">Ambiente</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-left">Recebido</th>
                </tr>
              </thead>
              <tbody>
                {(eventsQuery.data ?? []).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2">{e.event_type}</td>
                    <td className="px-4 py-2">{e.environment}</td>
                    <td className="px-4 py-2">{e.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">{dateBR(e.received_at)}</td>
                  </tr>
                ))}
                {(eventsQuery.data ?? []).length === 0 && (
                  <EmptyRow colSpan={4}>Nenhum evento recebido ainda.</EmptyRow>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Avisos comerciais gerados</CardTitle>
            <CardDescription>
              Registro de mensagens de cobrança; a entrega depende do provedor de e-mail
              configurado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Destinatário</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {(emailsQuery.data ?? []).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2">{e.kind}</td>
                    <td className="px-4 py-2">{e.recipient}</td>
                    <td className="px-4 py-2">{e.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">{dateBR(e.created_at)}</td>
                  </tr>
                ))}
                {(emailsQuery.data ?? []).length === 0 && (
                  <EmptyRow colSpan={4}>Nenhum aviso gerado ainda.</EmptyRow>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
