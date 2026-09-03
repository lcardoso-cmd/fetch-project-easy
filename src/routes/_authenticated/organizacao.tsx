import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createOrganization,
  listMyOrganizations,
} from "@/lib/organization-onboarding.functions";

export const Route = createFileRoute("/_authenticated/organizacao")({
  component: OrganizationPage,
  head: () => ({
    meta: [
      { title: "Minha organização | JurisMind AI" },
      {
        name: "description",
        content:
          "Crie ou consulte a organização do seu escritório no JurisMind AI e acompanhe o período de avaliação.",
      },
      { property: "og:title", content: "Minha organização | JurisMind AI" },
      {
        property: "og:description",
        content:
          "Organização, papel do usuário e período de avaliação do escritório no JurisMind AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function OrganizationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOrganizations);
  const createFn = useServerFn(createOrganization);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");

  const orgs = useQuery({ queryKey: ["my-organizations"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          legal_name: legalName || undefined,
          tax_id: taxId || undefined,
        },
      }),
    onSuccess: async (res) => {
      toast.success(
        res.created ? "Organização criada com avaliação de 30 dias." : "Você já possui organização.",
      );
      await qc.invalidateQueries();
      void navigate({ to: "/comercial" });
    },
    onError: (err) =>
      toast.error("Não foi possível criar a organização", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const rows = orgs.data ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Minha organização"
        subtitle="A organização é o espaço de trabalho do escritório: casos, documentos, comercial e equipe pertencem a ela."
      />

      {orgs.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {orgs.isError && (
        <p className="text-sm text-destructive" role="alert">
          {(orgs.error as Error).message}
        </p>
      )}

      {!orgs.isLoading && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="text-base">{o.name}</CardTitle>
                {o.is_active && <Badge>Ativa</Badge>}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Seu papel: {o.role_label}</p>
                <p>Situação: {o.status === "trial" ? "Em avaliação" : o.status}</p>
                {o.status === "trial" && <p>Avaliação até {formatDate(o.trial_ends_at)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!orgs.isLoading && rows.length === 0 && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" aria-hidden />
              Criar organização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você será o owner e o período de avaliação de 30 dias começa agora.
            </p>
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome do escritório</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Cardoso Advogados"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-legal">Razão social (opcional)</Label>
              <Input
                id="org-legal"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-tax">CNPJ (opcional)</Label>
              <Input id="org-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={name.trim().length < 2 || create.isPending}
            >
              {create.isPending ? "Criando…" : "Criar organização"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
