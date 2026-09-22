import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  createCase,
  type ExtractedCaseData,
} from "@/lib/cases.functions";
import { createUploadSignedUrl, discardUploadedObject } from "@/lib/documents.functions";
import {
  convertIntakeToCaseDocument,
  discardIntakeDocument,
  getIntakeDocument,
  registerIntakeDocument,
  reprocessIntakeDocument,
} from "@/lib/intake.functions";
import { validateDocumentUpload } from "@/lib/documents-limits";
import {
  DEFAULT_MAX_PART_PAGES,
  MAX_IN_BROWSER_SPLIT_BYTES,
  splitPdfStream,
  type SplitPdfPart,
} from "@/lib/documents/pdf-splitter";

export const Route = createFileRoute("/_authenticated/assistencias/lote")({
  head: () => ({
    meta: [
      { title: "Criar casos em lote | JurisMind" },
      {
        name: "description",
        content: "Envie documentos, revise os dados identificados e crie casos em lote no JurisMind.",
      },
      { property: "og:title", content: "Criar casos em lote | JurisMind" },
      {
        property: "og:description",
        content: "Envie documentos, revise os dados identificados e crie casos em lote no JurisMind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkUploadPage,
});

type Phase = "select" | "extracting" | "review" | "saving" | "done";

type ExtractStatus = "pending" | "uploading" | "extracting" | "ready" | "error";
type SaveStatus = "idle" | "creating" | "indexing" | "saved" | "error";

type Draft = {
  id: string;
  file: File;
  storagePath?: string;
  intakeId?: string;
  extractStatus: ExtractStatus;
  extractError?: string;
  saveStatus: SaveStatus;
  saveError?: string;
  caseId?: string;
  data: ExtractedCaseData;
  missing: string[];
  warnings: { field: string | null; message: string }[];
};

type UploadedSplitPart = Omit<SplitPdfPart, "blob"> & {
  storage_path: string;
  file_type: string;
  file_size: number;
  split_group_id: string;
};

const FIELD_LABELS: Record<string, string> = {
  client_name: "Cliente",
  case_number: "Número do processo",
  jurisdiction: "Vara/Jurisdição",
  case_type: "Tipo do caso",
  parties: "Partes",
  description: "Descrição",
};

const emptyExtracted = (filename: string): ExtractedCaseData => ({
  title: filename.replace(/\.[^.]+$/, ""),
  client_name: null,
  case_number: null,
  jurisdiction: null,
  case_type: null,
  parties: [],
  description: "",
});

function BulkUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("select");
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const createCaseFn = useServerFn(createCase);
  const signUploadFn = useServerFn(createUploadSignedUrl);
  const discardUploadFn = useServerFn(discardUploadedObject);
  const registerIntakeFn = useServerFn(registerIntakeDocument);
  const getIntakeFn = useServerFn(getIntakeDocument);
  const reprocessIntakeFn = useServerFn(reprocessIntakeDocument);
  const discardIntakeFn = useServerFn(discardIntakeDocument);
  const convertIntakeFn = useServerFn(convertIntakeToCaseDocument);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const patchData = (id: string, patch: Partial<ExtractedCaseData>) =>
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, data: { ...d.data, ...patch } } : d)),
    );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => {
      const check = validateDocumentUpload({ filename: file.name, file_size: file.size });
      if (!check.ok) toast.error(check.message);
      return check.ok;
    });
    const next: Draft[] = accepted.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      extractStatus: "pending",
      saveStatus: "idle",
      data: emptyExtracted(f.name),
      missing: [],
      warnings: [],
    }));
    setDrafts((prev) => [...prev, ...next]);
  };

  const uploadFile = async (blob: Blob, filename: string) => {
    const fileType = blob.type || "application/octet-stream";
    const { signedUrl, path } = await signUploadFn({
      data: { filename, file_type: fileType, file_size: blob.size },
    });
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": fileType },
      body: blob,
    });
    if (!response.ok) throw new Error(`O envio falhou (HTTP ${response.status}).`);
    return {
      storage_path: path,
      filename,
      file_type: fileType,
      file_size: blob.size,
    };
  };

  const waitForExtraction = async (id: string) => {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      const row = await getIntakeFn({ data: { id } });
      if (!row) throw new Error("O documento enviado não foi encontrado.");
      if (row.status === "ready" || row.status === "partial") return row;
      if (row.status === "error") {
        throw new Error(row.last_error_message || "Não foi possível ler este documento.");
      }
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
    throw new Error("A leitura continua no servidor. Tente novamente em alguns minutos.");
  };

  const extractDraft = async (d: Draft, reuseIntake = false) => {
    const uploadedPaths: string[] = [];
    let registered = reuseIntake && Boolean(d.intakeId);
    try {
      update(d.id, {
        extractStatus: reuseIntake ? "extracting" : "uploading",
        extractError: undefined,
      });

      let intakeId = d.intakeId;
      if (registered && intakeId) {
        await reprocessIntakeFn({ data: { id: intakeId, mode: "auto" } });
      } else {
        const isPdf = d.file.type === "application/pdf" || d.file.name.toLowerCase().endsWith(".pdf");
        const splitGroupId = crypto.randomUUID();
        const uploadedParts: UploadedSplitPart[] = [];
        const uploadPart = async (part: SplitPdfPart) => {
          const uploaded = await uploadFile(part.blob, part.filename);
          uploadedPaths.push(uploaded.storage_path);
          uploadedParts.push({
            ...uploaded,
            split_group_id: splitGroupId,
            pageCount: part.pageCount,
            partIndex: part.partIndex,
            partCount: part.partCount,
            pageOffset: part.pageOffset,
          });
        };

        if (isPdf && d.file.size <= MAX_IN_BROWSER_SPLIT_BYTES) {
          await splitPdfStream({
            file: d.file,
            maxPartPages: DEFAULT_MAX_PART_PAGES,
            onPart: uploadPart,
          });
        } else {
          await uploadPart({
            blob: d.file,
            filename: d.file.name,
            pageCount: 1,
            partIndex: 1,
            partCount: 1,
            pageOffset: 0,
          });
        }

        uploadedParts.sort((a, b) => a.partIndex - b.partIndex);
        const firstPart = uploadedParts[0];
        if (!firstPart) throw new Error("Nenhuma parte do arquivo foi enviada.");
        update(d.id, { storagePath: firstPart.storage_path, extractStatus: "extracting" });
        const intake = await registerIntakeFn({
          data: {
            storage_path: firstPart.storage_path,
            filename: d.file.name,
            file_type: firstPart.file_type,
            file_size: firstPart.file_size,
            original_file_size: d.file.size,
            ...(uploadedParts.length > 1
              ? {
                  parts: uploadedParts.map((part) => ({
                    storage_path: part.storage_path,
                    filename: part.filename,
                    file_type: part.file_type,
                    file_size: part.file_size,
                    split_group_id: part.split_group_id,
                    part_index: part.partIndex,
                    part_count: part.partCount,
                    page_offset: part.pageOffset,
                    page_count: part.pageCount,
                  })),
                }
              : {}),
          },
        });
        registered = true;
        intakeId = intake.id;
        update(d.id, { intakeId });
      }

      if (!intakeId) throw new Error("A leitura não pôde ser iniciada.");
      const row = await waitForExtraction(intakeId);
      update(d.id, {
        extractStatus: "ready",
        extractError: undefined,
        data: (row.extracted_data as unknown as ExtractedCaseData) ?? emptyExtracted(d.file.name),
        missing: row.missing_fields ?? [],
        warnings: row.warnings ?? [],
      });
    } catch (e) {
      console.error(e);
      if (!registered && uploadedPaths.length > 0) {
        await Promise.all(
          uploadedPaths.map((storagePath) =>
            discardUploadFn({ data: { storage_path: storagePath } }).catch(() => undefined),
          ),
        );
      }
      update(d.id, {
        extractStatus: "error",
        extractError: e instanceof Error ? e.message : "Falha ao extrair",
      });
    }
  };

  // Step 1: upload + extract all → review
  const extractAll = async () => {
    if (!drafts.length) return;
    setPhase("extracting");
    for (const d of drafts) {
      if (d.extractStatus !== "ready") await extractDraft(d, Boolean(d.intakeId));
    }
    setPhase("review");
  };

  const retryDraft = async (draft: Draft) => {
    const mustSplitAgain =
      draft.file.size <= MAX_IN_BROWSER_SPLIT_BYTES &&
      /invalid typed array length|memória segura|grande demais/i.test(draft.extractError ?? "");
    if (mustSplitAgain && draft.intakeId) {
      await discardIntakeFn({ data: { id: draft.intakeId } }).catch(() => undefined);
      update(draft.id, { intakeId: undefined, storagePath: undefined });
      await extractDraft({ ...draft, intakeId: undefined, storagePath: undefined }, false);
      return;
    }
    await extractDraft(draft, Boolean(draft.intakeId));
  };

  // Step 2: review → create + index
  const saveAll = async () => {
    const ready = drafts.filter(
      (d) => d.extractStatus === "ready" && d.saveStatus !== "saved",
    );
    if (!ready.length) return;
    setPhase("saving");

    for (const d of ready) {
      try {
        if (!d.data.title.trim()) {
          throw new Error("Título obrigatório");
        }
        update(d.id, { saveStatus: "creating", saveError: undefined });
        // eslint-disable-next-line no-await-in-loop
        const newCase = await createCaseFn({
          data: {
            title: d.data.title,
            description: d.data.description || null,
            client_name: d.data.client_name,
            case_number: d.data.case_number,
            jurisdiction: d.data.jurisdiction,
            case_type: d.data.case_type,
            parties: d.data.parties ?? [],
            status: "active",
          },
        });
        // eslint-disable-next-line no-await-in-loop
        if (!d.intakeId) throw new Error("A leitura do documento precisa ser concluída novamente.");
        update(d.id, { saveStatus: "indexing", caseId: newCase.id });
        await convertIntakeFn({ data: { id: d.intakeId, case_id: newCase.id } });
        update(d.id, { saveStatus: "saved" });
      } catch (e) {
        console.error(e);
        update(d.id, {
          saveStatus: "error",
          saveError: e instanceof Error ? e.message : "Falha ao salvar",
        });
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["cases"] });
    const ok = drafts.filter((d) => d.saveStatus === "saved").length;
    if (ok > 0) toast.success(`${ok} caso(s) criado(s)`);
    setPhase("done");
  };

  const remove = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  // ---------- UI ----------
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/assistencias">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload em lote</h1>
          <p className="mt-1 text-muted-foreground">
            Envie vários documentos, revise os dados extraídos e crie os casos.
          </p>
        </div>
      </div>

      <Stepper phase={phase} />

      {(phase === "select" || phase === "extracting") && (
        <>
          <Card
            className="border-dashed border-2 p-10 text-center cursor-pointer hover:bg-muted/40"
            onClick={() => phase === "select" && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (phase === "select") addFiles(e.dataTransfer.files);
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

          {drafts.length > 0 && (
            <Card className="divide-y">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(d.file.size / 1024).toFixed(0)} KB ·{" "}
                      {extractLabel(d.extractStatus)}
                      {d.extractError ? ` — ${d.extractError}` : ""}
                    </p>
                  </div>
                  <ExtractIcon status={d.extractStatus} />
                  {phase === "select" && (
                    <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={extractAll}
              disabled={phase !== "select" || drafts.length === 0}
            >
              {phase === "extracting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo
                  documentos...
                </>
              ) : (
                <>Extrair dados ({drafts.length})</>
              )}
            </Button>
          </div>
        </>
      )}

      {(phase === "review" || phase === "saving" || phase === "done") && (
        <>
          <div className="space-y-4">
            {drafts.map((d, idx) => (
              <DraftCard
                key={d.id}
                index={idx + 1}
                draft={d}
                disabled={phase !== "review"}
                onChange={(patch) => patchData(d.id, patch)}
                onRemove={() => remove(d.id)}
                onRetry={() => retryDraft(d)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPhase("select")}
              disabled={phase === "saving"}
            >
              Voltar
            </Button>
            <div className="flex gap-2">
              {phase === "done" && (
                <Button variant="outline" onClick={() => navigate({ to: "/assistencias" })}>
                  Ver todos os casos
                </Button>
              )}
              {phase !== "done" && (
                <Button
                  onClick={saveAll}
                  disabled={
                    phase === "saving" ||
                    !drafts.some(
                      (d) => d.extractStatus === "ready" && d.saveStatus !== "saved",
                    )
                  }
                >
                  {phase === "saving" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      Confirmar e criar{" "}
                      {
                        drafts.filter(
                          (d) =>
                            d.extractStatus === "ready" && d.saveStatus !== "saved",
                        ).length
                      }{" "}
                      caso(s)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({ phase }: { phase: Phase }) {
  const steps = [
    { key: "select", label: "1. Selecionar" },
    { key: "review", label: "2. Revisar" },
    { key: "done", label: "3. Concluído" },
  ];
  const activeIdx =
    phase === "select" || phase === "extracting"
      ? 0
      : phase === "review" || phase === "saving"
        ? 1
        : 2;
  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={
              i <= activeIdx
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-muted-foreground">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

function DraftCard({
  index,
  draft,
  disabled,
  onChange,
  onRemove,
  onRetry,
}: {
  index: number;
  draft: Draft;
  disabled: boolean;
  onChange: (patch: Partial<ExtractedCaseData>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { data } = draft;

  const updateParty = (i: number, patch: Partial<{ role: string; name: string }>) =>
    onChange({
      parties: data.parties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    });
  const addParty = () =>
    onChange({ parties: [...data.parties, { role: "", name: "" }] });
  const removeParty = (i: number) =>
    onChange({ parties: data.parties.filter((_, idx) => idx !== i) });

  const statusBadge =
    draft.saveStatus === "saved" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3 w-3" /> Criado
      </span>
    ) : draft.saveStatus === "error" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Erro
      </span>
    ) : draft.extractStatus === "error" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Falha na extração
      </span>
    ) : (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Pronto para revisar
      </span>
    );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase text-muted-foreground">
            Caso {index} · {draft.file.name}
          </p>
          <div className="mt-1">{statusBadge}</div>
          {draft.saveError && (
            <p className="mt-1 text-xs text-destructive">{draft.saveError}</p>
          )}
        </div>
        {!disabled && draft.saveStatus !== "saved" && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {(draft.missing.length > 0 || draft.warnings.length > 0) &&
        draft.extractStatus === "ready" && (
          <div className="mb-4 space-y-2">
            {draft.missing.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>Não identificado pelo JurisMind:</strong>{" "}
                {draft.missing
                  .map((f) => FIELD_LABELS[f] ?? f)
                  .join(", ")}
                . Preencha manualmente abaixo.
              </div>
            )}
            {draft.warnings.map((w, i) => (
              <div
                key={i}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                {w.field ? `${FIELD_LABELS[w.field] ?? w.field}: ` : ""}{w.message}
              </div>
            ))}
          </div>
        )}

      {draft.extractStatus === "error" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Não foi possível ler este documento.</p>
            {draft.extractError && (
              <p className="mt-1 text-sm text-destructive">{draft.extractError}</p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      ) : draft.extractStatus === "extracting" || draft.extractStatus === "uploading" ? (
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo documento novamente...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input
              value={data.title}
              disabled={disabled || draft.saveStatus === "saved"}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div>
            <Label>Cliente</Label>
            <Input
              value={data.client_name ?? ""}
              disabled={disabled || draft.saveStatus === "saved"}
              onChange={(e) => onChange({ client_name: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Número do processo</Label>
            <Input
              value={data.case_number ?? ""}
              disabled={disabled || draft.saveStatus === "saved"}
              onChange={(e) => onChange({ case_number: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Jurisdição / Vara</Label>
            <Input
              value={data.jurisdiction ?? ""}
              disabled={disabled || draft.saveStatus === "saved"}
              onChange={(e) => onChange({ jurisdiction: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Input
              value={data.case_type ?? ""}
              disabled={disabled || draft.saveStatus === "saved"}
              onChange={(e) => onChange({ case_type: e.target.value || null })}
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <Label>Partes</Label>
              {!disabled && draft.saveStatus !== "saved" && (
                <Button type="button" size="sm" variant="ghost" onClick={addParty}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar
                </Button>
              )}
            </div>
            {data.parties.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma parte identificada.</p>
            ) : (
              <div className="space-y-2">
                {data.parties.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Papel (autor, réu...)"
                      value={p.role}
                      disabled={disabled || draft.saveStatus === "saved"}
                      onChange={(e) => updateParty(i, { role: e.target.value })}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Nome"
                      value={p.name}
                      disabled={disabled || draft.saveStatus === "saved"}
                      onChange={(e) => updateParty(i, { name: e.target.value })}
                    />
                    {!disabled && draft.saveStatus !== "saved" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeParty(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              value={data.description}
              disabled={disabled || draft.saveStatus === "saved"}
              rows={3}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function extractLabel(s: ExtractStatus) {
  return {
    pending: "Aguardando",
    uploading: "Enviando...",
    extracting: "Lendo com JurisMind...",
    ready: "Pronto",
    error: "Erro",
  }[s];
}

function ExtractIcon({ status }: { status: ExtractStatus }) {
  if (status === "ready") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return null;
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
}
