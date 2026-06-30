import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registerDocument, deleteDocument } from "@/lib/documents.functions";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilePlus2, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const indexFn = useServerFn(indexDocument);
  const deleteFn = useServerFn(deleteDocument);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<{
    old: ExistingDoc;
    file: File;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setDragOver(false);
    }
  }, [open]);

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

  const uploadOne = async (file: File) => {
    if (!user) return;
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${caseId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    const doc = await registerFn({
      data: {
        case_id: caseId,
        filename: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: path,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    try {
      const res = await indexFn({ data: { document_id: doc.id } });
      toast.success(`${file.name}: ${res.chunks ?? 0} trechos indexados`);
    } catch (e) {
      toast.error(
        `Falha ao indexar ${file.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    }
  };

  const submit = async () => {
    if (files.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }
    // detectar duplicatas
    const dupes: { old: ExistingDoc; file: File }[] = [];
    const fresh: File[] = [];
    for (const f of files) {
      const existing = existingDocuments.find((d) => d.filename === f.name);
      if (existing) dupes.push({ old: existing, file: f });
      else fresh.push(f);
    }

    setBusy(true);
    try {
      for (const f of fresh) await uploadOne(f);
      if (dupes.length > 0) {
        // pergunta um por um
        setReplacement(dupes[0]);
        // armazena os restantes em closure não funciona aqui — então faz sequencial via state
        // simplificação: processar sequencial confirmando cada um
        for (let i = 1; i < dupes.length; i++) {
          // adiciona aos selecionados para próxima iteração via toast
          toast.info(`"${dupes[i].file.name}" — abra novamente para substituir`);
        }
      } else {
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = async () => {
    if (!replacement) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: replacement.old.id } });
      await uploadOne(replacement.file);
      setReplacement(null);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Arquivos selecionados:</p>
              <ScrollArea className="h-32 rounded-md border">
                <ul className="p-2 text-sm space-y-1">
                  {files.map((f) => (
                    <li
                      key={`${f.name}-${f.lastModified}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{f.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() =>
                          setFiles((prev) => prev.filter((x) => x !== f))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy || files.length === 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
