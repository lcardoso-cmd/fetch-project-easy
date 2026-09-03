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
 * Permissões padrão por papel. Espelha EXATAMENTE
 * `public.org_role_default_permissions` (ver migration da matriz).
 *
 * Regras:
 * - `owner` recebe tudo, inclusive cobrança, assinatura e contratação.
 * - `admin` administra o escritório, mas NUNCA cobrança/assinatura/contratação.
 * - `manager` opera casos e equipe em leitura; módulos comerciais/marketing/
 *   publicações são concessões explícitas, não padrão.
 * - `lawyer`/`collaborator` são operacionais; nada sensível por padrão.
 * - `viewer` apenas visualiza.
 * - `billing_manager` fica restrito a cobrança/assinatura e leitura de consumo.
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
    "integrations.view",
    "usage.view_self",
    "usage.view_organization",
    "cases.create",
    "cases.view_all",
    "cases.manage_all",
    "documents.upload",
    "documents.delete",
    "ai.use",
  ],
  lawyer: ["members.view", "usage.view_self", "cases.create", "documents.upload", "ai.use"],
  collaborator: ["members.view", "usage.view_self", "documents.upload", "ai.use"],
  viewer: ["members.view", "usage.view_self"],
  billing_manager: [
    "members.view",
    "billing.view",
    "billing.manage",
    "subscription.manage",
    "usage.view_self",
    "usage.view_organization",
  ],
};

/** Permissões que somente o titular (owner) pode conceder. */
export const OWNER_ONLY_GRANTABLE: readonly OrgPermission[] = [
  "billing.view",
  "billing.manage",
  "subscription.manage",
  "services.contract",
];

/**
 * Papéis que cada papel pode atribuir a outra pessoa.
 * Ninguém promove alguém a um papel superior ao seu; apenas o titular
 * transfere/duplica a titularidade.
 */
export const ROLE_ASSIGNABLE_BY: Record<OrgRole, readonly OrgRole[]> = {
  owner: ORG_ROLES,
  admin: ["manager", "lawyer", "collaborator", "viewer", "billing_manager"],
  manager: [],
  lawyer: [],
  collaborator: [],
  viewer: [],
  billing_manager: [],
};

export function canAssignRole(actorRole: OrgRole | null, target: OrgRole): boolean {
  if (!actorRole) return false;
  return ROLE_ASSIGNABLE_BY[actorRole].includes(target);
}

/** O papel concede a permissão por padrão? */
export function roleHasPermission(role: OrgRole, permission: OrgPermission): boolean {
  return ORG_ROLE_DEFAULT_PERMISSIONS[role].includes(permission);
}

/**
 * Permissões efetivas: padrão do papel + concessões explícitas − revogações.
 * Espelha `public.org_effective_permissions`.
 */
export function effectivePermissions(
  role: OrgRole,
  overrides: ReadonlyArray<{ permission: OrgPermission; granted: boolean }> = [],
): OrgPermission[] {
  const set = new Set<OrgPermission>(ORG_ROLE_DEFAULT_PERMISSIONS[role]);
  for (const o of overrides) {
    if (o.granted) set.add(o.permission);
    else set.delete(o.permission);
  }
  return ORG_PERMISSIONS.filter((p) => set.has(p));
}

/** Agrupamento das permissões para telas de administração. */
export const ORG_PERMISSION_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  permissions: readonly OrgPermission[];
}> = [
  {
    id: "team",
    label: "Equipe e permissões",
    permissions: ["members.view", "members.invite", "members.manage", "permissions.manage"],
  },
  {
    id: "cases",
    label: "Casos e documentos",
    permissions: [
      "cases.create",
      "cases.view_all",
      "cases.manage_all",
      "cases.delete",
      "documents.upload",
      "documents.delete",
    ],
  },
  {
    id: "ai",
    label: "Inteligência artificial",
    permissions: ["ai.use", "usage.view_self", "usage.view_organization", "usage.manage_budget"],
  },
  {
    id: "modules",
    label: "Módulos",
    permissions: ["proposals.use", "marketing.use", "publications.use"],
  },
  {
    id: "crm",
    label: "Comercial (CRM)",
    permissions: [
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
  },
  {
    id: "office",
    label: "Escritório",
    permissions: ["integrations.view", "integrations.manage", "services.view", "services.request"],
  },
  {
    id: "billing",
    label: "Cobrança e contratação",
    permissions: ["billing.view", "billing.manage", "subscription.manage", "services.contract"],
  },
];
