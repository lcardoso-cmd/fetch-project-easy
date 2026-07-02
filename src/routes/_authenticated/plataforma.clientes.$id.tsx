import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCustomerAccount, updateCustomerAccount } from "@/lib/platform.functions";
import { getMyCapabilities } from "@/lib/capabilities.functions";

export const Route = createFileRoute("/_authenticated/plataforma/clientes/$id")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) throw new Error();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getCustomerAccount);
  const updateFn = useServerFn(updateCustomerAccount);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-customer", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [form, setForm] = useState({
    name: "",
    billing_email: "",
    status: "trial",
    plan: "free",
    mrr_cents: 0,
    notes: "",
  });
  useEffect(() => {
    if (!data) return;
    const a = data.account;
    setForm({
      name: a.name ?? "",
      billing_email: a.billing_email ?? "",
      status: a.status,
      plan: a.plan,
      mrr_cents: a.mrr_cents ?? 0,
      notes: a.notes ?? "",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          name: form.name || null,
          billing_email: form.billing_email || null,
          status: form.status as any,
          plan: form.plan as any,
          mrr_cents: Number(form.mrr_cents) || 0,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Cliente atualizado");
      qc.invalidateQueries({ queryKey: ["platform-customer", id] });
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      qc.invalidateQueries({ queryKey: ["platform-kpis"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const a = data.account;
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/platform/customers"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Todos os clientes
        </Link>
        <h1 className="mt-1 text-3xl font-bold font-heading tracking-tight">
          {a.name || data.profile?.firm_name || "Cliente"}
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Dono: {data.profile?.full_name ?? "—"}</span>
          <Badge variant="outline">{a.plan}</Badge>
          <Badge variant="secondary">{a.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome do cliente</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>E-mail de cobrança</Label>
              <Input
                value={form.billing_email}
                onChange={(e) => setForm((f) => ({ ...f, billing_email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="trial">Trial</option>
                  <option value="active">Ativo</option>
                  <option value="suspended">Suspenso</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>
              <div>
                <Label>Plano</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.plan}
                  onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div>
              <Label>MRR (centavos)</Label>
              <Input
                type="number"
                value={form.mrr_cents}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mrr_cents: Number(e.target.value) }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {(form.mrr_cents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate({ to: "/platform/customers" })}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipe do escritório</CardTitle>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                O dono ainda não convidou membros para o escritório.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {data.members.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{m.name || m.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.email} · {m.role ?? "—"}
                      </div>
                    </div>
                    <Badge variant="outline">{m.access_role ?? "member"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
