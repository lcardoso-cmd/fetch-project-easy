import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { History, Trash2, RotateCcw, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import {
  formatVersionDate,
  loadVersions,
  removeVersion,
  type ProposalVersion,
} from "@/lib/proposal-versions";

type Props<TForm> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentForm: TForm;
  currentOutput: string;
  onRestore: (v: ProposalVersion<TForm>) => void;
  refreshKey?: number;
};

export function ProposalVersionsDialog<TForm>({
  open,
  onOpenChange,
  currentForm,
  currentOutput,
  onRestore,
  refreshKey = 0,
}: Props<TForm>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const versions = useMemo<ProposalVersion<TForm>[]>(
    () => (open ? loadVersions<TForm>() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, tick, refreshKey],
  );

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;

  const handleDelete = (id: string) => {
    removeVersion(id);
    if (selectedId === id) setSelectedId(null);
    setTick((n) => n + 1);
    toast.success("Versão removida");
  };

  const handleRestore = (v: ProposalVersion<TForm>) => {
    onRestore(v);
    onOpenChange(false);
    toast.success("Versão restaurada", { description: v.label });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <History className="h-5 w-5" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            {versions.length === 0
              ? "Nenhuma versão salva ainda. Salve uma versão ou gere uma proposta para começar."
              : `${versions.length} versão(ões) armazenada(s) neste dispositivo.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[280px_1fr]" style={{ minHeight: "60vh" }}>
          <ScrollArea className="max-h-[70vh] border-r">
            <ul className="divide-y">
              {versions.map((v) => {
                const active = selected?.id === v.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className={`flex w-full flex-col gap-1 p-3 text-left transition-colors ${
                        active ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
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
                        {formatVersionDate(v.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {versions.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Sem versões.
                </li>
              )}
            </ul>
          </ScrollArea>

          <div className="flex min-w-0 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatVersionDate(selected.createdAt)}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(selected.id)}
                    >
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

                  <TabsContent value="compare" className="min-h-0 flex-1 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex min-w-0 flex-col">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Versão selecionada
                        </p>
                        <ScrollArea className="h-[55vh] rounded-md border bg-background">
                          <div
                            className="proposal-preview p-4 text-xs leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html:
                                selected.output || "<p><em>Sem conteúdo.</em></p>",
                            }}
                          />
                        </ScrollArea>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Atual
                        </p>
                        <ScrollArea className="h-[55vh] rounded-md border bg-background">
                          <div
                            className="proposal-preview p-4 text-xs leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html:
                                currentOutput ||
                                "<p><em>Nada gerado no editor atual.</em></p>",
                            }}
                          />
                        </ScrollArea>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Restaurar substitui o formulário e o texto atual pelos desta versão. O rascunho atual será sobrescrito.
                    </p>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                Selecione uma versão à esquerda para visualizar.
              </div>
            )}
          </div>
        </div>
        {/* currentForm is kept for future field-level diff; referenced to satisfy TS. */}
        <span className="hidden" aria-hidden data-current-form={typeof currentForm} />
      </DialogContent>
    </Dialog>
  );
}
