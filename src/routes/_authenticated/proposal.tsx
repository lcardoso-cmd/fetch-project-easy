import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake, Loader2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { generateProposal } from "@/lib/generators.functions";

export const Route = createFileRoute("/_authenticated/proposal")({
  component: ProposalPage,
});

function ProposalPage() {
  const gen = useServerFn(generateProposal);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [form, setForm] = useState({
    client_name: "",
    matter: "",
    scope: "",
    fees: "",
    deadline: "",
    tone: "formal" as "formal" | "consultivo" | "direto",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name || !form.matter) {
      toast.error("Preencha cliente e matéria");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const r = await gen({ data: form });
      setOutput(r.content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copiado");
  };
  const download = () => {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta-${form.client_name.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Proposta Comercial</h1>
        <p className="mt-1 text-muted-foreground">Gere propostas personalizadas com JurisMind.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Handshake className="h-5 w-5" /> Dados da proposta
            </CardTitle>
            <CardDescription>Preencha para gerar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label>Matéria / Caso</Label>
                <Textarea rows={3} value={form.matter} onChange={(e) => setForm({ ...form, matter: e.target.value })} />
              </div>
              <div>
                <Label>Escopo (opcional)</Label>
                <Textarea rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Honorários</Label>
                  <Input value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
                </div>
                <div>
                  <Label>Prazo</Label>
                  <Input value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as typeof form.tone })}>
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
            <CardTitle className="font-heading">Resultado</CardTitle>
            {output && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" /></Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">A proposta gerada aparecerá aqui.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
