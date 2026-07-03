import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Handshake, Loader2, Copy, Download, FileText, Check, Trash2, History, Save, Cloud, CloudOff, Eraser, Settings2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { generateProposal } from "@/lib/generators.functions";
import { getCases } from "@/lib/cases.functions";
import { useProfile } from "@/hooks/use-profile";
import { RichTextEditor } from "@/components/chat/rich-text-editor";
import { z } from "zod";
import { ProposalVersionsDialog } from "@/components/proposal/proposal-versions-dialog";
import { ProposalAttachmentsPanel } from "@/components/proposal/proposal-attachments-panel";
import { ConvertToCasePopover } from "@/components/proposal/convert-to-case-popover";
import { WordPreview } from "@/components/proposal/word-preview";
import { ShareProposalDialog, type PdfShareSnapshot } from "@/components/proposal/share-proposal-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { listProposalAttachments, type ExtractedProposalFields } from "@/lib/proposal-attachments.functions";
import {
  getProposalDraft,
  upsertProposalDraft,
  createProposalVersion,
  deleteProposalDraft,
  deleteAllProposalVersions,
  type ProposalVersion,
} from "@/lib/proposal-drafts.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const LEGACY_DRAFT_KEY = "jurismind:proposal-draft:v1";
const DRAFT_DEBOUNCE_MS = 900;

function formatSavedAt(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return "agora mesmo";
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  const d = new Date(ts);
  return `às ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}


const proposalSchema = z.object({
  client_name: z.string().trim().min(2, "Informe o nome do cliente").max(200),
  matter: z.string().trim().min(10, "Descreva a matéria/caso (mín. 10 caracteres)").max(2000),
  scope: z.string().trim().min(10, "Descreva o escopo (mín. 10 caracteres)").max(2000),
  fees: z.string().trim().min(1, "Informe os honorários").max(200),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof proposalSchema>, string>>;

export const Route = createFileRoute("/_authenticated/propostas")({
  component: ProposalPage,
});

const NO_CASE = "__none__";

type FormState = {
  case_id: string;
  client_name: string;
  client_document: string;
  client_address: string;
  client_city_state: string;
  counterparty_name: string;
  counterparty_document: string;
  counterparty_address: string;
  counterparty_city_state: string;
  counterparty_lawyer: string;
  matter: string;
  scope: string;
  fees: string;
  success_fee: string;
  deadline: string;
  firm_name: string;
  firm_practice_areas: string;
  firm_address: string;
  firm_phone: string;
  firm_email: string;
  lawyer_name: string;
  lawyer_title: string;
  tone: "formal" | "consultivo" | "direto";
};

const EMPTY: FormState = {
  case_id: NO_CASE,
  client_name: "",
  client_document: "",
  client_address: "",
  client_city_state: "",
  counterparty_name: "",
  counterparty_document: "",
  counterparty_address: "",
  counterparty_city_state: "",
  counterparty_lawyer: "",
  matter: "",
  scope: "",
  fees: "",
  success_fee: "",
  deadline: "",
  firm_name: "",
  firm_practice_areas: "",
  firm_address: "",
  firm_phone: "",
  firm_email: "",
  lawyer_name: "",
  lawyer_title: "",
  tone: "formal",
};

function ProposalPage() {
  const gen = useServerFn(generateProposal);
  const getCasesFn = useServerFn(getCases);
  const getDraftFn = useServerFn(getProposalDraft);
  const upsertDraftFn = useServerFn(upsertProposalDraft);
  const createVersionFn = useServerFn(createProposalVersion);
  const deleteDraftFn = useServerFn(deleteProposalDraft);
  const deleteAllVersionsFn = useServerFn(deleteAllProposalVersions);
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listAttachmentsFn = useServerFn(listProposalAttachments);
  const casesQ = useQuery({
    queryKey: ["cases", "list-for-proposal"],
    queryFn: () => getCasesFn(),
    staleTime: 30_000,
  });

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  // PDF export settings — persistidos entre geração/download
  const [pdfFormat, setPdfFormat] = useState<"A4" | "Letter">("A4");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("portrait");
  // Margens em milímetros na UI (convertidas para pt no envio)
  const [pdfMargins, setPdfMargins] = useState({ top: 25, right: 25, bottom: 25, left: 25 });
  const [pdfSettingsOpen, setPdfSettingsOpen] = useState(false);
  const [pdfCoverEnabled, setPdfCoverEnabled] = useState(true);
  const [pdfWatermarkMode, setPdfWatermarkMode] = useState<"none" | "draft" | "version">("none");
  const [pdfWatermarkVersion, setPdfWatermarkVersion] = useState("1");
  const [shareOpen, setShareOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [, forceTick] = useState(0);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // Popover state para salvar versão com rótulo/descrição/fixar
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [versionPinned, setVersionPinned] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>("");

  const activeCaseId = form.case_id && form.case_id !== NO_CASE ? form.case_id : null;

  // Anexos de proposta (só para o rascunho corrente / caso vinculado)
  const attachmentsQ = useQuery({
    queryKey: ["proposal-attachments", activeCaseId ?? "none"],
    queryFn: () => listAttachmentsFn({ data: { case_id: activeCaseId } }),
  });
  const attachmentIds = (attachmentsQ.data ?? []).map((a) => a.id);

  /** Merge não-destrutivo: só preenche campos vazios. */
  const applyExtractedFields = (fields: ExtractedProposalFields) => {
    setForm((f) => ({
      ...f,
      client_name: f.client_name || fields.client_name || "",
      client_document: f.client_document || fields.client_document || "",
      client_city_state: f.client_city_state || fields.client_city_state || "",
      counterparty_name: f.counterparty_name || fields.counterparty_name || "",
      counterparty_document: f.counterparty_document || fields.counterparty_document || "",
      matter: f.matter || fields.matter || "",
      scope: f.scope || fields.scope || "",
    }));
  };


  // Hidratar: buscar draft do backend para o caso atual (ou "sem caso"). Migra localStorage legado.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        const d = await getDraftFn({ data: { case_id: activeCaseId } });
        if (cancelled) return;
        if (d?.form) {
          setForm((f) => ({ ...(d.form as FormState), case_id: f.case_id }));
          setOutput(typeof d.output === "string" ? d.output : "");
          const ts = new Date(d.updated_at).getTime();
          setSavedAt(ts);
          toast.success("Rascunho restaurado", { description: `Salvo ${formatSavedAt(ts)}.` });
        } else if (!activeCaseId && typeof window !== "undefined") {
          // Migração one-shot do localStorage
          try {
            const raw = window.localStorage.getItem(LEGACY_DRAFT_KEY);
            if (raw) {
              const legacy = JSON.parse(raw) as { form: FormState; output: string; savedAt: number };
              if (legacy?.form) {
                setForm(legacy.form);
                setOutput(legacy.output ?? "");
                setSavedAt(legacy.savedAt ?? Date.now());
                toast.info("Rascunho local migrado para a nuvem.");
              }
              window.localStorage.removeItem(LEGACY_DRAFT_KEY);
            }
          } catch {
            /* ignora */
          }
        }
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Falha ao carregar rascunho");
      } finally {
        if (!cancelled) {
          lastSerializedRef.current = "";
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCaseId]);

  // Autofill escritório/advogado a partir do profile do usuário — dados já cadastrados.
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      firm_name: f.firm_name || profile.full_name || "",
      firm_practice_areas:
        f.firm_practice_areas || profile.specialty || profile.practice_type || "",
      firm_phone: f.firm_phone || profile.phone || "",
      firm_email: f.firm_email || user?.email || "",
      lawyer_name: f.lawyer_name || profile.full_name || "",
      lawyer_title: f.lawyer_title || (profile.oab_number ? `OAB ${profile.oab_number}` : ""),
    }));
  }, [profile, user?.email]);

  // Autosave com debounce -> backend.
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify({ form, output });
    if (serialized === lastSerializedRef.current) return;
    setPending(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setPending(false);
      setSaving(true);
      try {
        await upsertDraftFn({
          data: { case_id: activeCaseId, form: form as unknown as Record<string, unknown>, output },
        });
        lastSerializedRef.current = serialized;
        setSavedAt(Date.now());
        setSyncError(null);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Falha ao salvar");
      } finally {
        setSaving(false);
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, output, hydrated, activeCaseId, upsertDraftFn]);

  // Confirmação ao sair quando há alterações não salvas (autosave pendente).
  const hasUnsavedChanges =
    hydrated &&
    (saving || pending ||
      JSON.stringify({ form, output }) !== lastSerializedRef.current);
  const { dialog: unsavedDialog } = useUnsavedChangesGuard({ when: hasUnsavedChanges });

  // Atualiza o rótulo "salvo há Xs" a cada 20s.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const discardDraft = async () => {
    setForm(EMPTY);
    setOutput("");
    setErrors({});
    setSavedAt(null);
    lastSerializedRef.current = "";
    try {
      await upsertDraftFn({
        data: { case_id: activeCaseId, form: EMPTY as unknown as Record<string, unknown>, output: "" },
      });
      toast.success("Rascunho descartado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao descartar");
    }
  };

  const [clearing, setClearing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const clearAll = async () => {
    setClearing(true);
    try {
      // Backend: apaga versões e rascunho para o escopo atual.
      await deleteAllVersionsFn({ data: { case_id: activeCaseId } });
      await deleteDraftFn({ data: { case_id: activeCaseId } });
      // Estado local
      setForm(EMPTY);
      setOutput("");
      setErrors({});
      setSavedAt(null);
      lastSerializedRef.current = "";
      // Rascunho legado no navegador
      if (typeof window !== "undefined") {
        try { window.localStorage.removeItem(LEGACY_DRAFT_KEY); } catch { /* ignora */ }
      }
      qc.invalidateQueries({ queryKey: ["proposal-versions", activeCaseId ?? "none"] });
      toast.success("Histórico e rascunho apagados");
      setClearOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao limpar");
    } finally {
      setClearing(false);
    }
  };

  const cases = casesQ.data ?? [];

  const onSelectCase = (id: string) => {
    if (id === NO_CASE) {
      setForm((f) => ({ ...f, case_id: NO_CASE }));
      return;
    }
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      case_id: id,
      client_name: c.client_name ?? f.client_name,
      matter: f.matter || c.summary || c.description || c.title || "",
      client_city_state: f.client_city_state || c.jurisdiction || "",
    }));
  };

  const clientSummary = useMemo(() => {
    const parts = [form.client_name, form.client_document, form.client_city_state].filter(Boolean);
    return parts.join(" · ");
  }, [form.client_name, form.client_document, form.client_city_state]);

  const previewHtml = useMemo(() => buildPreviewHtml(form), [form]);

  const persistVersion = async (input: {
    label: string;
    description?: string | null;
    pinned?: boolean;
    origin: "manual" | "auto-generate" | "auto-restore";
    form: FormState;
    output: string;
  }) => {
    await createVersionFn({
      data: {
        case_id: activeCaseId,
        label: input.label,
        description: input.description ?? null,
        pinned: input.pinned ?? false,
        origin: input.origin,
        form: input.form as unknown as Record<string, unknown>,
        output: input.output,
      },
    });
    qc.invalidateQueries({ queryKey: ["proposal-versions", activeCaseId ?? "none"] });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = proposalSchema.safeParse(form);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      toast.error("Preencha os campos obrigatórios antes de gerar a proposta.");
      return;
    }
    setErrors({});
    setLoading(true);
    setOutput("");
    try {
      const { case_id: _omit, ...payload } = form;
      const r = await gen({ data: payload });
      setOutput(r.content);
      try {
        await persistVersion({
          label: `Gerada — ${form.client_name || "Cliente"}`,
          origin: "auto-generate",
          form,
          output: r.content,
        });
      } catch (err) {
        console.warn("Falha ao criar snapshot", err);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const openSavePopover = () => {
    if (!output && !form.client_name && !form.matter) {
      toast.error("Nada para salvar ainda.");
      return;
    }
    const now = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    setVersionLabel(`Versão — ${form.client_name || "sem cliente"} (${now})`);
    setVersionDescription("");
    setVersionPinned(false);
    setSavePopoverOpen(true);
  };

  const confirmSaveVersion = async () => {
    setSavingVersion(true);
    try {
      await persistVersion({
        label: versionLabel.trim() || "Versão sem rótulo",
        description: versionDescription.trim() || null,
        pinned: versionPinned,
        origin: "manual",
        form,
        output,
      });
      toast.success("Versão salva na nuvem");
      setSavePopoverOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar versão");
    } finally {
      setSavingVersion(false);
    }
  };

  const restoreVersion = async (v: ProposalVersion) => {
    // Backup do estado atual antes de sobrescrever
    if (output || form.client_name || form.matter) {
      try {
        await persistVersion({
          label: `Backup antes de restaurar (${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })})`,
          origin: "auto-restore",
          form,
          output,
        });
      } catch {
        /* segue mesmo se backup falhar */
      }
    }
    setForm({ ...(v.form as FormState), case_id: form.case_id });
    setOutput(v.output);
    setErrors({});
    toast.success("Versão restaurada");
  };

  const copy = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blobHtml = new Blob([output], { type: "text/html" });
        const blobText = new Blob([output.replace(/<[^>]+>/g, "")], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }),
        ]);
      } else {
        await navigator.clipboard.writeText(output);
      }
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const download = async () => {
    try {
      const titulo = `Proposta - ${form.client_name || "Cliente"}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sess.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`;
      const res = await fetch("/api/tools/petition", {
        method: "POST",
        headers,
        body: JSON.stringify({ titulo, html: output }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${(form.client_name || "cliente").replace(/\s+/g, "-").toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao baixar");
    }
  };

  const downloadPdf = async () => {
    try {
      const titulo = `Proposta - ${form.client_name || "Cliente"}`;
      const filenameBase = `proposta-${(form.client_name || "cliente").replace(/\s+/g, "-").toLowerCase()}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sess.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`;
      // Converte mm -> pt (1 mm ≈ 2,8346 pt)
      const mmToPt = (mm: number) => Math.round(mm * 2.83464567);
      const res = await fetch("/api/tools/pdf", {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo,
          html: output,
          page: {
            format: pdfFormat,
            orientation: pdfOrientation,
            margins: {
              top: mmToPt(pdfMargins.top),
              right: mmToPt(pdfMargins.right),
              bottom: mmToPt(pdfMargins.bottom),
              left: mmToPt(pdfMargins.left),
            },
          },
          cover: pdfCoverEnabled
            ? {
                clientName: form.client_name,
                clientDocument: form.client_document,
                clientAddress: [form.client_address, form.client_city_state]
                  .filter(Boolean)
                  .join(" — "),
                matter: form.matter,
              }
            : null,
          watermark:
            pdfWatermarkMode === "draft"
              ? { text: "RASCUNHO", opacity: 0.12 }
              : pdfWatermarkMode === "version"
                ? { text: `VERSÃO ${pdfWatermarkVersion || "1"}`, opacity: 0.12 }
                : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PDF");
    }
  };

  const mmToPtNum = (mm: number) => Math.round(mm * 2.83464567);
  const shareSnapshot: PdfShareSnapshot | null = output
    ? {
        title: `Proposta - ${form.client_name || "Cliente"}`,
        clientName: form.client_name || null,
        html: output,
        page: {
          format: pdfFormat,
          orientation: pdfOrientation,
          margins: {
            top: mmToPtNum(pdfMargins.top),
            right: mmToPtNum(pdfMargins.right),
            bottom: mmToPtNum(pdfMargins.bottom),
            left: mmToPtNum(pdfMargins.left),
          },
        },
        cover: pdfCoverEnabled
          ? {
              clientName: form.client_name,
              clientDocument: form.client_document,
              clientAddress: [form.client_address, form.client_city_state]
                .filter(Boolean)
                .join(" — "),
              matter: form.matter,
            }
          : null,
        watermark:
          pdfWatermarkMode === "draft"
            ? { text: "RASCUNHO", opacity: 0.12 }
            : pdfWatermarkMode === "version"
              ? { text: `VERSÃO ${pdfWatermarkVersion || "1"}`, opacity: 0.12 }
              : null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold font-heading tracking-tight">Proposta Comercial</h1>
          <p className="mt-1 text-muted-foreground">
            Escolha um caso existente para preencher os dados do cliente automaticamente. Campos marcados com <span className="text-destructive">*</span> são obrigatórios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {saving ? (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando na nuvem…
            </span>
          ) : pending ? (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Alterações não salvas — autosave pendente
            </span>
          ) : syncError ? (
            <span
              role="alert"
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive"
            >
              <CloudOff className="h-3.5 w-3.5" /> Falha ao sincronizar
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
              <Cloud className="h-3.5 w-3.5" />
              <Check className="h-3.5 w-3.5" /> Rascunho salvo {formatSavedAt(savedAt)}
            </span>
          ) : (
            <span>Alterações são salvas automaticamente</span>
          )}
          {savedAt && (
            <Button size="sm" variant="ghost" onClick={discardDraft} className="h-7 px-2">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Descartar
            </Button>
          )}
          <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" onClick={openSavePopover} className="h-7 px-2">
                <Save className="mr-1 h-3.5 w-3.5" /> Salvar versão
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="v-label" className="text-xs">Rótulo</Label>
                <Input
                  id="v-label"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="Ex.: Envio ao cliente v1"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-desc" className="text-xs">Descrição (opcional)</Label>
                <Textarea
                  id="v-desc"
                  rows={2}
                  value={versionDescription}
                  onChange={(e) => setVersionDescription(e.target.value)}
                  placeholder="Anotações sobre esta versão…"
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={versionPinned}
                  onChange={(e) => setVersionPinned(e.target.checked)}
                />
                Fixar versão (não será removida pelo limite automático)
              </label>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSavePopoverOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={confirmSaveVersion} disabled={savingVersion}>
                  {savingVersion && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={() => setVersionsOpen(true)} className="h-7 px-2">
            <History className="mr-1 h-3.5 w-3.5" /> Histórico
          </Button>
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive hover:text-destructive">
                <Eraser className="mr-1 h-3.5 w-3.5" /> Limpar tudo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico e rascunho?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso apaga <strong>todas as versões salvas</strong> (inclusive fixadas) e o
                  rascunho atual {activeCaseId ? "deste caso" : "sem caso vinculado"}, além do
                  rascunho antigo guardado neste navegador. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    clearAll();
                  }}
                  disabled={clearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Apagar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ConvertToCasePopover
            disabled={!!activeCaseId}
            attachmentIds={attachmentIds}
            fromCaseId={activeCaseId}
            defaults={{
              title: form.matter || `Proposta — ${form.client_name || "Cliente"}`,
              client_name: form.client_name || "",
              description: form.scope || "",
              case_type: "",
              jurisdiction: "",
            }}
            onConverted={(newCaseId) => {
              setForm((f) => ({ ...f, case_id: newCaseId }));
            }}
          />
        </div>
      </div>

      <ProposalVersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        caseId={activeCaseId}
        currentForm={form as unknown as Record<string, string>}
        currentOutput={output}
        onRestore={restoreVersion}
      />

      <ProposalAttachmentsPanel
        caseId={activeCaseId}
        userId={user?.id}
        onSuggestFields={applyExtractedFields}
      />






      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Handshake className="h-5 w-5" /> Dados da proposta
            </CardTitle>
            <CardDescription>Campos com <span className="text-destructive">*</span> são obrigatórios.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caso / Cliente</p>
                <div>
                  <Label>Caso vinculado</Label>
                  <Select value={form.case_id} onValueChange={onSelectCase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem caso vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CASE}>Sem caso vinculado</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                          {c.client_name ? ` — ${c.client_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clientSummary && (
                    <p className="mt-2 text-xs text-muted-foreground">Cliente: {clientSummary}</p>
                  )}
                </div>
                <div>
                  <Label>Nome do cliente <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    aria-invalid={!!errors.client_name}
                    className={errors.client_name ? "border-destructive" : ""}
                  />
                  {errors.client_name && (
                    <p className="mt-1 text-xs text-destructive">{errors.client_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contraparte</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome / Razão social</Label>
                    <Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <Input value={form.counterparty_document} onChange={(e) => setForm({ ...form, counterparty_document: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={form.counterparty_address} onChange={(e) => setForm({ ...form, counterparty_address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade / Estado</Label>
                    <Input value={form.counterparty_city_state} onChange={(e) => setForm({ ...form, counterparty_city_state: e.target.value })} />
                  </div>
                  <div>
                    <Label>Advogado da contraparte</Label>
                    <Input placeholder="Nome + OAB" value={form.counterparty_lawyer} onChange={(e) => setForm({ ...form, counterparty_lawyer: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objeto</p>
                <div>
                  <Label>Matéria / Caso <span className="text-destructive">*</span></Label>
                  <Textarea
                    rows={3}
                    value={form.matter}
                    onChange={(e) => setForm({ ...form, matter: e.target.value })}
                    aria-invalid={!!errors.matter}
                    className={errors.matter ? "border-destructive" : ""}
                  />
                  {errors.matter && <p className="mt-1 text-xs text-destructive">{errors.matter}</p>}
                </div>
                <div>
                  <Label>Escopo <span className="text-destructive">*</span></Label>
                  <Textarea
                    rows={2}
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value })}
                    aria-invalid={!!errors.scope}
                    className={errors.scope ? "border-destructive" : ""}
                  />
                  {errors.scope && <p className="mt-1 text-xs text-destructive">{errors.scope}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Honorários e prazo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Honorários <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Ex.: R$ 1.200/hora"
                      value={form.fees}
                      onChange={(e) => setForm({ ...form, fees: e.target.value })}
                      aria-invalid={!!errors.fees}
                      className={errors.fees ? "border-destructive" : ""}
                    />
                    {errors.fees && <p className="mt-1 text-xs text-destructive">{errors.fees}</p>}
                  </div>
                  <div>
                    <Label>Honorários de êxito</Label>
                    <Input placeholder="Ex.: 20%" value={form.success_fee} onChange={(e) => setForm({ ...form, success_fee: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Prazo estimado</Label>
                  <Input placeholder="Ex.: 600 dias" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Os dados do escritório e advogado responsável são preenchidos automaticamente
                a partir do seu perfil.
              </p>


              <div>
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as FormState["tone"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="consultivo">Consultivo</SelectItem>
                    <SelectItem value="direto">Direto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : "Gerar proposta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading">Resultado</CardTitle>
              <CardDescription>Edite livremente antes de baixar.</CardDescription>
            </div>
            {output && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <Popover open={pdfSettingsOpen} onOpenChange={setPdfSettingsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Configurar página do PDF"
                    >
                      <Settings2 className="h-4 w-4 mr-1" />
                      {pdfFormat} · {pdfOrientation === "portrait" ? "Retrato" : "Paisagem"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 space-y-4">
                    <div>
                      <p className="text-sm font-medium">Configurações do PDF</p>
                      <p className="text-xs text-muted-foreground">
                        Ajuste tamanho, orientação e margens antes de baixar.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tamanho</Label>
                        <Select
                          value={pdfFormat}
                          onValueChange={(v) => setPdfFormat(v as "A4" | "Letter")}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                            <SelectItem value="Letter">Carta (216 × 279 mm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Orientação</Label>
                        <Select
                          value={pdfOrientation}
                          onValueChange={(v) =>
                            setPdfOrientation(v as "portrait" | "landscape")
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Retrato</SelectItem>
                            <SelectItem value="landscape">Paisagem</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Margens (mm)</Label>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-foreground underline"
                          onClick={() =>
                            setPdfMargins({ top: 25, right: 25, bottom: 25, left: 25 })
                          }
                        >
                          Redefinir
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(["top", "right", "bottom", "left"] as const).map((side) => (
                          <div key={side} className="space-y-1">
                            <Label className="text-[11px] capitalize text-muted-foreground">
                              {side === "top"
                                ? "Superior"
                                : side === "right"
                                  ? "Direita"
                                  : side === "bottom"
                                    ? "Inferior"
                                    : "Esquerda"}
                            </Label>
                            <Input
                              type="number"
                              min={5}
                              max={60}
                              step={1}
                              value={pdfMargins[side]}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setPdfMargins((prev) => ({
                                  ...prev,
                                  [side]: Number.isFinite(n)
                                    ? Math.max(5, Math.min(60, n))
                                    : prev[side],
                                }));
                              }}
                              className="h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="pdf-cover-toggle" className="text-xs">
                          Incluir capa com dados do cliente
                        </Label>
                        <input
                          id="pdf-cover-toggle"
                          type="checkbox"
                          checked={pdfCoverEnabled}
                          onChange={(e) => setPdfCoverEnabled(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Usa nome, documento, endereço e assunto do formulário.
                      </p>
                    </div>
                    <div className="space-y-2 border-t pt-3">
                      <Label className="text-xs">Marca d’água</Label>
                      <Select
                        value={pdfWatermarkMode}
                        onValueChange={(v) =>
                          setPdfWatermarkMode(v as "none" | "draft" | "version")
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="version">Versão…</SelectItem>
                        </SelectContent>
                      </Select>
                      {pdfWatermarkMode === "version" && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px] text-muted-foreground">Nº</Label>
                          <Input
                            value={pdfWatermarkVersion}
                            onChange={(e) => setPdfWatermarkVersion(e.target.value)}
                            className="h-8"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setPdfSettingsOpen(false);
                        void downloadPdf();
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" /> Confirmar e baixar PDF
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="outline" onClick={downloadPdf}>
                  <FileText className="h-4 w-4 mr-1" /> Baixar PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShareOpen(true)}
                  title="Compartilhar por link seguro (sem anexar arquivo)"
                >
                  <Link2 className="h-4 w-4 mr-1" /> Compartilhar link
                </Button>
                <Button size="sm" onClick={download}>
                  <Download className="h-4 w-4 mr-1" /> Baixar .docx
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="preview">Prévia Word</TabsTrigger>
                </TabsList>
                <TabsContent value="editor" className="mt-0">
                  <RichTextEditor
                    html={output}
                    onChange={setOutput}
                    minHeight={520}
                    contentClassName="word-doc max-w-none p-6 focus:outline-none"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <WordPreview
                    html={output}
                    title={`Proposta - ${form.client_name || "Cliente"}`}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Prévia em tempo real dos campos preenchidos — mesmo layout do .docx exportado. Clique em <strong>Gerar proposta</strong> para produzir a versão final com JurisMind.
                </p>
                <WordPreview
                  html={previewHtml}
                  title={`Proposta - ${form.client_name || "Cliente"}`}
                />
              </div>
            )}

          </CardContent>
        </Card>
      </div>
      {unsavedDialog}
    </div>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPreviewHtml(f: FormState): string {
  const p = (label: string, value: string) =>
    value ? `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>` : "";
  const section = (title: string, inner: string) =>
    inner.trim() ? `<h2>${esc(title)}</h2>${inner}` : "";

  const cliente = [
    f.client_name ? `<p><strong>${esc(f.client_name)}</strong></p>` : "",
    p("CPF/CNPJ", f.client_document),
    p("Endereço", f.client_address),
    p("Cidade/Estado", f.client_city_state),
  ].join("");

  const contraparte = [
    f.counterparty_name ? `<p><strong>${esc(f.counterparty_name)}</strong></p>` : "",
    p("CPF/CNPJ", f.counterparty_document),
    p("Endereço", f.counterparty_address),
    p("Cidade/Estado", f.counterparty_city_state),
    p("Advogado", f.counterparty_lawyer),
  ].join("");

  const objeto = [
    f.matter ? `<p>${esc(f.matter)}</p>` : "",
    f.scope ? `<h3>Escopo</h3><p>${esc(f.scope)}</p>` : "",
  ].join("");

  const honorarios = [
    p("Honorários", f.fees),
    p("Honorários de êxito", f.success_fee),
    p("Prazo estimado", f.deadline),
  ].join("");

  const escritorio = [
    f.firm_name ? `<p><strong>${esc(f.firm_name)}</strong></p>` : "",
    p("Áreas de atuação", f.firm_practice_areas),
    p("Endereço", f.firm_address),
    p("Telefone", f.firm_phone),
    p("E-mail", f.firm_email),
    f.lawyer_name ? `<p>${esc(f.lawyer_name)}${f.lawyer_title ? " — " + esc(f.lawyer_title) : ""}</p>` : "",
  ].join("");

  const body =
    section("Contratante", cliente) +
    section("Contraparte", contraparte) +
    section("Objeto", objeto) +
    section("Honorários e prazo", honorarios) +
    section("Escritório / Advogado responsável", escritorio);

  const empty = !body.trim();
  return `
    <h1 style="text-align:center">PROPOSTA DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS</h1>
    ${empty ? '<p style="color:var(--muted-foreground);text-align:center"><em>Preencha os campos ao lado para ver a prévia.</em></p>' : body}
  `;
}

