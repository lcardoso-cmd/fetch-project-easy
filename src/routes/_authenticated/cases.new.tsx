import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import {
  ArrowLeft,
  UploadCloud,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  Users,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createCase,
  extractCaseDataFromDocument,
  attachDocumentToCase,
  type ExtractedCaseData,
} from "@/lib/cases.functions";
import { listTeamMembers, createTeamMember } from "@/lib/team.functions";
import { indexDocument } from "@/lib/rag.functions";

export const Route = createFileRoute("/_authenticated/cases/new")({
  component: NewCasePage,
});

type Party = { role: string; name: string };

type UploadedDoc = {
  storage_path: string;
  filename: string;
  file_type: string;
  file_size: number;
};

function NewCasePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const createCaseFn = useServerFn(createCase);
  const extractFn = useServerFn(extractCaseDataFromDocument);
  const attachFn = useServerFn(attachDocumentToCase);
  const indexFn = useServerFn(indexDocument);
  const listTeamFn = useServerFn(listTeamMembers);
  const createTeamFn = useServerFn(createTeamMember);

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => listTeamFn(),
  });

  // form state
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [caseType, setCaseType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [representedIdx, setRepresentedIdx] = useState<number | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // review state — exibido só quando houve extração via documento
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  // quick add team
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const addMemberMut = useMutation({
    mutationFn: () =>
      createTeamFn({ data: { name: newMemberName.trim(), role: newMemberRole.trim() } }),
    onSuccess: (m) => {
      toast.success("Membro adicionado");
      setNewMemberName("");
      setNewMemberRole("");
      setAddingMember(false);
      setSelectedMembers((prev) => [...prev, m.id]);
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao adicionar"),
  });

  const applyExtracted = (e: ExtractedCaseData) => {
    setTitle(e.title);
    setClientName(e.client_name ?? "");
    setCaseNumber(e.case_number ?? "");
    setJurisdiction(e.jurisdiction ?? "");
    setCaseType(e.case_type ?? "");
    setDescription(e.description ?? "");
    setParties(e.parties ?? []);
    setRepresentedIdx(null);
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setExtracting(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/_intake/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const meta: UploadedDoc = {
        storage_path: path,
        filename: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
      };
      setUploaded(meta);

      const res = await extractFn({ data: meta });
      applyExtracted(res.extracted);
      const FIELD_LABELS: Record<string, string> = {
        client_name: "cliente",
        case_number: "número do processo",
        jurisdiction: "vara/jurisdição",
        case_type: "tipo do caso",
        parties: "partes",
        description: "descrição",
      };
      const missingLabels = (res.missing ?? []).map((f) => FIELD_LABELS[f] ?? f);
      setMissingFields(missingLabels);
      setExtractionWarnings(res.warnings ?? []);
      setReviewConfirmed(false);
      if (missingLabels.length) {
        toast.warning("Alguns dados não foram identificados", {
          description: `Preencha manualmente: ${missingLabels.join(", ")}.`,
        });
      } else {
        toast.success("Dados extraídos do documento");
      }
      (res.warnings ?? []).forEach((w) => toast.warning(w));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha: ${msg}`);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUpload = async () => {
    if (uploaded) {
      await supabase.storage.from("documents").remove([uploaded.storage_path]).catch(() => {});
    }
    setUploaded(null);
    setMissingFields([]);
    setExtractionWarnings([]);
    setReviewConfirmed(false);
  };

  const addParty = () => setParties([...parties, { role: "", name: "" }]);
  const updateParty = (i: number, patch: Partial<Party>) =>
    setParties(parties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeParty = (i: number) => {
    setParties(parties.filter((_, idx) => idx !== i));
    if (representedIdx === i) setRepresentedIdx(null);
    else if (representedIdx !== null && representedIdx > i)
      setRepresentedIdx(representedIdx - 1);
  };

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Sempre que veio de um documento, exigimos revisão+confirmação explícita,
  // independentemente de haver warnings ou campos faltantes.
  const needsReview = !!uploaded;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe um título para o caso");
      return;
    }
    if (needsReview && !reviewConfirmed) {
      toast.error("Revise os dados extraídos e confirme antes de criar o caso");
      return;
    }
    setSubmitting(true);
    try {
      const cleanParties = parties.filter((p) => p.name.trim() || p.role.trim());
      const represented =
        representedIdx !== null && cleanParties[representedIdx]
          ? cleanParties[representedIdx]
          : null;

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
          team_member_ids: selectedMembers,
          status: "active",
        },
      });

      if (uploaded) {
        try {
          const att = await attachFn({ data: { ...uploaded, case_id: newCase.id } });
          indexFn({ data: { document_id: att.document_id } }).catch(() => {});
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Caso criado, mas falhou ao anexar documento: ${msg}`);
        }
      }

      await qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Caso criado");
      navigate({ to: "/cases/$caseId", params: { caseId: newCase.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao criar caso: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/cases">
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
              <Sparkles className="h-5 w-5 text-accent" /> Importar documento (opcional)
            </CardTitle>
            <CardDescription>
              Envie a petição, contrato ou processo. A IA lê e preenche os campos abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploaded ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{uploaded.filename}</span>
                  {extracting ? (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Extraindo...
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Anexado
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeUpload}
                  disabled={extracting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f && !extracting) handleFile(f);
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-sm font-medium">Lendo documento e extraindo dados...</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Arraste o documento aqui</p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX, TXT — até 20 MB</p>
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
                  accept=".pdf,.txt,.md,.docx,application/pdf,text/plain"
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
        {uploaded && !extracting && (
          <Card className="border-accent/40 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-accent">
                <AlertTriangle className="h-5 w-5" /> Revisar dados extraídos
              </CardTitle>
              <CardDescription>
                A IA preencheu os campos do formulário abaixo a partir do documento.
                <strong> Qualquer alteração que você fizer nos campos será salva
                no caso</strong> — eles não são apenas visualização. Marque a
                confirmação quando estiver satisfeito.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingFields.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 dark:bg-amber-950/10">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Campos não identificados — preencha manualmente:
                  </p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {missingFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {extractionWarnings.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 dark:bg-amber-950/10">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Avisos da extração:
                  </p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {extractionWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
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
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Input
                id="client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case_number">Número do processo</Label>
              <Input
                id="case_number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Vara / Tribunal</Label>
              <Input
                id="jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="Ex.: TJSP — 3ª Vara Cível"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case_type">Tipo</Label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger id="case_type">
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
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descrição / resumo</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Partes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partes envolvidas</CardTitle>
            <CardDescription>
              Marque a parte que você representa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {parties.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma parte ainda.</p>
            )}
            {parties.map((p, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_2fr_auto] gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setRepresentedIdx(representedIdx === i ? null : i)}
                  className={`flex h-9 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors ${
                    representedIdx === i
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-accent/50"
                  }`}
                  title="Marcar como parte representada"
                >
                  {representedIdx === i ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Represento
                    </>
                  ) : (
                    "Represento"
                  )}
                </button>
                <Input
                  placeholder="Papel (autor, réu, etc)"
                  value={p.role}
                  onChange={(e) => updateParty(i, { role: e.target.value })}
                  maxLength={80}
                />
                <Input
                  placeholder="Nome"
                  value={p.name}
                  onChange={(e) => updateParty(i, { name: e.target.value })}
                  maxLength={200}
                />
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
            ))}
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
              <p className="text-sm text-muted-foreground">
                Nenhum membro cadastrado. Adicione abaixo ou gerencie em{" "}
                <Link to="/settings" className="underline">Configurações</Link>.
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
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      {m.role && (
                        <p className="text-xs text-muted-foreground truncate">{m.role}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {addingMember ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Nome"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    maxLength={120}
                  />
                  <Input
                    placeholder="Cargo (opcional)"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addMemberMut.mutate()}
                    disabled={!newMemberName.trim() || addMemberMut.isPending}
                  >
                    {addMemberMut.isPending && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddingMember(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddingMember(true)}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar membro
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/cases">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={submitting || (needsReview && !reviewConfirmed)}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsReview ? "Confirmar e criar caso" : "Criar caso"}
          </Button>
        </div>
      </form>
    </div>
  );
}
