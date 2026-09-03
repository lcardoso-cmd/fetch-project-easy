/**
 * Fonte única da verdade das permissões de organização (escritório) e
 * dos papéis internos da B2B. Espelha os enums do banco
 * (`org_permission`, `org_role`, `platform_role`).
 *
 * IMPORTANTE: papéis da B2B NUNCA se misturam com papéis de organização.
 */

export const ORG_PERMISSIONS = [
  "members.view",
  "members.invite",
  "members.manage",
  "permissions.manage",
  "billing.view",
  "billing.manage",
  "subscription.manage",
  "services.view",
  "services.request",
  "services.contract",
  "integrations.view",
  "integrations.manage",
  "usage.view_self",
  "usage.view_organization",
  "usage.manage_budget",
  "cases.create",
  "cases.view_all",
  "cases.manage_all",
  "cases.delete",
  "documents.upload",
  "documents.delete",
  "ai.use",
  "proposals.use",
  "marketing.use",
  "publications.use",
  "crm.view",
  "crm.manage_own",
  "crm.view_all",
  "crm.manage_all",
  "crm.view_values",
  "crm.proposals_create",
  "crm.proposals_approve",
  "crm.proposals_share",
  "crm.record_outcome",
  "crm.convert",
  "crm.admin",
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

export const ORG_ROLES = [
  "owner",
  "admin",
  "manager",
  "lawyer",
  "collaborator",
  "viewer",
  "billing_manager",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const PLATFORM_ROLES = [
  "super_admin",
  "platform_admin",
  "platform_operations",
  "platform_finance",
  "platform_support",
  "platform_readonly",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Titular",
  admin: "Administrador",
  manager: "Gestor",
  lawyer: "Advogado",
  collaborator: "Colaborador",
  viewer: "Visualizador",
  billing_manager: "Responsável financeiro",
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super administrador B2B",
  platform_admin: "Administrador da plataforma",
  platform_operations: "Operações B2B",
  platform_finance: "Financeiro B2B",
  platform_support: "Suporte B2B",
  platform_readonly: "Somente leitura B2B",
};

export const ORG_PERMISSION_LABELS: Record<OrgPermission, string> = {
  "members.view": "Ver equipe",
  "members.invite": "Convidar membros",
  "members.manage": "Gerenciar membros",
  "permissions.manage": "Gerenciar permissões",
  "billing.view": "Ver faturamento",
  "billing.manage": "Gerenciar faturamento",
  "subscription.manage": "Gerenciar assinatura",
  "services.view": "Ver serviços B2B",
  "services.request": "Solicitar serviços B2B",
  "services.contract": "Contratar serviços B2B",
  "integrations.view": "Ver integrações",
  "integrations.manage": "Gerenciar integrações",
  "usage.view_self": "Ver o próprio consumo de IA",
  "usage.view_organization": "Ver consumo de IA da organização",
  "usage.manage_budget": "Gerenciar orçamento de IA",
  "cases.create": "Criar casos",
  "cases.view_all": "Ver todos os casos",
  "cases.manage_all": "Editar todos os casos",
  "cases.delete": "Excluir casos",
  "documents.upload": "Enviar documentos",
  "documents.delete": "Excluir documentos",
  "ai.use": "Usar o assistente de IA",
  "proposals.use": "Propostas comerciais",
  "marketing.use": "Marketing",
  "publications.use": "Publicações e monitoramento",
  "crm.view": "Ver o Comercial",
  "crm.manage_own": "Criar e editar oportunidades próprias",
  "crm.view_all": "Ver todas as oportunidades",
  "crm.manage_all": "Gerenciar todas as oportunidades",
  "crm.view_values": "Ver valores comerciais",
  "crm.proposals_create": "Criar propostas",
  "crm.proposals_approve": "Aprovar propostas",
  "crm.proposals_share": "Compartilhar propostas",
  "crm.record_outcome": "Registrar ganho ou perda",
  "crm.convert": "Converter oportunidade em caso",
  "crm.admin": "Administrar configurações comerciais",
};

/**
 * Permissões padrão por papel. Espelha `public.org_role_default_permissions`.
 * Permissões de faturamento/contratação nunca são padrão do `admin` —
 * somente o `owner` pode concedê-las.
 */
export const ORG_ROLE_DEFAULT_PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
  owner: ORG_PERMISSIONS,
  admin: [
    "members.view",
    "members.invite",
    "members.manage",
    "permissions.manage",
    "services.view",
    "services.request",
    "integrations.view",
    "integrations.manage",
    "usage.view_self",
    "usage.view_organization",
    "usage.manage_budget",
    "cases.create",
    "cases.view_all",
    "cases.manage_all",
    "cases.delete",
    "documents.upload",
    "documents.delete",
    "ai.use",
    "proposals.use",
    "marketing.use",
    "publications.use",
    "crm.view",
    "crm.manage_own",
    "crm.view_all",
    "crm.manage_all",
    "crm.view_values",
    "crm.proposals_create",
    "crm.proposals_approve",
    "crm.proposals_share",
    "crm.record_outcome",
    "crm.convert",
    "crm.admin",
  ],
  manager: [
    "members.view",
    "services.view",
    "services.request",
    "integrations.view",
    "usage.view_self",
    "usage.view_organization",
    "cases.create",
    "cases.view_all",
    "cases.manage_all",
    "documents.upload",
    "documents.delete",
    "ai.use",
    "proposals.use",
    "marketing.use",
    "publications.use",
    "crm.view",
    "crm.manage_own",
    "crm.view_all",
    "crm.manage_all",
    "crm.view_values",
    "crm.proposals_create",
    "crm.proposals_approve",
    "crm.proposals_share",
    "crm.record_outcome",
    "crm.convert",
  ],
  lawyer: [
    "members.view",
    "usage.view_self",
    "cases.create",
    "documents.upload",
    "ai.use",
    "proposals.use",
    "marketing.use",
    "publications.use",
    "crm.view",
    "crm.manage_own",
    "crm.view_values",
    "crm.proposals_create",
    "crm.proposals_share",
    "crm.record_outcome",
  ],
  collaborator: ["members.view", "usage.view_self", "documents.upload", "ai.use", "crm.view"],
  viewer: ["members.view", "usage.view_self"],
  billing_manager: [
    "members.view",
    "billing.view",
    "billing.manage",
    "subscription.manage",
    "services.view",
    "usage.view_self",
    "usage.view_organization",
    "crm.view",
    "crm.view_values",
  ],
};

/** Permissões que somente o titular (owner) pode conceder. */
export const OWNER_ONLY_GRANTABLE: readonly OrgPermission[] = [
  "billing.view",
  "billing.manage",
  "subscription.manage",
  "services.contract",
];
