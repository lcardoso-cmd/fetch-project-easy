import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileSearch,
  Plus,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Archive,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  listTerms,
  upsertTerm,
  deleteTerm,
  listPublications,
  updatePublication,
  runFetchNow,
  listFetchLog,
} from "@/lib/publications.functions";

export const Route = createFileRoute("/_authenticated/publicacoes")({
  component: MonitoringPage,
});

type TermKind = "oab" | "advogado" | "parte" | "cnj";

const KIND_LABEL: Record<TermKind, string> = {
  oab: "OAB",
  advogado: "Advogado",
  parte: "Parte",
  cnj: "Processo (CNJ)",
};

function MonitoringPage() {
  const [tab, setTab] = useState<"feed" | "termos" | "log">("feed");
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Publicações</h1>
          <p className="mt-1 text-muted-foreground">
            Monitoramento diário do DJEN com fallback via Firecrawl. Vincula ao caso pelo CNJ e cria tarefa com prazo.
          </p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="termos">Termos monitorados</TabsTrigger>
          <TabsTrigger value="log">Log de captura</TabsTrigger>
        </TabsList>
        <TabsContent value="feed" className="mt-4">
          <FeedTab />
        </TabsContent>
        <TabsContent value="termos" className="mt-4">
          <TermsTab />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <LogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Feed ---------- */

function FeedTab() {
  const qc = useQueryClient();
  const list = useServerFn(listPublications);
  const update = useServerFn(updatePublication);
  const run = useServerFn(runFetchNow);
  const [status, setStatus] = useState<"new" | "read" | "archived" | "all">("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["publications", status, search],
    queryFn: () => list({ data: { status, search: search || undefined, limit: 50 } }),
  });

  const upd = useMutation({
    mutationFn: (v: { id: string; status: "new" | "read" | "archived" }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["publications"] }),
  });

  const run$ = useMutation({
    mutationFn: () => run({ data: {} }),
    onSuccess: (r) => {
      toast.success(`${r.totalCaptured} novas publicação(ões) capturada(s).`);
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar no conteúdo</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" placeholder="palavra-chave..." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="new">Novas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
              <SelectItem value="archived">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => run$.mutate()} disabled={run$.isPending} variant="secondary">
          {run$.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Buscar agora
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (q.data?.rows.length ?? 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileSearch className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhuma publicação. Cadastre termos e clique em "Buscar agora".
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {q.data?.rows.map((p) => (
            <Card key={p.id} className={p.status === "new" ? "border-primary/40" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{p.tribunal ?? "—"}</Badge>
                    <Badge variant="secondary">{p.source}</Badge>
                    {p.publication_date && <Badge variant="outline">{p.publication_date}</Badge>}
                    {p.cnj && <span className="text-xs font-mono text-muted-foreground">{p.cnj}</span>}
                    {p.status === "new" && <Badge>Nova</Badge>}
                    {p.task_id && <Badge variant="outline" className="text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Tarefa criada</Badge>}
                  </div>
                  <div className="flex gap-1">
                    {p.url_original && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={p.url_original} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    {p.status !== "read" && (
                      <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: p.id, status: "read" })}>Lida</Button>
                    )}
                    {p.status !== "archived" && (
                      <Button size="icon" variant="ghost" onClick={() => upd.mutate({ id: p.id, status: "archived" })}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/90">{p.snippet}</p>
                {p.orgao && <p className="text-xs text-muted-foreground mt-1">{p.orgao}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Termos ---------- */

function TermsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listTerms);
  const del = useServerFn(deleteTerm);
  const run = useServerFn(runFetchNow);

  const q = useQuery({ queryKey: ["monitoring_terms"], queryFn: () => list() });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring_terms"] }),
  });
  const runOne = useMutation({
    mutationFn: (id: string) => run({ data: { termIds: [id] } }),
    onSuccess: (r) => {
      toast.success(`${r.totalCaptured} publicação(ões) capturada(s).`);
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["monitoring_terms"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TermDialog onSaved={() => qc.invalidateQueries({ queryKey: ["monitoring_terms"] })}>
          <Button><Plus className="h-4 w-4" />Novo termo</Button>
        </TermDialog>
      </div>
      {q.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum termo cadastrado. Adicione OAB, advogado, parte ou CNJ para começar a monitorar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {q.data?.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{KIND_LABEL[t.kind as TermKind]}</Badge>
                    {!t.active && <Badge variant="outline">Inativo</Badge>}
                    {t.use_paid_fallback && <Badge variant="secondary">Fallback pago</Badge>}
                  </div>
                  <p className="font-medium">{t.label || t.value}</p>
                  <p className="text-xs text-muted-foreground">
                    Prazo tarefa: {t.deadline_days}d · Última execução: {t.last_run_at ? new Date(t.last_run_at).toLocaleString("pt-BR") : "nunca"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => runOne.mutate(t.id)} disabled={runOne.isPending}>
                    {runOne.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Buscar
                  </Button>
                  <TermDialog term={t} onSaved={() => qc.invalidateQueries({ queryKey: ["monitoring_terms"] })}>
                    <Button size="sm" variant="ghost">Editar</Button>
                  </TermDialog>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TermDialog({
  term,
  children,
  onSaved,
}: {
  term?: { id: string; kind: string; value: string; uf: string | null; label: string | null; case_id: string | null; active: boolean; use_paid_fallback: boolean; deadline_days: number };
  children: React.ReactNode;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertTerm);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TermKind>((term?.kind as TermKind) ?? "oab");
  const [value, setValue] = useState(term?.value ?? "");
  const [uf, setUf] = useState(term?.uf ?? "");
  const [label, setLabel] = useState(term?.label ?? "");
  const [active, setActive] = useState(term?.active ?? true);
  const [paid, setPaid] = useState(term?.use_paid_fallback ?? false);
  const [deadline, setDeadline] = useState(term?.deadline_days ?? 5);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: term?.id,
          kind,
          value: value.trim(),
          uf: kind === "oab" ? uf.toUpperCase().slice(0, 2) : null,
          label: label || null,
          active,
          use_paid_fallback: paid,
          deadline_days: Number(deadline),
        },
      }),
    onSuccess: () => {
      toast.success("Termo salvo");
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{term ? "Editar termo" : "Novo termo"}</DialogTitle>
          <DialogDescription>DJEN cobre a maior parte dos tribunais. Firecrawl atua como fallback textual.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as TermKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oab">OAB</SelectItem>
                <SelectItem value="advogado">Nome do advogado</SelectItem>
                <SelectItem value="parte">Nome da parte</SelectItem>
                <SelectItem value="cnj">Número CNJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div>
              <Label>{kind === "oab" ? "Número OAB" : "Valor"}</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "oab" ? "123456" : ""} />
            </div>
            {kind === "oab" && (
              <div>
                <Label>UF</Label>
                <Input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} placeholder="SP" />
              </div>
            )}
          </div>
          <div>
            <Label>Rótulo (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Dr. João" />
          </div>
          <div>
            <Label>Prazo da tarefa (dias)</Label>
            <Input type="number" min={0} max={60} value={deadline} onChange={(e) => setDeadline(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Fallback pago (Codilo)</Label>
              <p className="text-xs text-muted-foreground">Requer chave API. Só usa quando DJEN e Firecrawl não trouxerem nada.</p>
            </div>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !value.trim()}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Log ---------- */

function LogTab() {
  const list = useServerFn(listFetchLog);
  const q = useQuery({ queryKey: ["fetch_log"], queryFn: () => list({ data: { limit: 50 } }) });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">Últimas execuções</CardTitle>
        <CardDescription>Latência, resultados e custo por chamada.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução ainda.</p>
        ) : (
          <div className="space-y-1 font-mono text-xs">
            {q.data?.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-1 border-b">
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                <Badge variant={l.ok ? "secondary" : "destructive"}>{l.source}</Badge>
                <span>{l.http_status ?? "-"}</span>
                <span>{l.latency_ms}ms</span>
                <span>{l.results_count} res.</span>
                <span>${Number(l.cost_usd ?? 0).toFixed(4)}</span>
                {l.error && <span className="text-destructive truncate max-w-[300px]" title={l.error}>{l.error}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
