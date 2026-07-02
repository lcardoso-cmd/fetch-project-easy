import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyCapabilities } from "@/lib/capabilities.functions";
import {
  listAllB2bRequests,
  B2B_REQUEST_STATUSES,
  B2B_REQUEST_STATUS_LABEL,
  type B2bRequestStatus,
} from "@/lib/b2b-services.functions";

export const Route = createFileRoute("/_authenticated/plataforma/solicitacoes/")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) {
        throw new Error("no");
      }
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  component: PlatformRequests,
});

const STATUS_COLOR: Record<B2bRequestStatus, string> = {
  novo: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_analise: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  proposta_enviada: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  aceita: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  recusada: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  cancelada: "bg-muted text-muted-foreground",
};

function PlatformRequests() {
  const listFn = useServerFn(listAllB2bRequests);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<B2bRequestStatus | "all">("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["platform-b2b-requests", search, status],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          status: status === "all" ? undefined : status,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plataforma">
              <ArrowLeft className="mr-2 h-4 w-4" /> Plataforma
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Solicitações B2B</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de contratação enviados pelos escritórios clientes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {B2B_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {B2B_REQUEST_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.map((r) => (
            <Card key={r.id} className="hover:border-primary/50 transition-colors">
              <Link
                to="/contratar-b2b/$requestId"
                params={{ requestId: r.id }}
                className="block p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.service_slug} ·{" "}
                      {format(parseISO(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Urgência: {r.urgency}</Badge>
                    <Badge className={STATUS_COLOR[r.status]}>
                      {B2B_REQUEST_STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
