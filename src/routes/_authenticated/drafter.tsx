import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, Loader2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getCases } from "@/lib/cases.functions";
import { draftLegalPiece } from "@/lib/generators.functions";

export const Route = createFileRoute("/_authenticated/drafter")({
  component: DrafterPage,
});

const PIECE_TYPES = [
  { value: "peticao-inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "replica", label: "Réplica" },
  { value: "recurso-apelacao", label: "Recurso de Apelação" },
  { value: "agravo-instrumento", label: "Agravo de Instrumento" },
  { value: "memoriais", label: "Memoriais" },
  { value: "parecer", label: "Parecer Jurídico" },
  { value: "notificacao-extrajudicial", label: "Notificação Extrajudicial" },
] as const;

type PieceType = (typeof PIECE_TYPES)[number]["value"];

function DrafterPage() {
  const list = useServerFn(getCases);
  const draft = useServerFn(draftLegalPiece);
  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: () => list() });

  const [caseId, setCaseId] = useState("");
  const [pieceType, setPieceType] = useState<PieceType>("peticao-inicial");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [caseTitle, setCaseTitle] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) {
      toast.error("Selecione um caso");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const r = await draft({
        data: { case_id: caseId, piece_type: pieceType, instructions },
      });
      setOutput(r.content);
      setCaseTitle(r.case_title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pieceType}-${caseTitle.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Peças Jurídicas</h1>
        <p className="mt-1 text-muted-foreground">
          Gere peças com RAG dos documentos do caso (Gemini 2.5 Pro).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Scale className="h-5 w-5" /> Configuração
            </CardTitle>
            <CardDescription>O caso fornece o contexto via RAG.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Caso</Label>
                <Select value={caseId} onValueChange={setCaseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um caso" /></SelectTrigger>
                  <SelectContent>
                    {(cases ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de peça</Label>
                <Select value={pieceType} onValueChange={(v) => setPieceType(v as PieceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIECE_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Instruções específicas (opcional)</Label>
                <Textarea
                  rows={5}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ex: pedido de tutela de urgência; enfatizar dano moral; valor da causa R$ 50.000..."
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando peça...</> : "Gerar peça"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading">Peça gerada</CardTitle>
            {output && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(output); toast.success("Copiado"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={download}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redigindo com base nos documentos...
              </div>
            ) : output ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um caso e gere uma peça. Documentos indexados serão usados como contexto.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
