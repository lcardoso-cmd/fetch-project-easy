import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeProposalHtml } from "@/lib/sanitize-html";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  History,
  Trash2,
  RotateCcw,
  GitCompareArrows,
  Pin,
  PinOff,
  Pencil,
  Loader2,
  Search,
  X,
  CalendarIcon,
  Filter,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteProposalVersion,
  listProposalVersions,
  updateProposalVersion,
  type ProposalVersion,
} from "@/lib/proposal-drafts.functions";
import { diffForms, diffHtml } from "@/lib/proposal-diff";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string | null;
  currentForm: Record<string, string>;
  currentOutput: string;
  onRestore: (v: ProposalVersion) => void;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShort(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Extrai o nome do cliente do form de uma versão (formatos variados). */
function clientOf(v: ProposalVersion): string {
  const f = (v.form ?? {}) as Record<string, unknown>;
  const candidate =
    (f.client_name as string | undefined) ??
    (f.cliente_nome as string | undefined) ??
    (f.clientName as string | undefined) ??
    (f.cliente as string | undefined) ??
    "";
  return String(candidate || "").trim();
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ProposalVersionsDialog({
  open,
  onOpenChange,
  caseId,
  currentForm,
  currentOutput,
  onRestore,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposalVersions);
  const updateFn = useServerFn(updateProposalVersion);
  const deleteFn = useServerFn(deleteProposalVersion);

  const versionsKey = ["proposal-versions", caseId ?? "none"];

  const versionsQ = useQuery({
    queryKey: versionsKey,
    queryFn: () => listFn({ data: { case_id: caseId } }),
    enabled: open,
  });

  const allVersions = versionsQ.data ?? [];

  // ---------- Filtros ----------
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [origin, setOrigin] = useState<string>("all");
  const [client, setClient] = useState<string>("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "label">("newest");

  const clearFilters = () => {
    setSearch("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setOrigin("all");
    setClient("all");
    setPinnedOnly(false);
    setSortBy("newest");
  };

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date(Date.now() - days * 86_400_000);
    setDateFrom(from);
    setDateTo(to);
  };

  const uniqueClients = useMemo(() => {
    const set = new Map<string, string>(); // key normalized -> display
    for (const v of allVersions) {
      const name = clientOf(v);
      if (!name) continue;
      const key = norm(name);
      if (!set.has(key)) set.set(key, name);
    }
    return Array.from(set.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVersions]);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    const fromMs = dateFrom ? dateFrom.setHours(0, 0, 0, 0) : null;
    const toMs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : null;

    const list = allVersions.filter((v) => {
      if (pinnedOnly && !v.pinned) return false;
      if (origin !== "all" && v.origin !== origin) return false;
      if (client !== "all" && norm(clientOf(v)) !== client) return false;
      const created = new Date(v.created_at).getTime();
      if (fromMs !== null && created < fromMs) return false;
      if (toMs !== null && created > toMs) return false;
      if (q) {
        const hay = norm(
          [v.label, v.description ?? "", clientOf(v)].join(" "),
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "label") return a.label.localeCompare(b.label);
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortBy === "newest" ? db - da : da - db;
    });
    return list;
  }, [allVersions, search, dateFrom, dateTo, origin, client, pinnedOnly, sortBy]);

  const hasFilter =
    !!search || !!dateFrom || !!dateTo || origin !== "all" || client !== "all" || pinnedOnly;


  // ---------- Seleção ----------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    filtered.find((v) => v.id === selectedId) ?? filtered[0] ?? null;

  // Seleção múltipla (2 versões) para comparar A × B
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const versionA = compareIds[0]
    ? allVersions.find((v) => v.id === compareIds[0]) ?? null
    : null;
  const versionB = compareIds[1]
    ? allVersions.find((v) => v.id === compareIds[1]) ?? null
    : null;
  const canCompare = versionA && versionB;

  const [activeTab, setActiveTab] = useState<"preview" | "compare" | "compareAB">(
    "preview",
  );

  useEffect(() => {
    if (!open) {
      setCompareIds([]);
      setActiveTab("preview");
    }
  }, [open]);

  const toggleCompare = (id: string, checked: boolean) => {
    setCompareIds((prev) => {
      if (checked) {
        const next = [...prev.filter((x) => x !== id), id];
        // mantém no máximo 2, mais recentes primeiro (drop mais antigo)
        return next.slice(-2);
      }
      return prev.filter((x) => x !== id);
    });
  };

  useEffect(() => {
    if (canCompare) setActiveTab("compareAB");
  }, [canCompare]);

  // ---------- Edição inline ----------
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: versionsKey });

  const updateMut = useMutation({
    mutationFn: (input: { id: string; label?: string; description?: string | null; pinned?: boolean }) =>
      updateFn({ data: input }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      setCompareIds((p) => p.filter(Boolean));
      toast.success("Versão removida");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  const startEdit = (v: ProposalVersion) => {
    setEditing(v.id);
    setEditLabel(v.label);
    setEditDesc(v.description ?? "");
  };
  const saveEdit = async () => {
    if (!editing) return;
    await updateMut.mutateAsync({ id: editing, label: editLabel, description: editDesc || null });
    setEditing(null);
    toast.success("Versão atualizada");
  };

  const togglePin = (v: ProposalVersion) =>
    updateMut.mutate({ id: v.id, pinned: !v.pinned });

  const handleRestore = (v: ProposalVersion) => {
    onRestore(v);
    onOpenChange(false);
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const handleDownloadPdf = async (v: ProposalVersion) => {
    if (!v.output) {
      toast.error("Esta versão não tem conteúdo para exportar.");
      return;
    }
    setDownloadingId(v.id);
    try {
      const f = (v.form ?? {}) as Record<string, string>;
      const cliente = clientOf(v) || "cliente";
      const titulo = `Proposta - ${clientOf(v) || "Cliente"} (${v.label})`;
      const filename = `proposta-${cliente.replace(/\s+/g, "-").toLowerCase()}-${v.label.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sess.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`;
      const res = await fetch("/api/tools/pdf", {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo,
          html: v.output,
          cover: clientOf(v)
            ? {
                clientName: f.client_name || clientOf(v),
                clientDocument: f.client_document,
                clientAddress: [f.client_address, f.client_city_state].filter(Boolean).join(" — "),
                matter: f.matter,
              }
            : null,
          watermark: { text: `VERSÃO ${v.label}`, opacity: 0.1 },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  // ---------- Diffs ----------
  const formDiff = useMemo(
    () => (selected ? diffForms(selected.form as Record<string, string>, currentForm) : []),
    [selected, currentForm],
  );
  const textDiff = useMemo(
    () => (selected ? diffHtml(selected.output, currentOutput) : ""),
    [selected, currentOutput],
  );
  const abTextDiff = useMemo(
    () => (versionA && versionB ? diffHtml(versionA.output, versionB.output) : ""),
    [versionA, versionB],
  );
  const abFormDiff = useMemo(
    () =>
      versionA && versionB
        ? diffForms(
            versionA.form as Record<string, string>,
            versionB.form as Record<string, string>,
          )
        : [],
    [versionA, versionB],
  );

  // ---------- Scroll sincronizado ----------
  const scrollARef = useRef<HTMLDivElement>(null);
  const scrollBRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  useEffect(() => {
    const a = scrollARef.current;
    const b = scrollBRef.current;
    if (!a || !b) return;
    const onA = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      b.scrollTop = a.scrollTop;
      syncingRef.current = false;
    };
    const onB = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      a.scrollTop = b.scrollTop;
      syncingRef.current = false;
    };
    a.addEventListener("scroll", onA);
    b.addEventListener("scroll", onB);
    return () => {
      a.removeEventListener("scroll", onA);
      b.removeEventListener("scroll", onB);
    };
  }, [activeTab, versionA?.id, versionB?.id]);

  // ---------- Render ----------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <History className="h-5 w-5" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            {versionsQ.isLoading
              ? "Carregando…"
              : allVersions.length === 0
                ? "Nenhuma versão salva ainda. Gere uma proposta ou clique em ‘Salvar versão’."
                : hasFilter
                  ? `${filtered.length} de ${allVersions.length} versão(ões) — filtros ativos.`
                  : `${allVersions.length} versão(ões) salvas na nuvem.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[340px_1fr]" style={{ minHeight: "60vh" }}>
          {/* ---------- Coluna esquerda ---------- */}
          <div className="flex flex-col border-r">
            {/* Filtros */}
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente, rótulo, notas…"
                  className="h-9 pl-7 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                      {dateFrom || dateTo
                        ? `${dateFrom ? formatShort(dateFrom.toISOString()) : "…"} → ${dateTo ? formatShort(dateTo.toISOString()) : "…"}`
                        : "Datas"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex flex-wrap gap-1 pb-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(7)}>
                        7 dias
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(30)}>
                        30 dias
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(90)}>
                        90 dias
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setDateFrom(undefined);
                          setDateTo(undefined);
                        }}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">De</p>
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          className={cn("p-0 pointer-events-auto")}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Até</p>
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          className={cn("p-0 pointer-events-auto")}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger className="h-8 w-auto gap-1 text-xs">
                    <Filter className="h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas origens</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="auto-generate">Gerada</SelectItem>
                    <SelectItem value="auto-restore">Auto</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={client} onValueChange={setClient} disabled={uniqueClients.length === 0}>
                  <SelectTrigger
                    className="h-8 w-auto max-w-[180px] gap-1 text-xs"
                    title="Filtrar por cliente"
                  >
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {uniqueClients.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "oldest" | "label")}>
                  <SelectTrigger className="h-8 w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigas</SelectItem>
                    <SelectItem value="label">Rótulo A→Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch id="pinnedOnly" checked={pinnedOnly} onCheckedChange={setPinnedOnly} />
                  <Label htmlFor="pinnedOnly" className="text-xs">
                    Só fixadas
                  </Label>
                </div>
                {hasFilter && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearFilters}>
                    <X className="mr-1 h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>

              {compareIds.length > 0 && (
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
                  <span className="truncate">
                    <GitCompareArrows className="mr-1 inline h-3.5 w-3.5" />
                    Comparando {compareIds.length}/2
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setCompareIds([])}
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            <ScrollArea className="max-h-[60vh] flex-1">
              <ul className="divide-y">
                {filtered.map((v) => {
                  const active = selected?.id === v.id;
                  const inCompare = compareIds.includes(v.id);
                  const compareIndex = compareIds.indexOf(v.id);
                  return (
                    <li key={v.id}>
                      <div
                        className={cn(
                          "flex flex-col gap-1 p-3 transition-colors",
                          active ? "bg-muted" : "hover:bg-muted/60",
                          inCompare && "ring-1 ring-inset ring-primary/40",
                        )}
                      >
                        {editing === v.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder="Rótulo"
                            />
                            <Textarea
                              rows={2}
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Descrição (opcional)"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>
                                {updateMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={inCompare}
                              onCheckedChange={(c) => toggleCompare(v.id, c === true)}
                              aria-label="Selecionar para comparar"
                              className="mt-1"
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedId(v.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                {v.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                                <span className="truncate text-sm font-medium">{v.label}</span>
                                {inCompare && (
                                  <Badge className="ml-auto shrink-0 text-[10px]">
                                    {compareIndex === 0 ? "A" : "B"}
                                  </Badge>
                                )}
                                {!inCompare && (
                                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px] uppercase">
                                    {v.origin === "manual"
                                      ? "manual"
                                      : v.origin === "auto-generate"
                                        ? "gerada"
                                        : "auto"}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                              {clientOf(v) && (
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  Cliente: {clientOf(v)}
                                </p>
                              )}
                              {v.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.description}</p>
                              )}
                            </button>
                          </div>
                        )}
                        {editing !== v.id && (
                          <div className="mt-1 flex flex-wrap gap-1 pl-6">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => togglePin(v)}>
                              {v.pinned ? (
                                <>
                                  <PinOff className="mr-1 h-3 w-3" /> Desafixar
                                </>
                              ) : (
                                <>
                                  <Pin className="mr-1 h-3 w-3" /> Fixar
                                </>
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => startEdit(v)}>
                              <Pencil className="mr-1 h-3 w-3" /> Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleDownloadPdf(v)}
                              disabled={downloadingId === v.id || !v.output}
                              title="Baixar esta versão em PDF"
                            >
                              {downloadingId === v.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="mr-1 h-3 w-3" />
                              )}
                              PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {!versionsQ.isLoading && filtered.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    {allVersions.length === 0
                      ? "Sem versões."
                      : "Nenhuma versão corresponde aos filtros."}
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>

          {/* ---------- Coluna direita ---------- */}
          <div className="flex min-w-0 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(selected.created_at)}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => deleteMut.mutate(selected.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Excluir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPdf(selected)}
                      disabled={downloadingId === selected.id || !selected.output}
                    >
                      {downloadingId === selected.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-1 h-4 w-4" />
                      )}
                      Baixar PDF
                    </Button>
                    <Button size="sm" onClick={() => handleRestore(selected)}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Restaurar
                    </Button>
                  </div>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <TabsList className="mx-3 mt-3 w-fit">
                    <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
                    <TabsTrigger value="compare">
                      <GitCompareArrows className="mr-1 h-4 w-4" /> vs atual
                    </TabsTrigger>
                    <TabsTrigger value="compareAB" disabled={!canCompare}>
                      A × B
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="min-h-0 flex-1 p-3">
                    <ScrollArea className="h-[55vh] rounded-md border bg-background">
                      <div
                        className="proposal-preview p-6 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeProposalHtml(selected.output) || "<p><em>Sem conteúdo gerado nesta versão.</em></p>",
                        }}
                      />
                    </ScrollArea>

                  </TabsContent>

                  <TabsContent value="compare" className="min-h-0 flex-1 space-y-3 p-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Diff do texto (verde = adicionado, vermelho = removido)
                      </p>
                      <ScrollArea className="h-[35vh] rounded-md border bg-background">
                        <div
                          className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeProposalHtml(textDiff) || "<em class='text-muted-foreground'>Sem diferenças no texto.</em>",
                          }}
                        />
                      </ScrollArea>

                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Campos alterados
                      </p>
                      {formDiff.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum campo do formulário mudou.</p>
                      ) : (
                        <div className="rounded-md border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 text-left">
                              <tr>
                                <th className="p-2">Campo</th>
                                <th className="p-2">Versão</th>
                                <th className="p-2">Atual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formDiff.map((d) => (
                                <tr key={d.field} className="border-t align-top">
                                  <td className="p-2 font-mono text-[11px]">{d.field}</td>
                                  <td className="p-2 text-red-700">
                                    {d.from || <em className="text-muted-foreground">vazio</em>}
                                  </td>
                                  <td className="p-2 text-emerald-700">
                                    {d.to || <em className="text-muted-foreground">vazio</em>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Restaurar substitui o formulário e o texto atual. Um backup automático do estado atual será criado.
                    </p>
                  </TabsContent>

                  <TabsContent value="compareAB" className="min-h-0 flex-1 space-y-3 p-3">
                    {!canCompare ? (
                      <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                        Marque duas versões na lista (à esquerda) para comparar lado a lado.
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[versionA!, versionB!].map((v, idx) => (
                            <div key={v.id} className="flex min-h-0 flex-col rounded-md border bg-background">
                              <div className="flex items-center gap-2 border-b p-2">
                                <Badge className="text-[10px]">{idx === 0 ? "A" : "B"}</Badge>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold">{v.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{formatDate(v.created_at)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleRestore(v)}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Restaurar
                                </Button>
                              </div>
                              <div
                                ref={idx === 0 ? scrollARef : scrollBRef}
                                className="h-[40vh] overflow-y-auto"
                              >
                                <div
                                  className="proposal-preview p-4 text-sm leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeProposalHtml(v.output) || "<p><em>Sem conteúdo.</em></p>",
                                  }}
                                />
                              </div>

                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Diff A → B (verde = em B, vermelho = removido de A)
                          </p>
                          <ScrollArea className="h-[22vh] rounded-md border bg-background">
                            <div
                              className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{
                                __html:
                                  sanitizeProposalHtml(abTextDiff) ||
                                  "<em class='text-muted-foreground'>Textos idênticos.</em>",
                              }}
                            />
                          </ScrollArea>

                        </div>

                        {abFormDiff.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Campos alterados (A → B)
                            </p>
                            <div className="rounded-md border">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50 text-left">
                                  <tr>
                                    <th className="p-2">Campo</th>
                                    <th className="p-2">A</th>
                                    <th className="p-2">B</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {abFormDiff.map((d) => (
                                    <tr key={d.field} className="border-t align-top">
                                      <td className="p-2 font-mono text-[11px]">{d.field}</td>
                                      <td className="p-2 text-red-700">
                                        {d.from || <em className="text-muted-foreground">vazio</em>}
                                      </td>
                                      <td className="p-2 text-emerald-700">
                                        {d.to || <em className="text-muted-foreground">vazio</em>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                {versionsQ.isLoading ? "Carregando…" : "Selecione uma versão à esquerda."}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
