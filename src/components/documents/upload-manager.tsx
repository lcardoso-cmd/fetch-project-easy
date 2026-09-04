import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  createUploadSignedUrl,
  deleteDocument,
  discardUploadedObject,
  registerDocument,
} from "@/lib/documents.functions";
import { indexDocument } from "@/lib/rag.functions";
import {
  splitPdf,
  shouldSplitPdf,
  DEFAULT_MAX_PART_PAGES,
} from "@/lib/documents/pdf-splitter";

import {
  UploadProgressList,
  type UploadItem,
} from "./upload-progress-list";

export interface CaseUploadItem extends UploadItem {
  caseId: string;
  parentId?: string;
  partIndex?: number;
  partCount?: number;
}




interface EnqueueArgs {
  caseId: string;
  files: File[];
  hashes?: Map<string, string>;
  existingDocuments?: { id: string; filename: string }[];
  /** Páginas por parte ao dividir PDFs grandes. 0 desativa a divisão. */
  maxPartPages?: number;
}

interface QueueEntry {
  file: Blob;
  filename: string;
  fileType: string;
  itemId: string;
  caseId: string;
  hash?: string;
  existing?: { id: string; filename: string }[];
  maxPartPages?: number;
  /** Já é uma parte pronta (não tentar dividir de novo). */
  partMeta?: {
    splitGroupId: string;
    partIndex: number;
    partCount: number;
    pageOffset: number;
    pageCount: number;
  };
}


interface UploadManagerValue {
  items: CaseUploadItem[];
  itemsForCase: (caseId: string) => CaseUploadItem[];
  enqueue: (args: EnqueueArgs) => void;
  cancelItem: (id: string) => void;
  cancelCase: (caseId: string) => void;
  removeItem: (id: string) => void;
  clearFinished: (caseId?: string) => void;
  forceUpload: (id: string) => void;

}

const UploadManagerContext = createContext<UploadManagerValue | null>(null);

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx)
    throw new Error("useUploadManager precisa estar dentro de UploadManagerProvider");
  return ctx;
}

const ACTIVE_PHASES = [
  "queued",
  "splitting",
  "hashing",
  "uploading",
  "registering",
  "indexing",
] as const;

export function isUploadActive(phase: UploadItem["phase"]) {
  return (ACTIVE_PHASES as readonly string[]).includes(phase);
}

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}


function putWithProgress(
  signedUrl: string,
  blob: Blob,
  filename: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelado", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Erro de rede durante upload"));
    xhr.onabort = () => reject(new DOMException("Upload cancelado", "AbortError"));
    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        /* ignore */
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", onAbort);
    xhr.send(blob);
  });
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const registerFn = useServerFn(registerDocument);
  const signFn = useServerFn(createUploadSignedUrl);
  const indexFn = useServerFn(indexDocument);
  const deleteFn = useServerFn(deleteDocument);
  const discardFn = useServerFn(discardUploadedObject);

  const [items, setItems] = useState<CaseUploadItem[]>([]);
  const [replacement, setReplacement] = useState<
    | ({
        existing: { id: string; filename: string };
      } & Pick<
        QueueEntry,
        "file" | "filename" | "fileType" | "itemId" | "caseId" | "maxPartPages" | "partMeta"
      >)
    | null
  >(null);
  const [replacing, setReplacing] = useState(false);


  const abortersRef = useRef<Map<string, AbortController>>(new Map());
  const cancelledRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);
  const queueRef = useRef<QueueEntry[]>([]);
  const pendingForceRef = useRef<Map<string, QueueEntry>>(new Map());


  const patchItem = useCallback(
    (id: string, patch: Partial<CaseUploadItem>) =>
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [],
  );

  const uploadOne = useCallback(
    async (entry: QueueEntry) => {
      const { itemId, caseId, filename, fileType, file, partMeta } = entry;
      const controller = new AbortController();
      abortersRef.current.set(itemId, controller);
      const { signal } = controller;
      let uploadedPath: string | null = null;
      const isAbort = (e: unknown) =>
        signal.aborted || (e instanceof DOMException && e.name === "AbortError");
      try {
        patchItem(itemId, { phase: "hashing", pct: 0 });
        const contentHash = entry.hash ?? (await hashBlob(file));
        if (signal.aborted) throw new DOMException("cancel", "AbortError");

        const { signedUrl, path } = await signFn({
          data: {
            case_id: caseId,
            filename,
            file_type: fileType || "application/octet-stream",
            file_size: file.size,
          },
        });
        if (signal.aborted) throw new DOMException("cancel", "AbortError");

        patchItem(itemId, { phase: "uploading", pct: 0 });
        await putWithProgress(
          signedUrl,
          file,
          filename,
          (pct: number) => patchItem(itemId, { pct }),
          signal,
        );
        uploadedPath = path;

        patchItem(itemId, { phase: "registering", pct: 100 });
        const res = await registerFn({
          data: {
            case_id: caseId,
            filename,
            file_type: fileType || "application/octet-stream",
            file_size: file.size,
            storage_path: path,
            content_hash: contentHash,
            ...(partMeta
              ? {
                  split_group_id: partMeta.splitGroupId,
                  part_index: partMeta.partIndex,
                  part_count: partMeta.partCount,
                  page_offset: partMeta.pageOffset,
                  page_count: partMeta.pageCount,
                }
              : {}),
          },
        });

        if ("duplicate" in res && res.duplicate) {
          uploadedPath = null;
          if (res.reason === "filename") {
            const existing =
              entry.existing?.find((d) => d.id === res.existing_id) ?? {
                id: res.existing_id,
                filename: res.existing_filename,
              };
            patchItem(itemId, {
              phase: "duplicate",
              message: "Já existe um arquivo com esse nome",
            });
            setReplacement({
              existing,
              file,
              filename,
              fileType,
              itemId,
              caseId,
              maxPartPages: entry.maxPartPages,
              partMeta,
            });

            return;
          }
          patchItem(itemId, {
            phase: "duplicate",
            message: `Já existente: ${res.existing_filename}`,
          });
          return;
        }

        const doc = res.document as { id: string };
        uploadedPath = null;
        await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });

        patchItem(itemId, { phase: "indexing" });
        try {
          const idx = await indexFn({ data: { document_id: doc.id } });
          patchItem(itemId, {
            phase: "done",
            message: idx.queued
              ? "Enviado — a leitura continua no servidor"
              : `Pronto — ${idx.chunks} trechos indexados`,
            chunks: idx.queued ? undefined : idx.chunks,
          });
        } catch (e) {
          patchItem(itemId, {
            phase: "error",
            message: `Falha ao indexar: ${e instanceof Error ? e.message : String(e)}`,
          });
        } finally {
          await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
        }
      } catch (e) {
        if (isAbort(e)) {
          patchItem(itemId, { phase: "cancelled", message: "Envio cancelado" });
          if (uploadedPath) discardFn({ data: { storage_path: uploadedPath } }).catch(() => {});
        } else {
          patchItem(itemId, {
            phase: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        abortersRef.current.delete(itemId);
      }
    },
    [discardFn, indexFn, patchItem, queryClient, registerFn, signFn],
  );

  /**
   * Divide PDFs grandes em partes reais antes do upload. Retorna as entradas
   * que devem ir para a fila no lugar da entrada original.
   */
  const expandEntry = useCallback(
    async (entry: QueueEntry): Promise<QueueEntry[]> => {
      const limit = entry.maxPartPages ?? DEFAULT_MAX_PART_PAGES;
      if (
        entry.partMeta ||
        limit <= 0 ||
        !(entry.file instanceof File) ||
        !shouldSplitPdf(entry.file)
      ) {
        return [entry];
      }
      try {
        patchItem(entry.itemId, { phase: "splitting", pct: 0 });
        const result = await splitPdf({ file: entry.file, maxPartPages: limit });
        if (result.parts.length <= 1) return [entry];

        const splitGroupId = crypto.randomUUID();
        const entries: QueueEntry[] = result.parts.map((part) => ({
          file: part.blob,
          filename: part.filename,
          fileType: "application/pdf",
          itemId: `${entry.itemId}-p${part.partIndex}`,
          caseId: entry.caseId,
          existing: entry.existing,
          partMeta: {
            splitGroupId,
            partIndex: part.partIndex,
            partCount: part.partCount,
            pageOffset: part.pageOffset,
            pageCount: part.pageCount,
          },
        }));

        setItems((prev) => [
          ...prev.filter((x) => x.id !== entry.itemId),
          ...entries.map((e) => ({
            id: e.itemId,
            caseId: e.caseId,
            filename: e.filename,
            size: e.file.size,
            pct: 0,
            phase: "queued" as const,
            partIndex: e.partMeta?.partIndex,
            partCount: e.partMeta?.partCount,
          })),
        ]);
        toast.info(
          `“${entry.filename}” foi dividido em ${result.parts.length} partes para processar com segurança.`,
        );
        return entries;
      } catch (e) {
        // Divisão falhou: não enviamos o arquivo inteiro silenciosamente.
        console.error("Falha ao dividir PDF:", e);
        pendingForceRef.current.set(entry.itemId, { ...entry, maxPartPages: 0 });
        patchItem(entry.itemId, {
          phase: "split_failed",
          message: `Não foi possível dividir “${entry.filename}”: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
        return [];
      }

    },
    [patchItem],
  );

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        if (cancelledRef.current.has(next.itemId)) {
          cancelledRef.current.delete(next.itemId);
          patchItem(next.itemId, { phase: "cancelled", message: "Envio cancelado" });
          continue;
        }
        const expanded = await expandEntry(next);
        for (const item of expanded) {
          if (cancelledRef.current.has(item.itemId)) {
            cancelledRef.current.delete(item.itemId);
            patchItem(item.itemId, { phase: "cancelled", message: "Envio cancelado" });
            continue;
          }
          await uploadOne(item);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [expandEntry, patchItem, uploadOne]);

  const enqueue = useCallback(
    ({ caseId, files, hashes, existingDocuments, maxPartPages }: EnqueueArgs) => {
      if (files.length === 0) return;
      const created: QueueEntry[] = files.map((file) => ({
        file,
        filename: file.name,
        fileType: file.type || "application/octet-stream",
        caseId,
        itemId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        hash: hashes?.get(fileKey(file)),
        existing: existingDocuments,
        maxPartPages,
      }));
      setItems((prev) => [
        ...prev,
        ...created.map((e) => ({
          id: e.itemId,
          caseId,
          filename: e.filename,
          size: e.file.size,
          pct: 0,
          phase: "queued" as const,
        })),
      ]);
      queueRef.current.push(...created);
      void drain();
    },
    [drain],
  );


  const cancelItem = useCallback(
    (id: string) => {
      const controller = abortersRef.current.get(id);
      if (controller) controller.abort();
      else {
        cancelledRef.current.add(id);
        patchItem(id, { phase: "cancelled", message: "Envio cancelado" });
      }
    },
    [patchItem],
  );

  const cancelCase = useCallback(
    (caseId: string) => {
      setItems((prev) => {
        prev
          .filter((it) => it.caseId === caseId && isUploadActive(it.phase))
          .forEach((it) => cancelItem(it.id));
        return prev;
      });
      toast.info("Cancelando envios…");
    },
    [cancelItem],
  );

  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((x) => x.id !== id)),
    [],
  );

  const clearFinished = useCallback(
    (caseId?: string) =>
      setItems((prev) =>
        prev.filter(
          (x) =>
            isUploadActive(x.phase) || (caseId ? x.caseId !== caseId : false),
        ),
      ),
    [],
  );

  const itemsForCase = useCallback(
    (caseId: string) => items.filter((x) => x.caseId === caseId),
    [items],
  );

  const confirmReplace = async () => {
    if (!replacement) return;
    setReplacing(true);
    const { existing, file, filename, fileType, itemId, caseId, maxPartPages, partMeta } =
      replacement;
    try {
      await deleteFn({ data: { id: existing.id } });
      const newId = `${filename}-retry-${Date.now()}`;
      setItems((prev) => [
        ...prev.filter((x) => x.id !== itemId),
        {
          id: newId,
          caseId,
          filename,
          size: file.size,
          pct: 0,
          phase: "queued" as const,
          partIndex: partMeta?.partIndex,
          partCount: partMeta?.partCount,
        },
      ]);
      setReplacement(null);
      queueRef.current.push({
        file,
        filename,
        fileType,
        itemId: newId,
        caseId,
        maxPartPages,
        partMeta,
      });
      void drain();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setReplacing(false);
    }
  };

  /** Envia o PDF inteiro após uma falha de divisão, por escolha do usuário. */
  const forceUpload = useCallback(
    (id: string) => {
      const entry = pendingForceRef.current.get(id);
      if (!entry) return;
      pendingForceRef.current.delete(id);
      patchItem(id, { phase: "queued", message: undefined, pct: 0 });
      queueRef.current.push(entry);
      void drain();
    },
    [drain, patchItem],
  );



  const value = useMemo<UploadManagerValue>(
    () => ({
      items,
      itemsForCase,
      enqueue,
      cancelItem,
      cancelCase,
      removeItem,
      clearFinished,
      forceUpload,
    }),
    [
      items,
      itemsForCase,
      enqueue,
      cancelItem,
      cancelCase,
      removeItem,
      clearFinished,
      forceUpload,
    ],

  );

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
      <UploadDock />
      <AlertDialog open={!!replacement} onOpenChange={(o) => !o && setReplacement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um arquivo chamado{" "}
              <span className="font-bold">{replacement?.filename}</span> neste caso.
              Substituir vai excluir o anterior e todos os dados indexados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replacing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace} disabled={replacing}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UploadManagerContext.Provider>
  );
}

/** Painel flutuante que mantém os envios visíveis mesmo com o diálogo fechado. */
function UploadDock() {
  const { items, cancelItem, removeItem, clearFinished, forceUpload } = useUploadManager();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;
  const active = items.filter((x) => isUploadActive(x.phase)).length;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <UploadCloud className="size-4 text-muted-foreground" />
        <p className="flex-1 truncate text-sm font-medium">
          {active > 0
            ? `Enviando ${active} de ${items.length} arquivo(s)`
            : `${items.length} envio(s) concluído(s)`}
        </p>
        {active === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => clearFinished()}
          >
            Limpar
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={collapsed ? "Expandir envios" : "Recolher envios"}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="max-h-[45vh] space-y-2 overflow-auto p-3">
          <UploadProgressList
            items={items}
            onCancel={cancelItem}
            onRemove={removeItem}
            onForce={forceUpload}
          />

          {active > 0 && (
            <p className="text-xs text-muted-foreground">
              Você pode navegar pelo sistema — os envios continuam aqui.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
