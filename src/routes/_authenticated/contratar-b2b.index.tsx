import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  listB2bCatalog,
  listMyB2bRequests,
  B2B_REQUEST_STATUS_LABEL,
  type B2bRequestStatus,
} from "@/lib/b2b-services.functions";

export const Route = createFileRoute("/_authenticated/contratar-b2b/")({
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
};

function HireB2bIndex() {
  const catalogFn = useServerFn(listB2bCatalog);
  const mineFn = useServerFn(listMyB2bRequests);

  const { data: catalog = [] } = useQuery({
    queryKey: ["b2b-catalog"],
    queryFn: () => catalogFn(),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["b2b-my-requests"],
    queryFn: () => mineFn(),
  });

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

        {mine.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Você ainda não abriu solicitações. Escolha um serviço acima para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {mine.map((r) => (
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
