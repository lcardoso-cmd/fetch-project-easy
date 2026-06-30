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
import { Megaphone, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { generateMarketing } from "@/lib/generators.functions";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
});

function MarketingPage() {
  const gen = useServerFn(generateMarketing);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [form, setForm] = useState({
    topic: "",
    format: "post-linkedin" as "post-linkedin" | "post-instagram" | "artigo-blog" | "newsletter",
    audience: "clientes empresariais",
    tone: "educativo" as "autoridade" | "educativo" | "provocativo" | "acolhedor",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic) {
      toast.error("Informe o tema");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Marketing Jurídico</h1>
        <p className="mt-1 text-muted-foreground">Gerador alinhado ao Provimento 205/2021 da OAB.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> Briefing
            </CardTitle>
            <CardDescription>Tema + formato + tom.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Tema</Label>
                <Textarea rows={3} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Ex: novidades da reforma tributária para PMEs" />
              </div>
              <div>
                <Label>Formato</Label>
                <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v as typeof form.format })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post-linkedin">Post LinkedIn</SelectItem>
                    <SelectItem value="post-instagram">Post Instagram</SelectItem>
                    <SelectItem value="artigo-blog">Artigo de blog</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Público</Label>
                <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
              </div>
              <div>
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as typeof form.tone })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autoridade">Autoridade</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="provocativo">Provocativo</SelectItem>
                    <SelectItem value="acolhedor">Acolhedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : "Gerar conteúdo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading">Resultado</CardTitle>
            {output && (
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(output); toast.success("Copiado"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">O conteúdo gerado aparecerá aqui.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
