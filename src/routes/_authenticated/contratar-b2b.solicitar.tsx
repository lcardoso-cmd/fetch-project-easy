import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  listB2bCatalog,
  createB2bRequest,
  registerB2bAttachment,
} from "@/lib/b2b-services.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  service: z.string().optional(),
  case_id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/contratar-b2b/solicitar")({
  validateSearch: (s) => searchSchema.parse(s),
  component: HireB2bRequestForm,
});

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 8;

function HireB2bRequestForm() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const catalogFn = useServerFn(listB2bCatalog);
  const createFn = useServerFn(createB2bRequest);
  const registerAttFn = useServerFn(registerB2bAttachment);

  const { data: catalog = [] } = useQuery({
    queryKey: ["b2b-catalog"],
    queryFn: () => catalogFn(),
  });

  const draftKey = useMemo(
    () => `b2b-request-draft:${search.case_id ?? "no-case"}`,
    [search.case_id],
  );

  const savedDraft = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      if (!raw) return null;
      return JSON.parse(raw) as {
        serviceSlug?: string;
        title?: string;
        description?: string;
        urgency?: "normal" | "alta" | "critica";
        deadline?: string;
        email?: string;
        phone?: string;
      };
    } catch {
      return null;
    }
  }, [draftKey]);

  const [serviceSlug, setServiceSlug] = useState(
    savedDraft?.serviceSlug ?? search.service ?? "",
  );
  const [title, setTitle] = useState(savedDraft?.title ?? search.title ?? "");
  const [description, setDescription] = useState(
    savedDraft?.description ?? search.description ?? "",
  );
  const [urgency, setUrgency] = useState<"normal" | "alta" | "critica">(
    savedDraft?.urgency ?? "normal",
  );
  const [deadline, setDeadline] = useState(savedDraft?.deadline ?? "");
  const [email, setEmail] = useState(savedDraft?.email ?? user?.email ?? "");
  const [phone, setPhone] = useState(savedDraft?.phone ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => catalog.find((c) => c.slug === serviceSlug),
    [catalog, serviceSlug],
  );

  // Persist draft on any change (debounced via microtask via effect deps).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAny =
      serviceSlug || title || description || deadline || phone ||
      urgency !== "normal";
    try {
      if (hasAny) {
        window.sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            serviceSlug, title, description, urgency, deadline, email, phone,
          }),
        );
      } else {
        window.sessionStorage.removeItem(draftKey);
      }
    } catch {
      /* storage full/blocked — ignore */
    }
  }, [draftKey, serviceSlug, title, description, urgency, deadline, email, phone]);

  const noticeShown = useRef(false);
  useEffect(() => {
    if (noticeShown.current) return;
    if (!catalog.length) return;
    // Restored draft takes precedence over prefill notice.
    if (savedDraft && (savedDraft.description || savedDraft.title || savedDraft.serviceSlug)) {
      noticeShown.current = true;
      toast.info("Rascunho restaurado", {
        description:
          "Recuperamos os dados que você havia preenchido nesta solicitação. Arquivos anexados precisam ser selecionados novamente.",
      });
      return;
    }
    const hasPrefill = Boolean(search.service && search.description);
    if (!hasPrefill) return;
    const svc = catalog.find((c) => c.slug === search.service);
    noticeShown.current = true;
    toast.success("Solicitação pré-preenchida", {
      description: svc
        ? `Serviço "${svc.title}" e contexto do parecer já foram preenchidos. Ajuste os detalhes antes de enviar.`
        : "Serviço e contexto do parecer já foram preenchidos. Ajuste os detalhes antes de enviar.",
    });
  }, [catalog, search.service, search.description, savedDraft]);



  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) break;
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} excede 20 MB`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async () => {
    if (!serviceSlug) return toast.error("Escolha um serviço.");
    if (title.trim().length < 3) return toast.error("Descreva um título mais claro.");
    if (description.trim().length < 10)
      return toast.error("Descreva melhor a demanda (mín. 10 caracteres).");
    if (!email) return toast.error("Informe o e-mail de contato.");
    if (!user) return toast.error("Sessão expirada. Recarregue a página.");

    setSubmitting(true);
    try {
      const created = await createFn({
        data: {
          service_slug: serviceSlug,
          title: title.trim(),
          description: description.trim(),
          urgency,
          desired_deadline: deadline || null,
          contact_email: email,
          contact_phone: phone || null,
          case_id: search.case_id ?? null,
        },
      });

      // Sobe os anexos, se houver
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/b2b-requests/${created.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
          continue;
        }
        await registerAttFn({
          data: {
            request_id: created.id,
            file_name: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            visibility: "client",
          },
        });
      }

      toast.success("Solicitação enviada à B2B");
      navigate({ to: "/contratar-b2b/$requestId", params: { requestId: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/contratar-b2b" })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao catálogo
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Nova solicitação B2B</h1>
        <p className="text-sm text-muted-foreground">
          Descreva sua demanda. A equipe da B2B retorna com um plano de trabalho e
          proposta comercial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de serviço *</Label>
            <Select value={serviceSlug} onValueChange={setServiceSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedService && (
              <p className="text-xs text-muted-foreground">
                {selectedService.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Título curto *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Parecer contábil em ação de apuração de haveres"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição da demanda *</Label>
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto do caso, objeto do trabalho, quesitos ou pontos relevantes."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select
                value={urgency}
                onValueChange={(v) => setUrgency(v as typeof urgency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo desejado</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Até {MAX_FILES} arquivos, 20 MB cada. Petições, contratos, laudos ou
            planilhas que ajudem a equipe a dimensionar o trabalho.
          </p>
          <Input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
          {files.length > 0 && (
            <ul className="text-sm space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/contratar-b2b" })}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar solicitação"}
        </Button>
      </div>
    </div>
  );
}
