import {
  CAPABILITY_LABELS,
  formatRequiresPhrase,
  type Capability,
} from "@/lib/capabilities.functions";

/**
 * Registro central de descrições e permissões usadas em qualquer
 * lugar do app que precise explicar POR QUÊ um menu está visível
 * ou oculto (sidebar desktop, nav mobile, popover de "menus ocultos",
 * página de gestão de equipe, guards de rota, etc.).
 *
 * Regra: nunca escreva a frase "Requer …" à mão em componentes.
 * Sempre passe pela função `describeNav()` abaixo, para que todos
 * os pontos do app mostrem exatamente o mesmo motivo.
 */

export type NavKey =
  // Principal
  | "dashboard"
  | "cases"
  | "my-tasks"
  | "inbox"
  | "calendar"
  | "my-files"
  | "drafter"
  | "expert-opinion"
  // Negócio
  | "proposal"
  | "monitoring"
  | "marketing"
  // Escritório
  | "integrations"
  | "settings"
  // Plataforma
  | "platform";

export type NavSectionKey = "principal" | "business" | "office" | "platform";

export type NavEntry = {
  /** Descrição funcional (o que o item faz). */
  base: string;
  /** Permissão exigida, se houver. */
  requires?: Capability;
};

export const NAV_SECTIONS: Record<NavSectionKey, NavEntry> = {
  principal: {
    base:
      "Trabalho documental do dia-a-dia: painel, casos, tarefas, conversas, agenda, documentos e peças. Visível para todos os usuários do escritório.",
  },
  business: {
    base:
      "Área comercial e de marketing. Cada item exige uma permissão específica — nem todo operador do escritório precisa gerar propostas ou publicações.",
  },
  office: {
    base:
      "Gestão do escritório: equipe, integrações, cobrança e configurações.",
    requires: "office_admin",
  },
  platform: {
    base:
      "Visão B2B da JurisMind — gestão de clientes, assinaturas e uso da plataforma. Restrita à equipe interna da JurisMind.",
    requires: "platform_admin",
  },
};

export const NAV_ENTRIES: Record<NavKey, NavEntry> = {
  // Principal
  dashboard: { base: "Visão geral. Disponível para todos os usuários autenticados." },
  cases: {
    base: "Gerencia casos, clientes e documentos vinculados.",
    requires: "cases",
  },
  "my-tasks": { base: "Suas tarefas pessoais. Disponível para todos." },
  inbox: { base: "Conversas internas do escritório. Disponível para todos." },
  calendar: { base: "Sua agenda pessoal e integrada (Google/Outlook)." },
  "my-files": { base: "Seus documentos pessoais e enviados." },
  drafter: {
    base: "Gerador de peças jurídicas com IA. Disponível para todos os operadores.",
  },
  "expert-opinion": {
    base: "Elaboração de pareceres técnicos. Aparece apenas para peritos.",
    requires: "expert_opinion",
  },

  // Negócio
  proposal: {
    base: "Gera e versiona propostas comerciais.",
    requires: "commercial",
  },
  monitoring: {
    base: "Monitoramento de publicações oficiais.",
    requires: "marketing",
  },
  marketing: {
    base: "Materiais e campanhas de marketing.",
    requires: "marketing",
  },

  // Escritório
  integrations: {
    base: "Integrações do escritório (Google, Outlook, etc.).",
    requires: "office_admin",
  },
  settings: {
    base: "Configurações do escritório, equipe e permissões.",
    requires: "office_admin",
  },

  // Plataforma
  platform: {
    base: "Painel B2B da JurisMind.",
    requires: "platform_admin",
  },
};

/**
 * Devolve a descrição completa (funcional + frase "Requer …") para
 * qualquer entrada de navegação ou seção. Use SEMPRE isto para
 * gerar tooltips, títulos e legendas — assim garantimos que
 * "Casos" mostra o mesmo motivo no sidebar, no mobile e no popover
 * de menus ocultos.
 */
export function describeNav(entry: NavEntry): string {
  if (!entry.requires) return entry.base;
  return `${entry.base} ${formatRequiresPhrase(entry.requires)}`;
}

/** Label curto da permissão, se houver. */
export function requirementLabel(entry: NavEntry): string | null {
  return entry.requires ? CAPABILITY_LABELS[entry.requires] : null;
}
