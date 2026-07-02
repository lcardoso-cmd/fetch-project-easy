import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDocumentAuditEvents } from "@/lib/documents.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Upload,
  Download,
  RefreshCw,
  XCircle,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";

type Action =
  | "uploaded"
  | "imported"
  | "replaced"
  | "duplicate_ignored"
  | "discarded"
  | "deleted";

const ACTION_META: Record<
  Action,
  { label: string; icon: typeof Upload; className: string }
> = {
  uploaded: { label: "Enviado", icon: Upload, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  imported: { label: "Importado", icon: Download, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  replaced: { label: "Substituído", icon: RefreshCw, className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  duplicate_ignored: { label: "Duplicata ignorada", icon: Copy, className: "bg-muted text-muted-foreground" },
  discarded: { label: "Cancelado", icon: XCircle, className: "bg-muted text-muted-foreground" },
  deleted: { label: "Excluído", icon: Trash2, className: "bg-destructive/10 text-destructive" },
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function DocumentAuditDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Action>("all");
  const listFn = useServerFn(listDocumentAuditEvents);

  const query = useQuery({
    queryKey: ["document-audit", caseId],
    queryFn: () => listFn({ data: { case_id: caseId, limit: 200 } }),
    enabled: open,
  });

  const events = useMemo(() => {
    const all = query.data ?? [];
    return filter === "all" ? all : all.filter((e) => e.action === filter);
  }, [query.data, filter]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" /> Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de documentos</DialogTitle>
          <DialogDescription>
            Registros de importações, substituições, cancelamentos e exclusões
            deste caso, com data, responsável e motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {(Object.keys(ACTION_META) as Action[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_META[a].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {events.length} evento(s)
          </span>
        </div>

        <ScrollArea className="h-[420px] rounded-md border">
          {query.isLoading ? (
            <div className="flex h-full items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <ul className="divide-y">
              {events.map((e) => {
                const meta = ACTION_META[e.action] ?? ACTION_META.uploaded;
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="flex gap-3 p-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={meta.className}>
                          {meta.label}
                        </Badge>
                        <span className="truncate text-sm font-medium">
                          {e.filename ?? "(sem nome)"}
                        </span>
                      </div>
                      {e.reason && (
                        <p className="text-xs text-muted-foreground">
                          Motivo: {e.reason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(e.created_at)} ·{" "}
                        {e.user_name ?? "Usuário"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
