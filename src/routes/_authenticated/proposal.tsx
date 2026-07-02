import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake, Loader2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { generateProposal } from "@/lib/generators.functions";
import { getCases } from "@/lib/cases.functions";
import { useProfile } from "@/hooks/use-profile";
import { RichTextEditor } from "@/components/chat/rich-text-editor";

export const Route = createFileRoute("/_authenticated/proposal")({
  component: ProposalPage,
});

const NO_CASE = "__none__";

type FormState = {
  case_id: string;
  client_name: string;
  client_document: string;
  client_address: string;
  client_city_state: string;
  counterparty_name: string;
  counterparty_document: string;
  counterparty_address: string;
  counterparty_city_state: string;
  counterparty_lawyer: string;
  matter: string;
  scope: string;
  fees: string;
  success_fee: string;
  deadline: string;
  firm_name: string;
  firm_practice_areas: string;
  firm_address: string;
  firm_phone: string;
  firm_email: string;
  lawyer_name: string;
  lawyer_title: string;
  tone: "formal" | "consultivo" | "direto";
};

const EMPTY: FormState = {
  case_id: NO_CASE,
  client_name: "",
  client_document: "",
  client_address: "",
  client_city_state: "",
  counterparty_name: "",
  counterparty_document: "",
  counterparty_address: "",
  counterparty_city_state: "",
  counterparty_lawyer: "",
  matter: "",
  scope: "",
  fees: "",
  success_fee: "",
  deadline: "",
  firm_name: "",
  firm_practice_areas: "",
  firm_address: "",
  firm_phone: "",
  firm_email: "",
  lawyer_name: "",
  lawyer_title: "",
  tone: "formal",
};

function ProposalPage() {
  const gen = useServerFn(generateProposal);
  const getCasesFn = useServerFn(getCases);
  const { data: profile } = useProfile();
  const casesQ = useQuery({
    queryKey: ["cases", "list-for-proposal"],
    queryFn: () => getCasesFn(),
    staleTime: 30_000,
  });

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);

  // Autofill escritório/advogado a partir do profile — só quando ainda vazio.
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      lawyer_name: f.lawyer_name || profile.full_name || "",
      lawyer_title: f.lawyer_title || (profile.oab_number ? `OAB ${profile.oab_number}` : ""),
      firm_phone: f.firm_phone || profile.phone || "",
    }));
  }, [profile]);

  const cases = casesQ.data ?? [];

  const onSelectCase = (id: string) => {
    if (id === NO_CASE) {
      setForm((f) => ({ ...f, case_id: NO_CASE }));
      return;
    }
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      case_id: id,
      client_name: c.client_name ?? f.client_name,
      matter: f.matter || c.summary || c.description || c.title || "",
      client_city_state: f.client_city_state || c.jurisdiction || "",
    }));
  };

  const clientSummary = useMemo(() => {
    const parts = [form.client_name, form.client_document, form.client_city_state].filter(Boolean);
    return parts.join(" · ");
  }, [form.client_name, form.client_document, form.client_city_state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOutput("");
    try {
      const {
        case_id: _omit,
        ...payload
      } = form;
      const r = await gen({ data: payload });
      setOutput(r.content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blobHtml = new Blob([output], { type: "text/html" });
        const blobText = new Blob([output.replace(/<[^>]+>/g, "")], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }),
        ]);
      } else {
        await navigator.clipboard.writeText(output);
      }
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const download = async () => {
    try {
      const titulo = `Proposta - ${form.client_name || "Cliente"}`;
      const res = await fetch("/api/tools/petition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, html: output }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${(form.client_name || "cliente").replace(/\s+/g, "-").toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao baixar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Proposta Comercial</h1>
        <p className="mt-1 text-muted-foreground">
          Escolha um caso existente para preencher os dados do cliente automaticamente. Todos os campos são opcionais.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Handshake className="h-5 w-5" /> Dados da proposta
            </CardTitle>
            <CardDescription>Nenhum campo é obrigatório.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caso / Cliente</p>
                <div>
                  <Label>Caso vinculado</Label>
                  <Select value={form.case_id} onValueChange={onSelectCase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem caso vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CASE}>Sem caso vinculado</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                          {c.client_name ? ` — ${c.client_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clientSummary && (
                    <p className="mt-2 text-xs text-muted-foreground">Cliente: {clientSummary}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contraparte</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome / Razão social</Label>
                    <Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <Input value={form.counterparty_document} onChange={(e) => setForm({ ...form, counterparty_document: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={form.counterparty_address} onChange={(e) => setForm({ ...form, counterparty_address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade / Estado</Label>
                    <Input value={form.counterparty_city_state} onChange={(e) => setForm({ ...form, counterparty_city_state: e.target.value })} />
                  </div>
                  <div>
                    <Label>Advogado da contraparte</Label>
                    <Input placeholder="Nome + OAB" value={form.counterparty_lawyer} onChange={(e) => setForm({ ...form, counterparty_lawyer: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objeto</p>
                <div>
                  <Label>Matéria / Caso</Label>
                  <Textarea rows={3} value={form.matter} onChange={(e) => setForm({ ...form, matter: e.target.value })} />
                </div>
                <div>
                  <Label>Escopo</Label>
                  <Textarea rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Honorários e prazo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Honorários</Label>
                    <Input placeholder="Ex.: R$ 1.200/hora" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
                  </div>
                  <div>
                    <Label>Honorários de êxito</Label>
                    <Input placeholder="Ex.: 20%" value={form.success_fee} onChange={(e) => setForm({ ...form, success_fee: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Prazo estimado</Label>
                  <Input placeholder="Ex.: 600 dias" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escritório / Advogado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome do escritório</Label>
                    <Input value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Áreas de atuação</Label>
                    <Input placeholder="Ex.: Trabalhista, Cível" value={form.firm_practice_areas} onChange={(e) => setForm({ ...form, firm_practice_areas: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Endereço do escritório</Label>
                  <Input value={form.firm_address} onChange={(e) => setForm({ ...form, firm_address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.firm_phone} onChange={(e) => setForm({ ...form, firm_phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input value={form.firm_email} onChange={(e) => setForm({ ...form, firm_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Advogado responsável</Label>
                    <Input value={form.lawyer_name} onChange={(e) => setForm({ ...form, lawyer_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cargo / Título</Label>
                    <Input placeholder="Ex.: OAB/SP 000.000" value={form.lawyer_title} onChange={(e) => setForm({ ...form, lawyer_title: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as FormState["tone"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="consultivo">Consultivo</SelectItem>
                    <SelectItem value="direto">Direto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : "Gerar proposta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading">Resultado</CardTitle>
              <CardDescription>Edite livremente antes de baixar.</CardDescription>
            </div>
            {output && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <Button size="sm" onClick={download}>
                  <Download className="h-4 w-4 mr-1" /> Baixar .docx
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <RichTextEditor html={output} onChange={setOutput} minHeight={520} />
            ) : (
              <p className="text-sm text-muted-foreground">A proposta gerada aparecerá aqui, pronta para edição.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
