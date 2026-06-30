import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCases, createCase, deleteCase, createCaseFromDocument } from "@/lib/cases.functions";
import { indexDocument } from "@/lib/rag.functions";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, UploadCloud, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cases")({
  component: CasesPage,
});

function CasesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const getCasesFn = useServerFn(getCases);
  const createCaseFn = useServerFn(createCase);
  const deleteCaseFn = useServerFn(deleteCase);
  const createFromDocFn = useServerFn(createCaseFromDocument);
  const indexFn = useServerFn(indexDocument);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStage, setUploadStage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createCaseFn({ data: { title, client_name: clientName, description } });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      setTitle("");
      setClientName("");
      setDescription("");
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFromDoc = async (file: File) => {
    if (!user) return;
    setUploadBusy(true);
    try {
      setUploadStage("Enviando arquivo...");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/_intake/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      setUploadStage("Lendo documento e extraindo dados com IA...");
      const result = await createFromDocFn({
        data: {
          storage_path: path,
          filename: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
        },
      });

      toast.success("Caso criado a partir do documento!");
      // Indexar em background
      indexFn({ data: { document_id: result.document_id } }).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Indexação falhou: ${msg}`);
      });

      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      setIsOpen(false);
      navigate({ to: "/cases/$caseId", params: { caseId: result.case.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha: ${msg}`);
    } finally {
      setUploadBusy(false);
      setUploadStage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este caso?")) return;
    await deleteCaseFn({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Casos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie seus processos e clientes.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo caso
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Novo caso</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="document">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="document">
                  <Sparkles className="mr-2 h-4 w-4" /> A partir de documento
                </TabsTrigger>
                <TabsTrigger value="manual">Entrada manual</TabsTrigger>
              </TabsList>

              <TabsContent value="document" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Envie uma petição, contrato ou processo (PDF, DOCX, TXT). A IA vai ler e preencher os dados do caso automaticamente.
                </p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f && !uploadBusy) handleFromDoc(f);
                  }}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center"
                >
                  {uploadBusy ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-accent" />
                      <p className="text-sm font-medium">{uploadStage}</p>
                      <p className="text-xs text-muted-foreground">Isto pode levar alguns segundos</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Arraste o documento aqui</p>
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
                      if (f) handleFromDoc(f);
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="manual" className="pt-4">
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título do caso</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Cliente</Label>
                    <Input id="client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Criando..." : "Criar caso"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">Nenhum caso cadastrado ainda.</p>
          <Button className="mt-4" onClick={() => setIsOpen(true)}>
            Criar primeiro caso
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-heading text-lg">{caseItem.title}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(caseItem.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {caseItem.client_name && (
                  <CardDescription>Cliente: {caseItem.client_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {caseItem.description && (
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-3">{caseItem.description}</p>
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/cases/${caseItem.id}`}>Abrir caso</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
