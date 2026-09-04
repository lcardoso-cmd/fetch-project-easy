import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  UploadCloud,
  Loader2,
  Trash2,
  Plus,
  Users,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { labelsForMatter, type MatterKind } from "@/lib/practice-labels";
import { PARTY_RELATIONS, representedRelationFor, guessRelation } from "@/lib/party-relations";
import { createCase, setCaseTeamAccess, type ExtractedCaseData } from "@/lib/cases.functions";
import {
  registerIntakeDocument,
  getIntakeDocument,
  reprocessIntakeDocument,
  discardIntakeDocument,
  convertIntakeToCaseDocument,
} from "@/lib/intake.functions";
import {
  INTAKE_STATUS_LABEL,
  INTAKE_STATUS_PROGRESS,
  isIntakeActive,
  type IntakeStatus,
} from "@/lib/intake/intake-core";
import {
  MAX_DOCUMENT_SIZE_LABEL,
  DOCUMENT_ACCEPT_ATTR,
  validateDocumentUpload,
} from "@/lib/documents-limits";
import { buildCaseTitle } from "@/lib/case-title";
import { listOrgMembers } from "@/lib/organization.functions";
import { createUploadSignedUrl } from "@/lib/documents.functions";
import { Progress } from "@/components/ui/progress";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  DEFAULT_MAX_PART_PAGES,
  splitPdfStream,
  type SplitPdfPart,
} from "@/lib/documents/pdf-splitter";

export const Route = createFileRoute("/_authenticated/assistencias/nova")({
  component: NewCasePage,
});

type Party = { role: string; name: string; relation?: string | null };

type UploadedDoc = {
  storage_path: string;
  filename: string;
  file_type: string;
  file_size: number;
};

type UploadedSplitPart = Omit<SplitPdfPart, "blob"> & {
  storage_path: string;
  file_type: string;
  file_size: number;
  split_group_id: string;
};

type FieldKey =
  | "title"
  | "client_name"
  | "case_number"
  | "jurisdiction"
  | "case_type"
  | "parties"
  | "description";

type ExtractionWarning = { field: string | null; message: string };

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  client_name: "cliente",
  case_number: "número do processo",
  jurisdiction: "vara/jurisdição",
  case_type: "tipo do caso",
  parties: "partes",
  description: "descrição",
};

const MISSING_FIELD_HINTS: Record<string, string> = {
  client_name: "Não identificamos o nome do cliente no documento.",
  case_number: "Nenhum número de processo (CNJ) foi encontrado.",
  jurisdiction: "A vara ou tribunal não foi identificado.",
  case_type: "O tipo do caso não foi identificado.",
  parties: "Nenhuma parte foi identificada — adicione abaixo.",
  description: "Não geramos uma descrição — escreva um resumo do caso.",
};

function NewCasePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const createCaseFn = useServerFn(createCase);
  const registerIntakeFn = useServerFn(registerIntakeDocument);
  const getIntakeFn = useServerFn(getIntakeDocument);
  const reprocessIntakeFn = useServerFn(reprocessIntakeDocument);
  const discardIntakeFn = useServerFn(discardIntakeDocument);
  const convertIntakeFn = useServerFn(convertIntakeToCaseDocument);
  const signUploadFn = useServerFn(createUploadSignedUrl);
  const listTeamFn = useServerFn(listOrgMembers);
  const setTeamAccessFn = useServerFn(setCaseTeamAccess);

  const { data: team = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => listTeamFn(),
  });

  // JurisMind é exclusivo para advogados/escritórios: todo registro é um caso
  // jurídico ("processo"). Não há mais seleção de tipo de atuação.
  const matterKind: MatterKind = "processo";
  const labels = labelsForMatter(matterKind);

  // form state
  const [title, setTitle] = useState("");
  // Rastreia se o título foi editado manualmente. Enquanto for "auto",
  // regeneramos automaticamente a partir das partes (assistida vs contrária,
  // requerida vs requerente, etc). Ao digitar, o usuário assume controle.
  const [titleAuto, setTitleAuto] = useState(true);
  const onTitleChange = (v: string) => {
    setTitle(v);
    setTitleAuto(false);
  };
  const [clientName, setClientName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [caseType, setCaseType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<
    "idle" | "splitting" | "uploading" | "extracting" | "done"
  >("idle");
  const [uploadPct, setUploadPct] = useState(0);
  // Registro persistente da leitura do documento (continua no servidor).
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeInfo, setIntakeInfo] = useState<{
    pages_total: number | null;
    pages_analyzed: number | null;
    failed_pages: number[];
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewOpen || !uploaded) return;
    let cancelled = false;
    let blobUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewUrl(null);

    (async () => {
      try {
        // Baixa via SDK (cookie de auth do storage) e cria blob URL same-origin
        // para evitar bloqueio do Chrome ao carregar PDFs cross-origin em iframe.
        const { data, error } = await supabase.storage
          .from("documents")
          .download(uploaded.storage_path);
        if (error || !data) throw error ?? new Error("download falhou");
        if (cancelled) return;
        blobUrl = URL.createObjectURL(data);
        setPreviewUrl(blobUrl);
      } catch {
        if (!cancelled) {
          toast.error("Não foi possível abrir o documento");
          setPreviewOpen(false);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [previewOpen, uploaded]);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  // review state — exibido só quando houve extração via documento.
  // Persistido em localStorage para sobreviver a reload da página.
  const REVIEW_STORAGE_KEY = user ? `jurismind:new-case-review:${user.id}` : null;
  // missingFields contém chaves brutas (ex.: "client_name") para podermos
  // destacar inputs e mostrar a mensagem amigável de MISSING_FIELD_HINTS.
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [extractionWarnings, setExtractionWarnings] = useState<ExtractionWarning[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [hydratedReview, setHydratedReview] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Bloqueia saída se o usuário já preencheu algo relevante e ainda não enviou.
  const novaDirty =
    !submitting &&
    !submitted &&
    (title.trim().length > 0 ||
      clientName.trim().length > 0 ||
      caseNumber.trim().length > 0 ||
      jurisdiction.trim().length > 0 ||
      caseType.trim().length > 0 ||
      description.trim().length > 0 ||
      parties.some((p) => (p.name ?? "").trim().length > 0) ||
      !!uploaded);
  const { dialog: unsavedDialog } = useUnsavedChangesGuard({ when: novaDirty });

  // Carrega estado salvo ao montar
  useEffect(() => {
    if (!REVIEW_STORAGE_KEY) return;
    try {
      const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          uploaded?: UploadedDoc | null;
          intakeId?: string | null;
          missingFields?: string[];
          extractionWarnings?: ExtractionWarning[];
          reviewConfirmed?: boolean;
        };
        if (s.uploaded) setUploaded(s.uploaded);
        if (s.intakeId) setIntakeId(s.intakeId);
        if (Array.isArray(s.missingFields)) setMissingFields(s.missingFields);
        if (Array.isArray(s.extractionWarnings)) {
          // Filtra entradas em formato antigo (string)
          setExtractionWarnings(
            s.extractionWarnings.filter(
              (w): w is ExtractionWarning =>
                !!w &&
                typeof w === "object" &&
                typeof (w as ExtractionWarning).message === "string",
            ),
          );
        }
        if (typeof s.reviewConfirmed === "boolean") setReviewConfirmed(s.reviewConfirmed);
      }
    } catch {
      // ignora estado corrompido
    } finally {
      setHydratedReview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [REVIEW_STORAGE_KEY]);

  // Persiste mudanças relevantes
  useEffect(() => {
    if (!REVIEW_STORAGE_KEY || !hydratedReview) return;
    try {
      if (
        !uploaded &&
        missingFields.length === 0 &&
        extractionWarnings.length === 0 &&
        !reviewConfirmed
      ) {
        localStorage.removeItem(REVIEW_STORAGE_KEY);
      } else {
        localStorage.setItem(
          REVIEW_STORAGE_KEY,
          JSON.stringify({
            uploaded,
            intakeId,
            missingFields,
            extractionWarnings,
            reviewConfirmed,
          }),
        );
      }
    } catch {
      // quota / indisponível — silencioso
    }
  }, [
    REVIEW_STORAGE_KEY,
    hydratedReview,
    uploaded,
    intakeId,
    missingFields,
    extractionWarnings,
    reviewConfirmed,
  ]);

  const applyExtracted = (e: ExtractedCaseData) => {
    // Título só é preenchido a partir do documento se o usuário ainda não
    // customizou nada — caso contrário respeitamos a edição manual.
    // A auto-geração final baseada nas partes é feita pelo useEffect abaixo.
    if (titleAuto && e.title) setTitle(e.title);
    setClientName((current) => current || e.client_name || "");
    setCaseNumber((current) => current || e.case_number || "");
    setJurisdiction((current) => current || e.jurisdiction || "");
    setCaseType((current) => current || e.case_type || "");
    setDescription((current) => current || e.description || "");
    setParties((current) =>
      current.length > 0
        ? current
        : (e.parties ?? []).map((p) => {
            const withRel = p as Party;
            return { ...withRel, relation: withRel.relation ?? guessRelation(p, matterKind) };
          }),
    );
  };

  // Auto-geração do título: quando o usuário identifica assistida/contrária
  // (ou requerida/requerente, dependendo da matéria), montamos o caption
  // "Parte A vs Parte B" — desde que o título ainda esteja em modo "auto".
  useEffect(() => {
    if (!titleAuto) return;
    const generated = buildCaseTitle(matterKind, parties);
    if (generated && generated !== title) {
      setTitle(generated);
    }
  }, [titleAuto, matterKind, parties, title]);

  // Aplica o resultado de uma análise concluída (ou parcial) na tela.
  const applyIntakeResult = (row: {
    status: string;
    extracted_data: Record<string, unknown> | null;
    missing_fields: string[];
    warnings: Array<{ field: string | null; message: string }>;
  }) => {
    if (row.extracted_data) {
      applyExtracted(row.extracted_data as unknown as ExtractedCaseData);
    }
    setMissingFields(row.missing_fields ?? []);
    setExtractionWarnings(row.warnings ?? []);
    setReviewConfirmed(false);
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    const check = validateDocumentUpload({ filename: file.name, file_size: file.size });
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setExtracting(true);
    setUploadPhase("splitting");
    setUploadPct(0);
    const uploadedPaths: string[] = [];
    let registered = false;
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const splitGroupId = crypto.randomUUID();
      const uploadedParts: UploadedSplitPart[] = [];
      const uploadPart = async (part: SplitPdfPart) => {
        setUploadPhase("uploading");
        const fileType = part.blob.type || (isPdf ? "application/pdf" : "application/octet-stream");
        const { signedUrl, path } = await signUploadFn({
          data: {
            filename: part.filename,
            file_type: fileType,
            file_size: part.blob.size,
          },
        });
        uploadedPaths.push(path);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signedUrl);
          xhr.setRequestHeader("Content-Type", fileType);
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const withinPart = event.loaded / event.total;
            setUploadPct(((part.partIndex - 1 + withinPart) / part.partCount) * 100);
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
          xhr.onerror = () => reject(new Error("Erro de rede durante upload"));
          xhr.send(part.blob);
        });
        uploadedParts.push({
          storage_path: path,
          filename: part.filename,
          file_type: fileType,
          file_size: part.blob.size,
          split_group_id: splitGroupId,
          pageCount: part.pageCount,
          partIndex: part.partIndex,
          partCount: part.partCount,
          pageOffset: part.pageOffset,
        });
      };

      if (isPdf) {
        await splitPdfStream({
          file,
          maxPartPages: DEFAULT_MAX_PART_PAGES,
          onPlan: ({ ranges }) => {
            if (ranges.length > 1) {
              toast.info(
                `PDF grande: envio seguro em ${ranges.length} partes. A análise começará pela primeira.`,
              );
            }
          },
          onPart: uploadPart,
        });
      } else {
        await uploadPart({
          blob: file,
          filename: file.name,
          pageCount: 1,
          partIndex: 1,
          partCount: 1,
          pageOffset: 0,
        });
      }

      uploadedParts.sort((a, b) => a.partIndex - b.partIndex);
      const firstPart = uploadedParts[0];
      if (!firstPart) throw new Error("Nenhuma parte do arquivo foi enviada.");
      setUploadPct(100);

      // 3. Registra o documento e coloca a análise na fila. A leitura continua
      //    no servidor mesmo se a página for fechada.
      setUploadPhase("extracting");
      const row = await registerIntakeFn({
        data: {
          storage_path: firstPart.storage_path,
          filename: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: firstPart.file_size,
          original_file_size: file.size,
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
      setUploaded({
        storage_path: firstPart.storage_path,
        filename: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
      });
      setIntakeId(row.id);
      setIntakeStatus(row.status as IntakeStatus);
      await qc.invalidateQueries({ queryKey: ["pending-intake-documents"] });
      toast.info("Documento recebido. Estamos lendo o conteúdo.");
    } catch (e) {
      if (!registered && uploadedPaths.length > 0) {
        await supabase.storage
          .from("documents")
          .remove(uploadedPaths)
          .catch(() => {});
      }
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha: ${msg}`);
      setUploadPhase("idle");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUpload = async () => {
    if (intakeId) {
      await discardIntakeFn({ data: { id: intakeId } }).catch(() => {});
    } else if (uploaded) {
      await supabase.storage
        .from("documents")
        .remove([uploaded.storage_path])
        .catch(() => {});
    }
    setUploaded(null);
    setIntakeId(null);
    setIntakeStatus(null);
    setIntakeError(null);
    setIntakeInfo(null);
    setMissingFields([]);
    setExtractionWarnings([]);
    setReviewConfirmed(false);
    setUploadPhase("idle");
    await qc.invalidateQueries({ queryKey: ["pending-intake-documents"] });
  };

  // Nova tentativa de leitura: normal ou forçando reconhecimento de imagem.
  const retryIntake = async (mode: "auto" | "ocr") => {
    if (!intakeId) return;
    try {
      const row = await reprocessIntakeFn({ data: { id: intakeId, mode } });
      setIntakeStatus(row.status as IntakeStatus);
      setIntakeError(null);
      setUploadPhase("extracting");
      await qc.invalidateQueries({ queryKey: ["pending-intake-documents"] });
      toast.info(
        mode === "ocr" ? "Relendo o documento como imagem." : "Nova tentativa de leitura iniciada.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // Acompanha a leitura em andamento. O trabalho roda no servidor; aqui só
  // consultamos o andamento e aplicamos o resultado quando ele fica pronto.
  useEffect(() => {
    if (!intakeId) return;
    if (intakeStatus && !isIntakeActive(intakeStatus)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const row = await getIntakeFn({ data: { id: intakeId } });
        if (cancelled) return;
        if (!row) {
          setUploaded(null);
          setIntakeId(null);
          setIntakeStatus(null);
          setUploadPhase("idle");
          if (REVIEW_STORAGE_KEY) localStorage.removeItem(REVIEW_STORAGE_KEY);
          return;
        }
        setIntakeStatus(row.status as IntakeStatus);
        setIntakeInfo({
          pages_total: row.pages_total,
          pages_analyzed: row.pages_analyzed,
          failed_pages: row.failed_pages ?? [],
        });
        if (row.extracted_data) applyIntakeResult(row);
        if (row.status === "ready" || row.status === "partial") {
          setIntakeError(null);
          setUploadPhase("done");
          const missing = row.missing_fields ?? [];
          if (missing.length > 0) {
            toast.warning("Alguns dados não foram identificados", {
              description: `Preencha manualmente: ${missing
                .map((f) => FIELD_LABELS[f] ?? f)
                .join(", ")}.`,
            });
          } else {
            toast.success("Dados extraídos do documento");
          }
          return;
        }
        if (row.status === "error") {
          setIntakeError(
            row.last_error_message ??
              "Não conseguimos ler este documento. Você pode tentar de novo ou preencher os dados manualmente.",
          );
          setUploadPhase("done");
          return;
        }
        timer = setTimeout(tick, 2500);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };

    timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeId, intakeStatus]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setSubmitted(true);
    try {
      if (intakeId) {
        await discardIntakeFn({ data: { id: intakeId } });
      } else if (uploaded) {
        await supabase.storage.from("documents").remove([uploaded.storage_path]);
      }
      if (REVIEW_STORAGE_KEY) localStorage.removeItem(REVIEW_STORAGE_KEY);
      await qc.invalidateQueries({ queryKey: ["pending-intake-documents"] });
      navigate({ to: "/assistencias" });
    } catch (error) {
      setSubmitted(false);
      setCancelling(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o cadastro.");
    }
  };

  const addParty = () => setParties([...parties, { role: "", name: "" }]);
  const updateParty = (i: number, patch: Partial<Party>) =>
    setParties(parties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeParty = (i: number) => {
    setParties(parties.filter((_, idx) => idx !== i));
  };

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Sempre que veio de um documento, exigimos revisão+confirmação explícita,
  // independentemente de haver warnings ou campos faltantes.
  const needsReview = !!uploaded;

  // Validação inline dos campos obrigatórios / formatos.
  // Retorna mapa { campo -> mensagem } apenas para campos inválidos.
  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Informe um título para o caso.";
    else if (title.trim().length < 3) errors.title = "O título precisa ter ao menos 3 caracteres.";

    if (!clientName.trim()) errors.client_name = `Informe ${labels.clientLabel.toLowerCase()}.`;

    if (caseNumber.trim()) {
      const digits = caseNumber.replace(/\D/g, "");
      if (digits.length !== 20) {
        errors.case_number =
          "Número CNJ inválido — deve conter 20 dígitos (formato NNNNNNN-DD.AAAA.J.TR.OOOO).";
      }
    }

    if (!caseType.trim()) errors.case_type = "Selecione o tipo do caso.";

    const cleanParties = parties.filter((p) => p.name.trim());
    if (cleanParties.length === 0) {
      errors.parties = "Adicione ao menos uma parte com nome preenchido.";
    } else {
      const repRel = representedRelationFor(matterKind);
      if (repRel) {
        const repCount = cleanParties.filter((p) => p.relation === repRel).length;
        const repLabel =
          PARTY_RELATIONS[matterKind].find((r) => r.value === repRel)?.label ?? "representante";
        if (repCount === 0) {
          errors.represented = `Marque uma das partes como "${repLabel}".`;
        } else if (repCount > 1) {
          errors.represented = `Marque apenas uma parte como "${repLabel}".`;
        }
      }
      const unclassified = cleanParties.filter((p) => !p.relation);
      if (unclassified.length > 0) {
        errors.parties = "Classifique a relação de cada parte (cliente, contrária, perito, etc).";
      }
    }

    return errors;
  };

  const errors = validate();
  const showError = (k: string) => (attemptedSubmit || touched[k]) && !!errors[k];
  const errorRing = (k: string) =>
    showError(k)
      ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive"
      : "";
  const ErrorMsg = ({ k }: { k: string }) =>
    showError(k) ? (
      <p className="text-xs text-destructive flex items-start gap-1">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        {errors[k]}
      </p>
    ) : null;

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de criar o caso.");
      return;
    }
    if (needsReview && !reviewConfirmed) {
      toast.error("Revise os dados extraídos e confirme antes de criar o caso");
      return;
    }
    setSubmitting(true);
    try {
      const cleanParties = parties.filter((p) => p.name.trim() || p.role.trim());
      const repRel = representedRelationFor(matterKind);
      const represented = repRel ? (cleanParties.find((p) => p.relation === repRel) ?? null) : null;
      const newCase = await createCaseFn({
        data: {
          title: title.trim(),
          client_name: clientName.trim() || null,
          case_number: caseNumber.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          case_type: caseType.trim() || null,
          description: description.trim() || null,
          parties: cleanParties,
          represented_party: represented,
          status: "active",
          matter_kind: "processo",
          practice_type: "advogado",
        },
      });

      if (selectedMembers.length > 0) {
        try {
          await setTeamAccessFn({
            data: { case_id: newCase.id, user_ids: selectedMembers },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Caso criado, mas falhou ao alocar a equipe: ${msg}`);
        }
      }

      if (intakeId) {
        try {
          // Reaproveita o arquivo já enviado: nada é baixado ou reenviado.
          // A leitura completa para consulta pela IA entra na fila do servidor.
          await convertIntakeFn({ data: { id: intakeId, case_id: newCase.id } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Caso criado, mas falhou ao anexar documento: ${msg}`);
        }
      }

      await qc.invalidateQueries({ queryKey: ["cases"] });
      if (REVIEW_STORAGE_KEY) {
        try {
          localStorage.removeItem(REVIEW_STORAGE_KEY);
        } catch {
          /* noop */
        }
      }
      toast.success("Caso criado");
      setSubmitted(true);
      navigate({ to: "/assistencias/$caseId", params: { caseId: newCase.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao criar caso: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Agrupa avisos por campo para renderizar embaixo dos inputs.
  const warningsByField = extractionWarnings.reduce<Record<string, string[]>>((acc, w) => {
    const key = w.field ?? "_global";
    (acc[key] ??= []).push(w.message);
    return acc;
  }, {});
  const missingSet = new Set(missingFields);

  const fieldHasIssue = (field: FieldKey) =>
    missingSet.has(field) || (warningsByField[field]?.length ?? 0) > 0;
  const fieldRing = (field: FieldKey) =>
    uploaded && fieldHasIssue(field)
      ? "border-amber-500 ring-1 ring-amber-500/40 focus-visible:ring-amber-500"
      : "";

  const FieldIssue = ({ field }: { field: FieldKey }) => {
    if (!uploaded) return null;
    const isMissing = missingSet.has(field);
    const fieldWarnings = warningsByField[field] ?? [];
    if (!isMissing && fieldWarnings.length === 0) return null;
    return (
      <div className="space-y-1">
        {isMissing && (
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {MISSING_FIELD_HINTS[field] ??
              "Não identificado pelo JurisMind — preencha manualmente."}
          </p>
        )}
        {fieldWarnings.map((m, i) => (
          <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {m}
          </p>
        ))}
      </div>
    );
  };

  // Lista consolidada para o painel de revisão (uma linha por campo).
  const reviewIssues: { field: FieldKey | "_global"; label: string; messages: string[] }[] = [];
  const FIELDS_ORDER: FieldKey[] = [
    "client_name",
    "case_number",
    "jurisdiction",
    "case_type",
    "parties",
    "description",
  ];
  for (const f of FIELDS_ORDER) {
    const msgs: string[] = [];
    if (missingSet.has(f)) {
      msgs.push(MISSING_FIELD_HINTS[f] ?? "Não identificado pelo JurisMind.");
    }
    msgs.push(...(warningsByField[f] ?? []));
    if (msgs.length) {
      reviewIssues.push({ field: f, label: FIELD_LABELS[f] ?? f, messages: msgs });
    }
  }
  const globalWarnings = warningsByField["_global"] ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/assistencias">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Novo caso</h1>
        <p className="mt-1 text-muted-foreground">
          Importe um documento para preencher automaticamente, ou preencha manualmente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Importar documento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <JurisMindMark size={20} context={JURISMIND_CONTEXT.inlineLight} /> Importar documento
              (opcional)
            </CardTitle>
            <CardDescription>
              Envie a petição, contrato ou processo. O JurisMind lê e preenche os campos abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploaded ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-2 min-w-0 text-left hover:text-accent transition-colors"
                    title="Clique para visualizar o documento"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium underline-offset-2 hover:underline">
                      {uploaded.filename}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {intakeStatus && isIntakeActive(intakeStatus) ? (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {INTAKE_STATUS_LABEL[intakeStatus]}
                      </Badge>
                    ) : intakeStatus === "error" ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Não foi possível ler
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Anexado
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeUpload}
                      disabled={extracting}
                      title="Remover documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {intakeStatus && isIntakeActive(intakeStatus) && (
                  <div className="space-y-1">
                    <Progress value={INTAKE_STATUS_PROGRESS[intakeStatus]} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      A leitura continua no servidor — você pode continuar preenchendo o formulário
                      enquanto isso.
                    </p>
                  </div>
                )}

                {intakeInfo?.pages_total ? (
                  <p className="text-sm text-muted-foreground">
                    {intakeInfo.pages_analyzed ?? 0} de {intakeInfo.pages_total} páginas analisadas
                    para preencher o formulário. O arquivo completo fica anexado ao caso.
                  </p>
                ) : null}

                {intakeError && (
                  <p className="text-sm text-destructive flex items-start gap-1">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    {intakeError}
                  </p>
                )}

                {intakeId && !(intakeStatus && isIntakeActive(intakeStatus)) && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => retryIntake("auto")}
                    >
                      Tentar ler de novo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => retryIntake("ocr")}
                    >
                      Ler como imagem (documento digitalizado)
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f && !extracting) handleFile(f);
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center"
              >
                {extracting ? (
                  <div className="w-full max-w-sm space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      <p className="text-sm font-medium">
                        {uploadPhase === "uploading"
                          ? `Enviando arquivo… ${Math.round(uploadPct)}%`
                          : uploadPhase === "splitting"
                            ? "Preparando o PDF em partes seguras…"
                            : "Lendo documento e extraindo dados…"}
                      </p>
                    </div>
                    <Progress
                      value={uploadPhase === "uploading" ? uploadPct : 100}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {uploadPhase === "uploading"
                        ? "Não feche esta janela até o upload terminar."
                        : uploadPhase === "splitting"
                          ? "O arquivo é dividido no seu navegador; nenhuma página é descartada."
                          : "Extração pode levar alguns segundos para documentos grandes."}
                    </p>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Arraste o documento aqui</p>
                      <p className="text-sm text-muted-foreground">
                        PDF, DOCX, XLSX, CSV, TXT ou imagem — até {MAX_DOCUMENT_SIZE_LABEL}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Selecionar arquivo
                    </Button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={DOCUMENT_ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Etapa de revisão — aparece sempre que há um documento extraído */}
        {uploaded && !extracting && !(intakeStatus && isIntakeActive(intakeStatus)) && (
          <Card className="border-accent/40 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-accent">
                <AlertTriangle className="h-5 w-5" /> Revisar dados extraídos
              </CardTitle>
              <CardDescription>
                O JurisMind preencheu os campos abaixo a partir do documento.
                <strong>
                  {" "}
                  Edite o que precisar — os valores que ficarem aqui serão salvos no caso.
                </strong>{" "}
                Os campos destacados em âmbar precisam da sua atenção.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewIssues.length === 0 && globalWarnings.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50/40 p-3 text-sm text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos os campos foram identificados. Revise e confirme abaixo.
                </div>
              ) : (
                <ul className="space-y-2">
                  {reviewIssues.map((issue) => (
                    <li
                      key={issue.field}
                      className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 dark:bg-amber-950/10"
                    >
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 capitalize">
                        {issue.label}
                      </p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                        {issue.messages.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {globalWarnings.map((m, i) => (
                    <li
                      key={`g-${i}`}
                      className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-sm text-muted-foreground dark:bg-amber-950/10"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex items-start gap-2 rounded-md border bg-background p-3 cursor-pointer">
                <Checkbox
                  id="confirm-review"
                  checked={reviewConfirmed}
                  onCheckedChange={(v) => setReviewConfirmed(v === true)}
                />
                <span className="text-sm">
                  Revisei os dados abaixo e confirmo que estão corretos para criar o caso.
                </span>
              </label>
            </CardContent>
          </Card>
        )}

        {/* Dados do caso — editáveis; o que estiver aqui é o que será salvo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {uploaded ? "Dados do caso — edite o que precisar" : "Dados do caso"}
            </CardTitle>
            {uploaded && (
              <CardDescription>
                Estes são os valores que serão enviados ao confirmar.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="title">Título *</Label>
                {!titleAuto && buildCaseTitle(matterKind, parties) ? (
                  <button
                    type="button"
                    onClick={() => setTitleAuto(true)}
                    className="text-xs text-accent hover:underline"
                  >
                    Regenerar a partir das partes
                  </button>
                ) : null}
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onBlur={() => markTouched("title")}
                required
                maxLength={200}
                aria-invalid={showError("title") || undefined}
                className={errorRing("title")}
                placeholder="Ex.: Parte representada vs Parte contrária (gerado a partir das partes)"
              />
              <p className="text-xs text-muted-foreground">
                {titleAuto
                  ? "O título é gerado automaticamente assim que você classificar a parte representada e a parte contrária."
                  : "Você está editando o título manualmente."}
              </p>
              <ErrorMsg k="title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">{labels.clientLabel} *</Label>
              <Input
                id="client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => markTouched("client_name")}
                maxLength={200}
                aria-invalid={showError("client_name") || undefined}
                className={`${fieldRing("client_name")} ${errorRing("client_name")}`.trim()}
              />
              <ErrorMsg k="client_name" />
              <FieldIssue field="client_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case_number">Número do processo</Label>
              <Input
                id="case_number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                onBlur={() => markTouched("case_number")}
                placeholder="0000000-00.0000.0.00.0000"
                maxLength={120}
                aria-invalid={showError("case_number") || undefined}
                className={`${fieldRing("case_number")} ${errorRing("case_number")}`.trim()}
              />
              <ErrorMsg k="case_number" />
              <FieldIssue field="case_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Vara / Tribunal</Label>
              <Input
                id="jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="Ex.: TJSP — 3ª Vara Cível"
                maxLength={200}
                className={fieldRing("jurisdiction")}
              />
              <FieldIssue field="jurisdiction" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case_type">Tipo *</Label>
              <Select
                value={caseType}
                onValueChange={(v) => {
                  setCaseType(v);
                  markTouched("case_type");
                }}
              >
                <SelectTrigger
                  id="case_type"
                  aria-invalid={showError("case_type") || undefined}
                  className={`${fieldRing("case_type")} ${errorRing("case_type")}`.trim()}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cível">Cível</SelectItem>
                  <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                  <SelectItem value="Família">Família</SelectItem>
                  <SelectItem value="Penal">Penal</SelectItem>
                  <SelectItem value="Tributário">Tributário</SelectItem>
                  <SelectItem value="Empresarial">Empresarial</SelectItem>
                  <SelectItem value="Consumidor">Consumidor</SelectItem>
                  <SelectItem value="Administrativo">Administrativo</SelectItem>
                  <SelectItem value="Contencioso">Contencioso</SelectItem>
                  <SelectItem value="Consultivo">Consultivo</SelectItem>
                  <SelectItem value="Arbitragem">Arbitragem</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <ErrorMsg k="case_type" />
              <FieldIssue field="case_type" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descrição / resumo</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                className={fieldRing("description")}
              />
              <FieldIssue field="description" />
            </div>
          </CardContent>
        </Card>

        {/* Partes */}
        <Card
          className={
            showError("parties") || showError("represented")
              ? "border-destructive"
              : uploaded && fieldHasIssue("parties")
                ? "border-amber-500"
                : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-lg">Partes envolvidas *</CardTitle>
            <CardDescription>
              Adicione cada participante do processo e classifique a relação dele com o escritório
              (cliente, parte contrária, perito do juízo, assistente técnico, advogado adverso,
              etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldIssue field="parties" />
            <ErrorMsg k="parties" />
            <ErrorMsg k="represented" />
            {parties.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma parte ainda.</p>
            )}
            {parties.map((p, i) => {
              const rel = PARTY_RELATIONS[matterKind].find((r) => r.value === p.relation);
              const isRepresented = !!rel?.isRepresented;
              return (
                <div
                  key={i}
                  className={`grid grid-cols-1 md:grid-cols-[200px_180px_1fr_auto] gap-2 items-start rounded-md border p-2 ${
                    isRepresented ? "border-accent/60 bg-accent/5" : "border-border"
                  }`}
                >
                  <div className="space-y-1">
                    <Label className="text-2xs uppercase tracking-wide text-muted-foreground">
                      Relação com você
                    </Label>
                    <Select
                      value={p.relation ?? ""}
                      onValueChange={(v) => updateParty(i, { relation: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Classificar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTY_RELATIONS[matterKind].map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-2xs uppercase tracking-wide text-muted-foreground">
                      Papel processual
                    </Label>
                    <Input
                      placeholder="autor, réu, perito..."
                      value={p.role}
                      onChange={(e) => updateParty(i, { role: e.target.value })}
                      maxLength={80}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-2xs uppercase tracking-wide text-muted-foreground">
                      Nome
                    </Label>
                    <Input
                      placeholder="Nome completo / razão social"
                      value={p.name}
                      onChange={(e) => updateParty(i, { name: e.target.value })}
                      maxLength={200}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-end justify-end h-full pt-5 md:pt-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParty(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addParty}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar parte
            </Button>
          </CardContent>
        </Card>

        {/* Equipe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Equipe alocada
            </CardTitle>
            <CardDescription>
              Selecione os membros da sua equipe envolvidos neste caso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {team.length === 0 ? (
              <p className="text-ui text-muted-foreground">
                Nenhum integrante ativo além de você. Convide sua equipe em{" "}
                <Link to="/configuracoes/equipe" className="underline">
                  Equipe e permissões
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {team.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-ui font-medium truncate">{m.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{m.role_label}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Integrantes alocados passam a ver e editar este caso. Novos acessos são concedidos em{" "}
              <Link to="/configuracoes/equipe" className="underline">
                Equipe e permissões
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-end gap-2">
          {attemptedSubmit && hasErrors && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Existem campos obrigatórios pendentes — corrija os destaques em vermelho.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={cancelling || submitting}
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting || (needsReview && !reviewConfirmed) || (attemptedSubmit && hasErrors)
              }
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {needsReview ? "Confirmar e criar caso" : "Criar caso"}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="truncate pr-8">{uploaded?.filename ?? "Documento"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/30">
            {previewLoading || !previewUrl ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando documento...
              </div>
            ) : uploaded?.file_type?.startsWith("image/") ? (
              <div className="h-full overflow-auto flex items-start justify-center p-4">
                <img src={previewUrl} alt={uploaded.filename} className="max-w-full" />
              </div>
            ) : uploaded?.file_type === "application/pdf" ||
              uploaded?.filename.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={previewUrl}
                title={uploaded?.filename}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Pré-visualização não disponível para este formato.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    Abrir em nova aba
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {unsavedDialog}
    </div>
  );
}
