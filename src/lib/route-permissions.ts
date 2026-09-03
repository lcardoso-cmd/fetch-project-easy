import type { OrgPermission, PlatformRole } from "@/lib/org-permissions";

/**
 * Guard declarativo de rotas.
 *
 * A ORDEM IMPORTA: prefixos mais específicos vêm ANTES dos genéricos.
 * Rotas ausentes desta lista ficam abertas a qualquer usuário autenticado
 * da organização (o servidor continua sendo a autoridade final, via
 * `requireOrgPermission` e RLS).
 *
 * Áreas de administração B2B exigem papel de plataforma; áreas do escritório
 * exigem permissão de organização. As duas dimensões nunca se misturam.
 */
export type RouteRule =
  | { prefix: string; permission: OrgPermission }
  | { prefix: string; platformRole: PlatformRole };

export const ROUTE_RULES: readonly RouteRule[] = [
  // ── Administração B2B (JurisMind) ──
  { prefix: "/plataforma/credenciais", platformRole: "super_admin" },
  { prefix: "/plataforma/configuracoes", platformRole: "super_admin" },
  { prefix: "/plataforma", platformRole: "platform_admin" },

  // ── Escritório ──
  { prefix: "/configuracoes/consumo", permission: "usage.view_organization" },
  { prefix: "/configuracoes/capacidades", permission: "permissions.manage" },
  { prefix: "/configuracoes/equipe", permission: "members.view" },
  { prefix: "/configuracoes/oauth", permission: "integrations.manage" },
  { prefix: "/configuracoes/escritorio", permission: "members.manage" },
  { prefix: "/configuracoes", permission: "members.view" },
  { prefix: "/organizacao/cobranca", permission: "billing.view" },
  { prefix: "/organizacao", permission: "members.view" },
  { prefix: "/integracoes", permission: "integrations.view" },
  { prefix: "/integrations", permission: "integrations.view" },
  { prefix: "/contratar-b2b", permission: "services.view" },
  { prefix: "/assistencias", permission: "ai.use" },
  { prefix: "/cases", permission: "ai.use" },
  { prefix: "/assistente", permission: "ai.use" },
  { prefix: "/comercial", permission: "crm.view" },
  { prefix: "/propostas", permission: "proposals.use" },
  { prefix: "/publicacoes", permission: "publications.use" },
  { prefix: "/monitoring", permission: "publications.use" },
  { prefix: "/marketing", permission: "marketing.use" },
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Regra de acesso da rota, ou null quando aberta a membros autenticados. */
export function routeRuleFor(pathname: string): RouteRule | null {
  for (const rule of ROUTE_RULES) {
    if (matches(pathname, rule.prefix)) return rule;
  }
  return null;
}

export function isPlatformPath(pathname: string): boolean {
  return matches(pathname, "/plataforma");
}
