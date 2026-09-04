import { useRef, useState } from "react";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_LABEL,
} from "@/lib/documents-limits";
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
import { FilePlus2, FolderInput, StopCircle, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadProgressList } from "./upload-progress-list";
import { isUploadActive, useUploadManager } from "./upload-manager";
import { ImportFromLibraryDialog } from "./import-from-library-dialog";
import { FilePreviewCard } from "./file-preview-card";
import {
  DEFAULT_MAX_PART_PAGES,
  PART_SIZE_OPTIONS,
} from "@/lib/documents/pdf-splitter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


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
// Limite único da aplicação (mesma regra validada no servidor).
const MAX_SIZE = MAX_DOCUMENT_SIZE_BYTES;

interface ExistingDoc {
  id: string;
  filename: string;
}

export function UploadDialog({
  caseId,
  existingDocuments,
}: {
  caseId: string;
  existingDocuments: ExistingDoc[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    itemsForCase,
    enqueue,
    cancelItem,
    cancelCase,
    removeItem,
    clearFinished,
    forceUpload,
  } = useUploadManager();

  const precomputedHashesRef = useRef<Map<string, string>>(new Map());
  const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [partSize, setPartSize] = useState<number>(DEFAULT_MAX_PART_PAGES);

  const items = itemsForCase(caseId);
  const hasPdf = files.some(
    (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
  );

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
      toast.error(
        `Arquivos acima de ${MAX_DOCUMENT_SIZE_LABEL} ignorados: ${oversized.join(", ")}`,
      );
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

  const submit = () => {
    if (files.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }
    enqueue({
      caseId,
      files,
      hashes: precomputedHashesRef.current,
      existingDocuments,
      maxPartPages: partSize,
    });
    setFiles([]);
    toast.success(
      "Envio iniciado — você pode fechar esta janela e continuar usando o sistema.",
    );
  };


  const retryItem = (id: string) => {
    toast.info("Selecione o arquivo novamente para reenviar");
    removeItem(id);
  };

  const hasInFlight = items.some((x) => isUploadActive(x.phase));
  const allDone = items.length > 0 && !hasInFlight;

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
            className="sm:max-w-2xl"
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
                Arraste ou selecione PDF, DOCX, XLSX, CSV, TXT, PNG, JPG (até {MAX_DOCUMENT_SIZE_LABEL} cada).
              </DialogDescription>
            </DialogHeader>

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

            {files.length === 0 && (
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
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Revisar antes de registrar
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({files.length}{" "}
                      {files.length === 1 ? "arquivo" : "arquivos"})
                    </span>
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => inputRef.current?.click()}
                  >
                    + adicionar
                  </button>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                  {files.map((f) => (
                    <FilePreviewCard
                      key={`${f.name}-${f.lastModified}-${f.size}`}
                      file={f}
                      onRemove={() =>
                        setFiles((prev) => prev.filter((x) => x !== f))
                      }
                      onHashComputed={(h) =>
                        precomputedHashesRef.current.set(fileKey(f), h)
                      }
                    />
                  ))}
                </div>
                {hasPdf && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <label
                      htmlFor="part-size"
                      className="text-sm font-medium"
                    >
                      Dividir PDFs longos automaticamente
                    </label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      PDFs com muitas páginas são divididos em partes antes do
                      envio, para que a leitura não trave. As partes continuam
                      agrupadas como um único documento.
                    </p>
                    <Select
                      value={String(partSize)}
                      onValueChange={(v) => setPartSize(Number(v))}
                    >
                      <SelectTrigger id="part-size" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PART_SIZE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-2xs text-muted-foreground">
                  Confira o conteúdo e os metadados extraídos. Nada é gravado
                  no caso até você confirmar o envio.
                </p>

              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Progresso:</p>
                  {hasInFlight && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelCase(caseId)}
                      className="h-9 text-sm text-muted-foreground hover:text-destructive"
                    >
                      <StopCircle className="mr-1 h-3.5 w-3.5" />
                      Cancelar todos
                    </Button>
                  )}
                </div>
                <UploadProgressList
                  items={items}
                  onRemove={removeItem}
                  onRetry={retryItem}
                  onCancel={cancelItem}
                  onForce={forceUpload}
                />

              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {allDone ? "Fechar" : hasInFlight ? "Fechar (continua enviando)" : "Cancelar"}
              </Button>
              {files.length > 0 || items.length === 0 ? (
                <Button onClick={submit} disabled={files.length === 0}>
                  Confirmar e registrar
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    clearFinished(caseId);
                    if (inputRef.current) inputRef.current.click();
                  }}
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

    </>
  );
}
