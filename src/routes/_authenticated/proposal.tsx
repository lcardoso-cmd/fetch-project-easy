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
import { Handshake, Loader2, Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateProposal } from "@/lib/generators.functions";
import { getCases } from "@/lib/cases.functions";
import { useProfile } from "@/hooks/use-profile";
import { RichTextEditor } from "@/components/chat/rich-text-editor";
import { z } from "zod";

const proposalSchema = z.object({
  client_name: z.string().trim().min(2, "Informe o nome do cliente").max(200),
  matter: z.string().trim().min(10, "Descreva a matéria/caso (mín. 10 caracteres)").max(2000),
  scope: z.string().trim().min(10, "Descreva o escopo (mín. 10 caracteres)").max(2000),
  fees: z.string().trim().min(1, "Informe os honorários").max(200),
  firm_name: z.string().trim().min(2, "Informe o nome do escritório").max(200),
  lawyer_name: z.string().trim().min(2, "Informe o advogado responsável").max(200),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof proposalSchema>, string>>;

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
  const [errors, setErrors] = useState<FieldErrors>({});

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

  const previewHtml = useMemo(() => buildPreviewHtml(form), [form]);



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

  const downloadPdf = async () => {
    try {
      const filenameBase = `proposta-${(form.client_name || "cliente").replace(/\s+/g, "-").toLowerCase()}`;
      const container = document.createElement("div");
      container.className = "proposal-preview";
      container.style.cssText =
        "padding:24mm 20mm;width:210mm;box-sizing:border-box;background:#fff;color:#0f172a;font-family:Inter,system-ui,sans-serif;font-size:11pt;line-height:1.55;";
      container.innerHTML = output;
      document.body.appendChild(container);
      try {
        const html2pdf = (await import("html2pdf.js")).default;
        await html2pdf()
          .set({
            margin: 0,
            filename: `${filenameBase}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          } as never)
          .from(container)
          .save();
      } finally {
        container.remove();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PDF");
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
                <Button size="sm" variant="outline" onClick={downloadPdf}>
                  <FileText className="h-4 w-4 mr-1" /> Baixar PDF
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
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Prévia em tempo real dos campos preenchidos. Clique em <strong>Gerar proposta</strong> para produzir a versão final com JurisMind.
                </p>
                <div
                  className="proposal-preview rounded-md border bg-background p-6 text-sm leading-relaxed max-h-[560px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPreviewHtml(f: FormState): string {
  const p = (label: string, value: string) =>
    value ? `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>` : "";
  const section = (title: string, inner: string) =>
    inner.trim() ? `<h2>${esc(title)}</h2>${inner}` : "";

  const cliente = [
    f.client_name ? `<p><strong>${esc(f.client_name)}</strong></p>` : "",
    p("CPF/CNPJ", f.client_document),
    p("Endereço", f.client_address),
    p("Cidade/Estado", f.client_city_state),
  ].join("");

  const contraparte = [
    f.counterparty_name ? `<p><strong>${esc(f.counterparty_name)}</strong></p>` : "",
    p("CPF/CNPJ", f.counterparty_document),
    p("Endereço", f.counterparty_address),
    p("Cidade/Estado", f.counterparty_city_state),
    p("Advogado", f.counterparty_lawyer),
  ].join("");

  const objeto = [
    f.matter ? `<p>${esc(f.matter)}</p>` : "",
    f.scope ? `<h3>Escopo</h3><p>${esc(f.scope)}</p>` : "",
  ].join("");

  const honorarios = [
    p("Honorários", f.fees),
    p("Honorários de êxito", f.success_fee),
    p("Prazo estimado", f.deadline),
  ].join("");

  const escritorio = [
    f.firm_name ? `<p><strong>${esc(f.firm_name)}</strong></p>` : "",
    p("Áreas de atuação", f.firm_practice_areas),
    p("Endereço", f.firm_address),
    p("Telefone", f.firm_phone),
    p("E-mail", f.firm_email),
    f.lawyer_name ? `<p>${esc(f.lawyer_name)}${f.lawyer_title ? " — " + esc(f.lawyer_title) : ""}</p>` : "",
  ].join("");

  const body =
    section("Contratante", cliente) +
    section("Contraparte", contraparte) +
    section("Objeto", objeto) +
    section("Honorários e prazo", honorarios) +
    section("Escritório / Advogado responsável", escritorio);

  const empty = !body.trim();
  return `
    <h1 style="text-align:center">PROPOSTA DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS</h1>
    ${empty ? '<p style="color:var(--muted-foreground);text-align:center"><em>Preencha os campos ao lado para ver a prévia.</em></p>' : body}
  `;
}

