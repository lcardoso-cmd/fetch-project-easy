import type { Capability } from "@/lib/capabilities.functions";

/**
 * Mapeia prefixos de rota → capacidade exigida.
 * A ORDEM IMPORTA: prefixos mais específicos devem vir ANTES dos genéricos
 * (ex.: /plataforma/credenciais precisa aparecer antes de /plataforma).
 * Rotas não listadas aqui são consideradas abertas para qualquer usuário
 * autenticado (o servidor continua sendo a autoridade final via RLS/RPC).
 */
const ROUTE_CAP_RULES: Array<{ prefix: string; cap: Capability }> = [
  { prefix: "/plataforma/credenciais", cap: "super_admin" },
  { prefix: "/plataforma", cap: "platform_admin" },
  { prefix: "/assistencias", cap: "cases" },
  { prefix: "/parecer-tecnico", cap: "expert_opinion" },
  { prefix: "/propostas", cap: "commercial" },
  { prefix: "/publicacoes", cap: "marketing" },
  { prefix: "/marketing", cap: "marketing" },
  { prefix: "/integracoes", cap: "office_admin" },
  { prefix: "/configuracoes", cap: "office_admin" },
];

export function requiredCapabilityForPath(pathname: string): Capability | null {
  for (const rule of ROUTE_CAP_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      return rule.cap;
    }
  }
  return null;
}
