import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Settings2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCrmAccess, getCrmSettings } from "@/lib/crm.functions";
import { listOrgMembers } from "@/lib/organization.functions";
import { CrmOverviewPanel } from "@/components/crm/crm-overview-panel";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { OpportunitiesPanel } from "@/components/crm/opportunities-panel";
import { LeadsPanel } from "@/components/crm/leads-panel";
import { CrmProposalsPanel } from "@/components/crm/crm-proposals-panel";
import { ActivitiesPanel } from "@/components/crm/activities-panel";
import { OpportunityDetailSheet } from "@/components/crm/opportunity-detail-sheet";
import {
  OpportunityFormDialog,
  type OpportunityRow,
} from "@/components/crm/opportunity-form-dialog";
import { CrmSettingsDialog } from "@/components/crm/crm-settings-dialog";
import { useQueryClient } from "@tanstack/react-query";

export const VIEWS = [
  "visao-geral",
  "pipeline",
  "oportunidades",
  "clientes",
  "propostas",
  "atividades",
] as const;

const searchSchema = z.object({
  view: z.enum(VIEWS).optional(),
  opportunity: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/comercial")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CommercialPage,
  head: () => ({
    meta: [
      { title: "Comercial — CRM jurídico | JurisMind AI" },
      {
        name: "description",
        content:
          "Pipeline comercial, potenciais clientes, verificação de conflito, propostas e atividades do escritório em um só lugar.",
      },
      { property: "og:title", content: "Comercial — CRM jurídico | JurisMind AI" },
      {
        property: "og:description",
        content:
          "Do primeiro contato à conversão em caso, com rastreabilidade completa da negociação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CommercialPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accessFn = useServerFn(getCrmAccess);
  const settingsFn = useServerFn(getCrmSettings);
  const membersFn = useServerFn(listOrgMembers);

  const [oppForm, setOppForm] = useState<{ open: boolean; row: OpportunityRow | null }>({
    open: false,
    row: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const access = useQuery({ queryKey: ["crm-access"], queryFn: () => accessFn() });
  const settings = useQuery({
    queryKey: ["crm-settings"],
    queryFn: () => settingsFn(),
    enabled: !!access.data?.view,
  });
  const members = useQuery({
    queryKey: ["org-members"],
    queryFn: () => membersFn(),
    enabled: !!access.data?.view,
  });

  const view = search.view ?? "visao-geral";
  const detailId = search.opportunity ?? null;

  function setView(next: string) {
    void navigate({
      to: "/comercial",
      search: { view: next as (typeof VIEWS)[number], opportunity: search.opportunity },
    });
  }

  function openOpportunity(id: string) {
    void navigate({ to: "/comercial", search: { view, opportunity: id } });
  }

  function closeOpportunity() {
    void navigate({ to: "/comercial", search: { view } });
  }

  if (access.isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Carregando módulo comercial…</p>
      </div>
    );
  }

  if (access.isError) {
    const raw = (access.error as Error).message;
    const noOrg = raw.includes("NO_ORGANIZATION");
    return (
      <div className="p-6">
        <EmptyState
          icon={ShieldAlert}
          title={noOrg ? "Nenhuma organização ativa" : "Não foi possível abrir o módulo comercial"}
          description={
            noOrg
              ? "O módulo comercial pertence a uma organização. Crie ou selecione uma organização para começar a usar o CRM."
              : raw
          }
          action={
            noOrg ? (
              <Button onClick={() => void navigate({ to: "/organizacao" })}>
                Criar organização
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void access.refetch()}>
                Tentar novamente
              </Button>
            )
          }
        />
      </div>
    );
  }


  if (!access.data?.view) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ShieldAlert}
          title="Sem acesso ao módulo comercial"
          description="Solicite a permissão de CRM a um administrador da organização."
        />
      </div>
    );
  }

  const acc = access.data;
  const canWrite = acc.manageAll || acc.manageOwn;
  const settingsData = settings.data ?? {
    sources: [] as string[],
    practice_areas: [] as string[],
    loss_reasons: [] as string[],
    default_currency: "BRL",
    default_validity_days: 15,
    proposal_prefix: "PROP",
  };
  const memberList = members.data ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Comercial"
        subtitle="Do primeiro contato à conversão em caso, com histórico completo da negociação."
        actions={
          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <Button onClick={() => setOppForm({ open: true, row: null })}>
                Nova oportunidade
              </Button>
            )}
            {acc.admin && (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" /> Configurações
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="clientes">Potenciais clientes</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="pt-4">
          <CrmOverviewPanel access={acc} members={memberList} />
        </TabsContent>

        <TabsContent value="pipeline" className="pt-4">
          <PipelineBoard
            access={acc}
            members={memberList}
            lossReasons={settingsData.loss_reasons ?? []}
            onOpen={openOpportunity}
          />
        </TabsContent>

        <TabsContent value="oportunidades" className="pt-4">
          <OpportunitiesPanel
            access={acc}
            members={memberList}
            onOpen={openOpportunity}
            onEdit={(row) => setOppForm({ open: true, row })}
            onCreate={() => setOppForm({ open: true, row: null })}
          />
        </TabsContent>

        <TabsContent value="clientes" className="pt-4">
          <LeadsPanel
            members={memberList}
            sources={settingsData.sources ?? []}
            canWrite={canWrite}
          />
        </TabsContent>

        <TabsContent value="propostas" className="pt-4">
          <CrmProposalsPanel access={acc} />
        </TabsContent>

        <TabsContent value="atividades" className="pt-4">
          <ActivitiesPanel
            members={memberList}
            canWrite={canWrite}
            onOpenOpportunity={openOpportunity}
          />
        </TabsContent>
      </Tabs>

      <OpportunityDetailSheet
        opportunityId={detailId}
        onOpenChange={(open) => {
          if (!open) closeOpportunity();
        }}
        access={acc}
        members={memberList}
        onEdit={(id) => {
          void qc
            .getQueryData<{ opportunity: OpportunityRow }>(["crm-opportunity", id]);
          const cached = qc.getQueryData<{ opportunity: OpportunityRow }>([
            "crm-opportunity",
            id,
          ]);
          if (cached?.opportunity) setOppForm({ open: true, row: cached.opportunity });
        }}
      />

      <OpportunityFormDialog
        open={oppForm.open}
        onOpenChange={(open) => setOppForm((s) => ({ ...s, open }))}
        opportunity={oppForm.row}
        members={memberList}
        settings={{
          sources: settingsData.sources ?? [],
          practice_areas: settingsData.practice_areas ?? [],
          default_currency: settingsData.default_currency ?? "BRL",
        }}
        canSeeValues={acc.viewValues}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
          void qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
          void qc.invalidateQueries({ queryKey: ["crm-overview"] });
          if (detailId) {
            void qc.invalidateQueries({ queryKey: ["crm-opportunity", detailId] });
          }
        }}
      />

      <CrmSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settingsData}
      />
    </div>
  );
}
