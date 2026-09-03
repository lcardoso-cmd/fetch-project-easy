import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, Loader2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getCases } from "@/lib/cases.functions";
import { draftLegalPiece } from "@/lib/generators.functions";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const PIECE_TYPES = [
  { value: "peticao-inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "replica", label: "Réplica" },
  { value: "recurso-apelacao", label: "Recurso de Apelação" },
  { value: "agravo-instrumento", label: "Agravo de Instrumento" },
  { value: "memoriais", label: "Memoriais" },
  { value: "parecer", label: "Parecer Jurídico" },
  { value: "notificacao-extrajudicial", label: "Notificação Extrajudicial" },
  { value: "manifestacao-laudo", label: "Manifestação sobre Laudo Pericial" },
  { value: "impugnacao-laudo", label: "Impugnação ao Laudo Pericial" },
  { value: "quesitos-suplementares", label: "Quesitos Suplementares" },
  { value: "pedido-esclarecimentos", label: "Pedido de Esclarecimentos ao Perito" },
] as const;

type PieceType = (typeof PIECE_TYPES)[number]["value"];

/**
 * Gerador de peças jurídicas. Quando `fixedCaseId` é informado (workspace do
 * caso), o usuário não precisa selecionar o caso novamente.
 */
export function PieceGenerator({
  fixedCaseId,
  fixedCaseTitle,
}: {
  fixedCaseId?: string;
  fixedCaseTitle?: string;
}) {
  const list = useServerFn(getCases);
  const draft = useServerFn(draftLegalPiece);
  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: () => list(),
    enabled: !fixedCaseId,
  });

  const [selectedCaseId, setSelectedCaseId] = useState("");
  const caseId = fixedCaseId ?? selectedCaseId;
  const [pieceType, setPieceType] = useState<PieceType>("peticao-inicial");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [caseTitle, setCaseTitle] = useState(fixedCaseTitle ?? "");

  const caseOptions = useMemo(() => cases ?? [], [cases]);

  const { dialog: unsavedDialog } = useUnsavedChangesGuard({
    when: !loading && (output.trim().length > 0 || instructions.trim().length > 0),
  });

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
    a.download = `${pieceType}-${(caseTitle || "documento").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Scale className="h-4 w-4" /> Configuração
          </CardTitle>
          <CardDescription className="text-sm">
            O documento é redigido com base nos arquivos indexados do caso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {!fixedCaseId && (
              <div className="space-y-1.5">
                <Label className="text-sm">Caso</Label>
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um caso" />
                  </SelectTrigger>
                  <SelectContent>
                    {caseOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de documento</Label>
              <Select value={pieceType} onValueChange={(v) => setPieceType(v as PieceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIECE_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Instruções específicas (opcional)</Label>
              <Textarea
                rows={5}
                className="text-sm"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex.: enfatizar a tese de prescrição; citar os contratos anexados..."
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar documento"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base">Documento gerado</CardTitle>
          {output && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(output);
                  toast.success("Copiado");
                }}
              >
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
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redigindo com base nos documentos do
              caso...
            </div>
          ) : output ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de documento e gere a minuta. Os arquivos já processados do caso são
              usados como contexto.
            </p>
          )}
        </CardContent>
      </Card>
      {unsavedDialog}
    </div>
  );
}
