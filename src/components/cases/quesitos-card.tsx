import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, HelpCircle, Save } from "lucide-react";
import { toast } from "sonner";
import {
  listQuesitos,
  createQuesito,
  updateQuesito,
  deleteQuesito,
} from "@/lib/quesitos.functions";
import type { MatterKind } from "@/lib/practice-labels";

const SOURCE_LABELS: Record<string, string> = {
  juizo: "Juízo",
  autor: "Autor",
  reu: "Réu",
  assistido: "Parte assistida",
  outro: "Outro",
};

export function QuesitosCard({
  caseId,
  matterKind,
}: {
  caseId: string;
  matterKind: MatterKind;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listQuesitos);
  const createFn = useServerFn(createQuesito);
  const updateFn = useServerFn(updateQuesito);
  const deleteFn = useServerFn(deleteQuesito);

  const { data: quesitos = [], isLoading } = useQuery({
    queryKey: ["quesitos", caseId],
    queryFn: () => listFn({ data: { case_id: caseId } }),
  });

  const defaultSource =
    matterKind === "assistencia_tecnica" ? "assistido" : "juizo";
  const [newSource, setNewSource] = useState<string>(defaultSource);
  const [newNumber, setNewNumber] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

  const sources =
    matterKind === "assistencia_tecnica"
      ? ["assistido", "juizo", "autor", "reu", "outro"]
      : ["juizo", "autor", "reu", "outro"];

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          case_id: caseId,
          source: newSource as "juizo" | "autor" | "reu" | "assistido" | "outro",
          number: newNumber.trim() ? parseInt(newNumber, 10) : null,
          question: newQuestion.trim(),
        },
      }),
    onSuccess: () => {
      setNewQuestion("");
      setNewNumber("");
      qc.invalidateQueries({ queryKey: ["quesitos", caseId] });
      toast.success("Quesito adicionado");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao adicionar"),
  });

  const grouped = quesitos.reduce<Record<string, typeof quesitos>>((acc, q) => {
    (acc[q.source] ??= [] as never).push(q as never);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <HelpCircle className="h-5 w-5" /> Quesitos
        </CardTitle>
        <CardDescription>
          Perguntas formuladas pelo juízo e pelas partes. Usadas pelo JurisMind ao gerar laudos e pareceres.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* novo quesito */}
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 md:grid-cols-[160px_100px_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <Select value={newSource} onValueChange={setNewSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº</Label>
            <Input
              type="number"
              min={1}
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quesito</Label>
            <Textarea
              rows={2}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Digite a pergunta técnica..."
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!newQuestion.trim() || createMut.isPending}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : quesitos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum quesito ainda. Adicione acima — você pode responder cada um depois.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([src, list]) => (
              <div key={src} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{SOURCE_LABELS[src] ?? src}</Badge>
                  <span className="text-xs text-muted-foreground">{list.length} quesito(s)</span>
                </div>
                <ul className="space-y-2">
                  {list.map((q) => (
                    <QuesitoItem
                      key={q.id}
                      quesito={q}
                      onSave={(patch) =>
                        updateFn({ data: { id: q.id, ...patch } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["quesitos", caseId] }),
                        )
                      }
                      onDelete={() =>
                        deleteFn({ data: { id: q.id } }).then(() => {
                          qc.invalidateQueries({ queryKey: ["quesitos", caseId] });
                          toast.success("Quesito removido");
                        })
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuesitoItem({
  quesito,
  onSave,
  onDelete,
}: {
  quesito: { id: string; number: number | null; question: string; answer: string | null };
  onSave: (patch: { question?: string; answer?: string | null }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [question, setQuestion] = useState(quesito.question);
  const [answer, setAnswer] = useState(quesito.answer ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = question !== quesito.question || answer !== (quesito.answer ?? "");

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ question, answer: answer.trim() || null });
      toast.success("Quesito salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-2 shrink-0 text-xs font-semibold text-muted-foreground">
          #{quesito.number ?? "—"}
        </span>
        <Textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        rows={2}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Resposta / rascunho técnico (opcional)"
        className="text-sm"
      />
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving} type="button">
            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
            Salvar
          </Button>
        </div>
      )}
    </li>
  );
}
