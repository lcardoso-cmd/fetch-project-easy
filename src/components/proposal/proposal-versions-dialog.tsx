import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { History, Trash2, RotateCcw, GitCompareArrows, Pin, PinOff, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteProposalVersion,
  listProposalVersions,
  updateProposalVersion,
  type ProposalVersion,
} from "@/lib/proposal-drafts.functions";
import { diffForms, diffHtml } from "@/lib/proposal-diff";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string | null;
  currentForm: Record<string, string>;
  currentOutput: string;
  onRestore: (v: ProposalVersion) => void;
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProposalVersionsDialog({
  open,
  onOpenChange,
  caseId,
  currentForm,
  currentOutput,
  onRestore,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposalVersions);
  const updateFn = useServerFn(updateProposalVersion);
  const deleteFn = useServerFn(deleteProposalVersion);

  const versionsKey = ["proposal-versions", caseId ?? "none"];

  const versionsQ = useQuery({
    queryKey: versionsKey,
    queryFn: () => listFn({ data: { case_id: caseId } }),
    enabled: open,
  });

  const versions = versionsQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;

  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: versionsKey });

  const updateMut = useMutation({
    mutationFn: (input: { id: string; label?: string; description?: string | null; pinned?: boolean }) =>
      updateFn({ data: input }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      toast.success("Versão removida");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  const startEdit = (v: ProposalVersion) => {
    setEditing(v.id);
    setEditLabel(v.label);
    setEditDesc(v.description ?? "");
  };
  const saveEdit = async () => {
    if (!editing) return;
    await updateMut.mutateAsync({ id: editing, label: editLabel, description: editDesc || null });
    setEditing(null);
    toast.success("Versão atualizada");
  };

  const togglePin = (v: ProposalVersion) =>
    updateMut.mutate({ id: v.id, pinned: !v.pinned });

  const handleRestore = (v: ProposalVersion) => {
    onRestore(v);
    onOpenChange(false);
  };

  const formDiff = useMemo(
    () => (selected ? diffForms(selected.form as Record<string, string>, currentForm) : []),
    [selected, currentForm],
  );
  const textDiff = useMemo(
    () => (selected ? diffHtml(selected.output, currentOutput) : ""),
    [selected, currentOutput],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <History className="h-5 w-5" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            {versionsQ.isLoading
              ? "Carregando…"
              : versions.length === 0
                ? "Nenhuma versão salva ainda. Gere uma proposta ou clique em ‘Salvar versão’."
                : `${versions.length} versão(ões) salvas na nuvem.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[320px_1fr]" style={{ minHeight: "60vh" }}>
          <ScrollArea className="max-h-[70vh] border-r">
            <ul className="divide-y">
              {versions.map((v) => {
                const active = selected?.id === v.id;
                return (
                  <li key={v.id}>
                    <div
                      className={`flex flex-col gap-1 p-3 transition-colors ${
                        active ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      {editing === v.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Rótulo"
                          />
                          <Textarea
                            rows={2}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Descrição (opcional)"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>
                              {updateMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          className="text-left"
                        >
                          <div className="flex items-center gap-2">
                            {v.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="truncate text-sm font-medium">{v.label}</span>
                            <Badge variant="outline" className="ml-auto shrink-0 text-[10px] uppercase">
                              {v.origin === "manual"
                                ? "manual"
                                : v.origin === "auto-generate"
                                  ? "gerada"
                                  : "auto"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(v.created_at)}
                          </span>
                          {v.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {v.description}
                            </p>
                          )}
                        </button>
                      )}
                      {editing !== v.id && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => togglePin(v)}>
                            {v.pinned ? (
                              <>
                                <PinOff className="mr-1 h-3 w-3" /> Desafixar
                              </>
                            ) : (
                              <>
                                <Pin className="mr-1 h-3 w-3" /> Fixar
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => startEdit(v)}>
                            <Pencil className="mr-1 h-3 w-3" /> Editar
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {!versionsQ.isLoading && versions.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">Sem versões.</li>
              )}
            </ul>
          </ScrollArea>

          <div className="flex min-w-0 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(selected.created_at)}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => deleteMut.mutate(selected.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Excluir
                    </Button>
                    <Button size="sm" onClick={() => handleRestore(selected)}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Restaurar
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="mx-3 mt-3 w-fit">
                    <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
                    <TabsTrigger value="compare">
                      <GitCompareArrows className="mr-1 h-4 w-4" /> Comparar com atual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="min-h-0 flex-1 p-3">
                    <ScrollArea className="h-[55vh] rounded-md border bg-background">
                      <div
                        className="proposal-preview p-6 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: selected.output || "<p><em>Sem conteúdo gerado nesta versão.</em></p>",
                        }}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="compare" className="min-h-0 flex-1 space-y-3 p-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Diff do texto gerado (verde = adicionado, vermelho = removido)
                      </p>
                      <ScrollArea className="h-[35vh] rounded-md border bg-background">
                        <div
                          className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: textDiff || "<em class='text-muted-foreground'>Sem diferenças no texto.</em>",
                          }}
                        />
                      </ScrollArea>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Campos alterados
                      </p>
                      {formDiff.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum campo do formulário mudou.</p>
                      ) : (
                        <div className="rounded-md border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 text-left">
                              <tr>
                                <th className="p-2">Campo</th>
                                <th className="p-2">Versão</th>
                                <th className="p-2">Atual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formDiff.map((d) => (
                                <tr key={d.field} className="border-t align-top">
                                  <td className="p-2 font-mono text-[11px]">{d.field}</td>
                                  <td className="p-2 text-red-700">{d.from || <em className="text-muted-foreground">vazio</em>}</td>
                                  <td className="p-2 text-emerald-700">{d.to || <em className="text-muted-foreground">vazio</em>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Restaurar substitui o formulário e o texto atual. Um backup automático do estado atual será criado.
                    </p>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                {versionsQ.isLoading ? "Carregando…" : "Selecione uma versão à esquerda."}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
