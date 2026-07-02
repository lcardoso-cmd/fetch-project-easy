import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  createUploadSignedUrl,
  deleteDocument,
  registerDocument,
} from "@/lib/documents.functions";
import { indexDocument } from "@/lib/rag.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilePlus2, FolderInput, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UploadProgressList,
  type UploadItem,
} from "./upload-progress-list";
import { ImportFromLibraryDialog } from "./import-from-library-dialog";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
];
const ACCEPT_STRING = [
  ".pdf",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ...ACCEPTED_TYPES,
].join(",");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

interface ExistingDoc {
  id: string;
  filename: string;
}

/** Calcula SHA-256 do arquivo inteiro no cliente (Web Crypto). */
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PUT ao signedUrl com progresso real via XHR. */
function putWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Erro de rede durante upload"));
    xhr.send(file);
  });
}

export function UploadDialog({
  caseId,
  existingDocuments,
}: {
  caseId: string;
  existingDocuments: ExistingDoc[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const registerFn = useServerFn(registerDocument);
  const signFn = useServerFn(createUploadSignedUrl);
  const indexFn = useServerFn(indexDocument);
  const deleteFn = useServerFn(deleteDocument);

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [replacement, setReplacement] = useState<{
    existing: ExistingDoc;
    file: File;
    itemId: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setItems([]);
      setDragOver(false);
    }
  }, [open]);

  const patchItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addFiles = (incoming: File[]) => {
    const valid: File[] = [];
    const oversized: string[] = [];
    const invalid: string[] = [];
    for (const f of incoming) {
      if (f.size > MAX_SIZE) {
        oversized.push(f.name);
        continue;
      }
      const okType =
        ACCEPTED_TYPES.includes(f.type) ||
        /\.(pdf|docx|xlsx?|csv|txt|png|jpe?g)$/i.test(f.name);
      if (!okType) {
        invalid.push(f.name);
        continue;
      }
      valid.push(f);
    }
    if (oversized.length)
      toast.error(`Arquivos > 20 MB ignorados: ${oversized.join(", ")}`);
    if (invalid.length)
      toast.error(`Tipo não suportado: ${invalid.join(", ")}`);
    setFiles((prev) => {
      const out = [...prev];
      for (const f of valid) {
        if (!out.some((x) => x.name === f.name && x.size === f.size)) out.push(f);
      }
      return out;
    });
  };

  const uploadOne = async (file: File, itemId: string) => {
    if (!user) return;
    try {
      // 1. Hash
      patchItem(itemId, { phase: "hashing", pct: 0 });
      const contentHash = await hashFile(file);

      // 2. URL assinada
      const { signedUrl, path } = await signFn({
        data: { case_id: caseId, filename: file.name },
      });

      // 3. Upload com progresso
      patchItem(itemId, { phase: "uploading", pct: 0 });
      await putWithProgress(signedUrl, file, (pct) =>
        patchItem(itemId, { pct }),
      );

      // 4. Registrar (server checa duplicatas)
      patchItem(itemId, { phase: "registering", pct: 100 });
      const res = await registerFn({
        data: {
          case_id: caseId,
          filename: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          storage_path: path,
          content_hash: contentHash,
        },
      });

      if ("duplicate" in res && res.duplicate) {
        // Se for por nome, oferecer substituir; se por hash, avisar.
        if (res.reason === "filename") {
          const existing = existingDocuments.find(
            (d) => d.id === res.existing_id,
          ) ?? { id: res.existing_id, filename: res.existing_filename };
          patchItem(itemId, {
            phase: "duplicate",
            message: "Já existe um arquivo com esse nome",
          });
          setReplacement({ existing, file, itemId });
          return;
        }
        patchItem(itemId, {
          phase: "duplicate",
          message: `Já existente: ${res.existing_filename}`,
        });
        return;
      }

      const doc = res.document as { id: string };
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });

      // 5. Indexar
      patchItem(itemId, { phase: "indexing" });
      try {
        const idx = await indexFn({ data: { document_id: doc.id } });
        patchItem(itemId, {
          phase: "done",
          message: `Pronto — ${idx.chunks ?? 0} trechos indexados`,
          chunks: idx.chunks,
        });
      } catch (e) {
        patchItem(itemId, {
          phase: "error",
          message: `Falha ao indexar: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
      }
    } catch (e) {
      patchItem(itemId, {
        phase: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const submit = async () => {
    if (files.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }
    const queue: { file: File; itemId: string }[] = files.map((f) => {
      const id = `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
      return { file: f, itemId: id };
    });
    setItems(
      queue.map(({ file, itemId }) => ({
        id: itemId,
        filename: file.name,
        size: file.size,
        pct: 0,
        phase: "queued" as const,
      })),
    );
    setFiles([]);
    setBusy(true);
    try {
      for (const { file, itemId } of queue) {
        await uploadOne(file, itemId);
      }
    } finally {
      setBusy(false);
    }
  };

  const retryItem = async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    // não temos o File aqui após submit; peça pra recarregar
    toast.info("Selecione o arquivo novamente para reenviar");
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((x) => x.id !== id));

  const confirmReplace = async () => {
    if (!replacement) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: replacement.existing.id } });
      // reenvia o mesmo arquivo com novo itemId
      const newId = `${replacement.file.name}-retry-${Date.now()}`;
      setItems((prev) => [
        ...prev.filter((x) => x.id !== replacement.itemId),
        {
          id: newId,
          filename: replacement.file.name,
          size: replacement.file.size,
          pct: 0,
          phase: "queued",
        },
      ]);
      const f = replacement.file;
      setReplacement(null);
      await uploadOne(f, newId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const allDone =
    items.length > 0 &&
    items.every((x) => x.phase === "done" || x.phase === "duplicate" || x.phase === "error");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
        >
          <FolderInput className="mr-2 h-4 w-4" /> Importar de Meus Documentos
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <FilePlus2 className="mr-2 h-4 w-4" /> Carregar
            </Button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-lg"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <DialogHeader>
              <DialogTitle>Carregar documentos</DialogTitle>
              <DialogDescription>
                Arraste ou selecione PDF, DOCX, XLSX, CSV, TXT, PNG, JPG (até 20 MB cada).
              </DialogDescription>
            </DialogHeader>

            {items.length === 0 && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/10" : "border-muted",
                )}
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos ou clique aqui
                </p>
                <Input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_STRING}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                />
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Arquivos selecionados:</p>
                <ul className="max-h-40 space-y-1 overflow-auto rounded-md border p-2 text-sm">
                  {files.map((f) => (
                    <li
                      key={`${f.name}-${f.lastModified}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFiles((prev) => prev.filter((x) => x !== f))
                        }
                      >
                        remover
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Progresso:</p>
                <UploadProgressList
                  items={items}
                  onRemove={removeItem}
                  onRetry={retryItem}
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                {allDone ? "Fechar" : "Cancelar"}
              </Button>
              {items.length === 0 ? (
                <Button
                  onClick={submit}
                  disabled={busy || files.length === 0}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar upload
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setItems([]);
                    if (inputRef.current) inputRef.current.click();
                  }}
                  disabled={busy}
                  variant="outline"
                >
                  Enviar mais arquivos
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ImportFromLibraryDialog
        caseId={caseId}
        existingFilenames={existingDocuments.map((d) => d.filename)}
        existingHashes={[]}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <AlertDialog
        open={!!replacement}
        onOpenChange={(o) => !o && setReplacement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um arquivo chamado{" "}
              <span className="font-bold">{replacement?.file.name}</span> neste
              caso. Substituir vai excluir o anterior e todos os dados indexados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
