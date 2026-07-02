import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Microscope,
  Calculator,
  FileCheck2,
  FileSignature,
  Landmark,
  ShieldCheck,
  Briefcase,
  ArrowRight,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listB2bCatalog,
  listMyB2bRequests,
  B2B_REQUEST_STATUSES,
  B2B_REQUEST_STATUS_LABEL,
  type B2bRequestStatus,
} from "@/lib/b2b-services.functions";

const STATUS_FILTER_VALUES = ["todos", ...B2B_REQUEST_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.enum(STATUS_FILTER_VALUES), "todos").default("todos"),
});
type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/contratar-b2b/")({
  validateSearch: zodValidator(searchSchema),
  component: HireB2bIndex,
});

const ICONS: Record<string, LucideIcon> = {
  Microscope,
  Calculator,
  FileCheck2,
  FileSignature,
  Landmark,
  ShieldCheck,
  Briefcase,
};

const STATUS_COLOR: Record<B2bRequestStatus, string> = {
  novo: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_analise: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  proposta_enviada: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  aceita: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  recusada: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  cancelada: "bg-muted text-muted-foreground",
  concluido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function HireB2bIndex() {
  const catalogFn = useServerFn(listB2bCatalog);
  const mineFn = useServerFn(listMyB2bRequests);
  const { q, status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: catalog = [] } = useQuery({
    queryKey: ["b2b-catalog"],
    queryFn: () => catalogFn(),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["b2b-my-requests"],
    queryFn: () => mineFn(),
  });

  // Debounce local input into URL search param
  const [qLocal, setQLocal] = useState(q);
  useEffect(() => {
    setQLocal(q);
  }, [q]);
  useEffect(() => {
    if (qLocal === q) return;
    const t = setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, q: qLocal }),
        replace: true,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [qLocal, q, navigate]);

  const filtered = useMemo(() => {
    const nq = normalize(qLocal);
    return mine.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (nq && !normalize(r.title).includes(nq)) return false;
      return true;
    });
  }, [mine, qLocal, status]);

  const hasFilter = status !== "todos" || qLocal.trim() !== "";

  const clearFilters = () => {
    setQLocal("");
    navigate({
      search: (prev) => ({ ...prev, q: "", status: "todos" as const }),
      replace: true,
    });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3 max-w-3xl">
            <Badge variant="secondary" className="w-fit">B2B Consulting</Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Contrate assistência técnica especializada
            </h1>
            <p className="text-muted-foreground">
              Assessoria econômico-contábil, financeira e de engenharia para escritórios
              de advocacia. Peritos com atuação em arbitragens nacionais e internacionais,
              litígios complexos e contencioso administrativo.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Catálogo de serviços</h2>
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de trabalho para abrir uma solicitação.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((s) => {
            const Icon = ICONS[s.icon] ?? Briefcase;
            return (
              <Card key={s.slug} className="flex flex-col">
                <CardHeader className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  <Button asChild size="sm" className="w-full">
                    <Link
                      to="/contratar-b2b/solicitar"
                      search={{ service: s.slug }}
                    >
                      Solicitar orçamento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Minhas solicitações</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status das contratações que você abriu junto à B2B.
          </p>
        </div>

        {mine.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
                placeholder="Buscar por título…"
                className="pl-9"
                aria-label="Buscar solicitações por título"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    status: v as (typeof STATUS_FILTER_VALUES)[number],
                  }),
                  replace: true,
                })
              }
            >
              <SelectTrigger className="sm:w-56" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {B2B_REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {B2B_REQUEST_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="sm:w-auto"
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        )}

        {mine.length > 0 && (
          <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Exibindo {filtered.length} de {mine.length}{" "}
            {mine.length === 1 ? "solicitação" : "solicitações"}
          </div>
        )}

        {mine.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Você ainda não abriu solicitações. Escolha um serviço acima para começar.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
              <p>Nenhuma solicitação corresponde aos filtros aplicados.</p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
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
                        Aberta em{" "}
                        {format(parseISO(r.created_at), "dd 'de' MMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                    <Badge className={STATUS_COLOR[r.status]}>
                      {B2B_REQUEST_STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
