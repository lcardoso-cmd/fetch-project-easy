import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, FolderInput, Loader2, Search } from "lucide-react";
import {
  attachExistingDocument,
  listImportableDocuments,
} from "@/lib/documents.functions";
import { indexDocument } from "@/lib/rag.functions";

interface LibraryDoc {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  processing_status: string;
  created_at: string | null;
  case_id: string | null;
  case_title: string | null;
  content_hash: string | null;
}

function formatBytes(b: number) {
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ImportFromLibraryDialog({
  caseId,
  existingFilenames,
  existingHashes,
  trigger,
  open,
  onOpenChange,
}: {
  caseId: string;
  existingFilenames: string[];
  existingHashes: string[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const qc = useQueryClient();
  const listFn = useServerFn(listImportableDocuments);
  const attachFn = useServerFn(attachExistingDocument);
  const indexFn = useServerFn(indexDocument);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LibraryDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelected(new Set());
      setQ("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    listFn({ data: { exclude_case_id: caseId } })
      .then((rows) => {
        if (!cancelled) setItems(rows as LibraryDoc[]);
      })
      .catch((e) =>
        toast.error(
          `Falha ao carregar documentos: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, caseId, listFn]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      const alreadyHere =
        existingFilenames.includes(it.filename) ||
        (it.content_hash ? existingHashes.includes(it.content_hash) : false);
      if (alreadyHere) return false;
      if (!term) return true;
      return (
        it.filename.toLowerCase().includes(term) ||
        (it.case_title ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, existingFilenames, existingHashes]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    let attached = 0;
    let duplicates = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        const res = await attachFn({
          data: { source_document_id: id, case_id: caseId },
        });
        if ("duplicate" in res && res.duplicate) {
          duplicates += 1;
          continue;
        }
        attached += 1;
        // Reindexa para garantir chunks no escopo do novo caso
        const docId = (res as { document: { id: string } }).document.id;
        indexFn({ data: { document_id: docId } }).catch(() => {});
      } catch (e) {
        failed += 1;
        toast.error(
          `Falha ao importar: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    await qc.invalidateQueries({ queryKey: ["documents", caseId] });
    if (attached > 0) toast.success(`${attached} documento(s) importado(s)`);
    if (duplicates > 0)
      toast.info(`${duplicates} documento(s) já existia(m) no caso`);
    if (failed > 0) toast.error(`${failed} falha(s) na importação`);
    setBusy(false);
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" /> Importar de Meus Documentos
          </DialogTitle>
          <DialogDescription>
            Selecione documentos que você já carregou em outros casos para
            anexá-los aqui. Nada é reenviado — o mesmo arquivo é reaproveitado.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome do arquivo ou caso…"
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-80 rounded-md border">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Você ainda não tem documentos em outros casos."
                : "Nenhum documento corresponde à busca (ou já estão neste caso)."}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((it) => {
                const checked = selected.has(it.id);
                return (
                  <li
                    key={it.id}
                    className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50"
                    onClick={() => toggle(it.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(it.id)}
                      className="mt-0.5"
                    />
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {it.filename}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {it.case_title && (
                          <Badge variant="secondary" className="font-normal">
                            {it.case_title}
                          </Badge>
                        )}
                        <span>{formatBytes(it.file_size)}</span>
                        {it.created_at && (
                          <span>
                            {new Date(it.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={busy || selected.size === 0}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
