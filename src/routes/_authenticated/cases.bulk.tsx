import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createCase,
  extractCaseDataFromDocument,
  attachDocumentToCase,
} from "@/lib/cases.functions";
import { indexDocument } from "@/lib/rag.functions";

export const Route = createFileRoute("/_authenticated/cases/bulk")({
  component: BulkUploadPage,
});

type FileStatus = "pending" | "uploading" | "extracting" | "creating" | "indexing" | "done" | "error";

type FileItem = {
  id: string;
  file: File;
  status: FileStatus;
  message?: string;
  caseId?: string;
  caseTitle?: string;
};

const STATUS_LABEL: Record<FileStatus, string> = {
  pending: "Aguardando",
  uploading: "Enviando...",
  extracting: "Lendo documento com IA...",
  creating: "Criando caso...",
  indexing: "Indexando...",
  done: "Concluído",
  error: "Erro",
};

function BulkUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [running, setRunning] = useState(false);

  const createCaseFn = useServerFn(createCase);
  const extractFn = useServerFn(extractCaseDataFromDocument);
  const attachFn = useServerFn(attachDocumentToCase);
  const indexFn = useServerFn(indexDocument);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: FileItem[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const update = (id: string, patch: Partial<FileItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processOne = async (item: FileItem) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      update(item.id, { status: "uploading" });
      const safe = item.file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/_bulk/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, item.file, { upsert: false, contentType: item.file.type });
      if (upErr) throw upErr;

      update(item.id, { status: "extracting" });
      const { extracted } = await extractFn({
        data: {
          storage_path: path,
          filename: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
        },
      });

      update(item.id, { status: "creating" });
      const newCase = await createCaseFn({
        data: {
          title: extracted.title,
          description: extracted.description || null,
          client_name: extracted.client_name,
          case_number: extracted.case_number,
          jurisdiction: extracted.jurisdiction,
          case_type: extracted.case_type,
          parties: extracted.parties ?? [],
          status: "active",
        },
      });

      const { document_id } = await attachFn({
        data: {
          storage_path: path,
          filename: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          case_id: newCase.id,
        },
      });

      update(item.id, { status: "indexing" });
      try {
        await indexFn({ data: { document_id } });
      } catch (e) {
        console.warn("Indexação falhou", e);
      }

      update(item.id, {
        status: "done",
        caseId: newCase.id,
        caseTitle: newCase.title,
      });
    } catch (e) {
      console.error(e);
      update(item.id, {
        status: "error",
        message: e instanceof Error ? e.message : "Falha desconhecida",
      });
    }
  };

  const runAll = async () => {
    if (!items.length) return;
    setRunning(true);
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    for (const it of pending) {
      // sequencial para não estourar limites de IA
      // eslint-disable-next-line no-await-in-loop
      await processOne(it);
    }
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
    setRunning(false);
    const ok = items.filter((i) => i.status === "done").length;
    if (ok > 0) toast.success(`${ok} caso(s) criados com sucesso`);
  };

  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/cases"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload em lote</h1>
          <p className="mt-1 text-muted-foreground">
            Selecione vários documentos. A IA lê cada um e cria um caso automaticamente.
          </p>
        </div>
      </div>

      <Card
        className="border-dashed border-2 p-10 text-center cursor-pointer hover:bg-muted/40"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium">Clique ou arraste vários arquivos</p>
        <p className="text-sm text-muted-foreground">PDF, DOCX ou TXT</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </Card>

      {items.length > 0 && (
        <Card className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {it.caseTitle ?? it.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(it.file.size / 1024).toFixed(0)} KB · {STATUS_LABEL[it.status]}
                  {it.message ? ` — ${it.message}` : ""}
                </p>
              </div>
              <StatusIcon status={it.status} />
              {it.status === "done" && it.caseId && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/cases/$caseId" params={{ caseId: it.caseId }}>Abrir</Link>
                </Button>
              )}
              {(it.status === "pending" || it.status === "error") && (
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                  Remover
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} arquivo(s) · {doneCount} concluído(s)
          {errorCount > 0 ? ` · ${errorCount} com erro` : ""}
        </p>
        <div className="flex gap-2">
          {doneCount > 0 && !running && (
            <Button variant="outline" onClick={() => navigate({ to: "/cases" })}>
              Ver casos
            </Button>
          )}
          <Button
            onClick={runAll}
            disabled={running || items.length === 0 || items.every((i) => i.status === "done")}
          >
            {running ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
            ) : (
              <>Processar {items.filter((i) => i.status !== "done").length} arquivo(s)</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return null;
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
}
