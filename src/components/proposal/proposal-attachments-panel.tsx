import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteProposalAttachment,
  extractProposalAttachment,
  listProposalAttachments,
  registerProposalAttachment,
  type ExtractedProposalFields,
  type ProposalAttachment,
} from "@/lib/proposal-attachments.functions";

type Props = {
  caseId: string | null;
  userId: string | undefined;
  onSuggestFields: (fields: ExtractedProposalFields) => void;
};

const ACCEPT =
  ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*";
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

function humanSize(bytes: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function ProposalAttachmentsPanel({ caseId, userId, onSuggestFields }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposalAttachments);
  const registerFn = useServerFn(registerProposalAttachment);
  const extractFn = useServerFn(extractProposalAttachment);
  const deleteFn = useServerFn(deleteProposalAttachment);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryKey = ["proposal-attachments", caseId ?? "none"];
  const attachmentsQ = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { case_id: caseId } }),
  });
  const attachments = attachmentsQ.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const runExtract = async (id: string, silent = false) => {
    setExtractingId(id);
    try {
      const updated = await extractFn({ data: { id } });
      invalidate();
      if (updated.extracted_fields) {
        onSuggestFields(updated.extracted_fields);
        if (!silent) toast.success("Dados sugeridos do documento");
      }
      return updated;
    } catch (err) {
      invalidate();
      toast.error(err instanceof Error ? err.message : "Falha ao extrair dados");
      return null;
    } finally {
      setExtractingId(null);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!userId) {
      toast.error("Sessão expirada. Recarregue a página.");
      return;
    }
    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_FILES} anexos por proposta.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      for (const file of toUpload) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name} excede 20 MB e foi ignorado.`);
          continue;
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${userId}/proposals/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
          continue;
        }
        const registered = await registerFn({
          data: {
            case_id: caseId,
            filename: file.name,
            file_type: file.type || "application/octet-stream",
            file_size: file.size,
            storage_path: path,
          },
        });
        invalidate();
        // dispara extração em background — silencioso, resultado aparece no card
        void runExtract(registered.id, true).then((res) => {
          if (res?.extracted_fields) {
            toast.success(`Dados sugeridos de "${file.name}"`);
          }
        });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAttachment = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      invalidate();
      toast.success("Anexo removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <FileText className="h-5 w-5" /> Documentos do cliente
        </CardTitle>
        <CardDescription>
          Suba petições, contratos ou documentos enviados pelo cliente. A IA sugere cliente,
          matéria e contraparte automaticamente. Você pode transformar em caso depois.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center"
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm">
            Arraste arquivos aqui ou{" "}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              selecione do computador
            </button>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, TXT, imagens · até 20 MB cada · máx {MAX_FILES} arquivos
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Enviando…
            </p>
          )}
        </div>

        {attachmentsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando anexos…</p>
        ) : attachments.length === 0 ? null : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showList ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {attachments.length} documento{attachments.length === 1 ? "" : "s"} anexado{attachments.length === 1 ? "" : "s"} a esta proposta
            </button>
            {showList && (
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <AttachmentRow
                    key={att.id}
                    att={att}
                    busy={extractingId === att.id}
                    onExtract={() => runExtract(att.id)}
                    onApply={() => att.extracted_fields && onSuggestFields(att.extracted_fields)}
                    onRemove={() => removeAttachment(att.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentRow({
  att,
  busy,
  onExtract,
  onApply,
  onRemove,
}: {
  att: ProposalAttachment;
  busy: boolean;
  onExtract: () => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const statusBadge = () => {
    switch (att.extraction_status) {
      case "done":
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Extraído
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processando
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTriangle className="mr-1 h-3 w-3" /> Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <li className="rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{att.filename}</p>
          <p className="text-xs text-muted-foreground">
            {humanSize(att.file_size)}
            {att.file_type ? ` · ${att.file_type.split("/").pop()}` : ""}
          </p>
          {att.extraction_error && (
            <p className="mt-1 text-xs text-destructive">{att.extraction_error}</p>
          )}
          {att.extracted_fields && (
            <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
              {att.extracted_fields.client_name && (
                <span className="rounded bg-muted px-1.5 py-0.5">
                  Cliente: <strong>{att.extracted_fields.client_name}</strong>
                </span>
              )}
              {att.extracted_fields.counterparty_name && (
                <span className="rounded bg-muted px-1.5 py-0.5">
                  Contraparte: <strong>{att.extracted_fields.counterparty_name}</strong>
                </span>
              )}
              {att.extracted_fields.case_type && (
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {att.extracted_fields.case_type}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {statusBadge()}
          <div className="flex gap-1">
            {att.extraction_status === "done" ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onApply}>
                <Sparkles className="mr-1 h-3 w-3" /> Aplicar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onExtract}
                disabled={busy || att.extraction_status === "processing"}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                Extrair
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
