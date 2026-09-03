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
  | "assistant"
  | "my-work"
  | "library"
  | "help"
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
  | "hire-b2b"
  // Escritório
  | "integrations"
  | "settings"
  // Plataforma
  | "platform"
  | "platform-customers"
  | "platform-users"
  | "platform-plans"
  | "platform-subscriptions"
  | "platform-invoices"
  | "platform-payments"
  | "platform-usage"
  | "platform-commercial-settings"
  | "platform-credentials"
  | "platform-requests"
  | "platform-audit"
  // Escritório — cobrança
  | "billing";

export type NavSectionKey =
  | "main"
  | "modules"
  | "workspace"
  | "practice"
  | "business"
  | "office"
  | "platform";

export type NavEntry = {
  /** Descrição funcional (o que o item faz). */
  base: string;
  /** Permissão exigida, se houver. */
  requires?: Capability;
};

export const NAV_SECTIONS: Record<NavSectionKey, NavEntry> = {
  main: {
    base: "Trabalho jurídico do dia a dia.",
  },
  modules: {
    base: "Módulos complementares contratados pelo escritório.",
  },
  workspace: {
    base:
      "Seu espaço pessoal: painel, tarefas, conversas, agenda e documentos.",
  },
  practice: {
    base:
      "Trabalho jurídico: casos, peças e pareceres técnicos contratados.",
  },
  business: {
    base:
      "Área comercial e de marketing do escritório.",
  },
  office: {
    base:
      "Gestão do escritório: equipe e configurações.",
    requires: "office_admin",
  },
  platform: {
    base:
      "Operação B2B da JurisMind — clientes, usuários, credenciais e métricas do SaaS.",
    requires: "platform_admin",
  },
};

export const NAV_ENTRIES: Record<NavKey, NavEntry> = {
  // Principal
  dashboard: { base: "Visão operacional do dia: prazos, tarefas e casos recentes." },
  assistant: { base: "Análise documental com JurisMind AI por caso." },
  "my-work": { base: "Suas tarefas, prazos e agenda em um só lugar." },
  library: { base: "Todos os documentos aos quais você tem acesso." },
  help: { base: "Ajuda e explicação de acessos." },
  cases: {
    base: "Casos, clientes e documentos vinculados.",
    requires: "cases",
  },
  "my-tasks": { base: "Suas tarefas pessoais." },
  inbox: { base: "Conversas internas do escritório." },
  calendar: { base: "Sua agenda integrada (Google/Outlook)." },
  "my-files": { base: "Seus documentos pessoais e enviados." },
  drafter: {
    base: "Gerador de peças jurídicas com IA.",
  },
  "expert-opinion": {
    base: "Solicitação e acompanhamento de pareceres técnicos elaborados pela B2B Consulting.",
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

  "hire-b2b": {
    base: "Contrate assistência técnica, auditoria de cálculos, pareceres e finanças forense direto da B2B Consulting.",
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

  // Plataforma B2B
  platform: {
    base: "Painel B2B — KPIs, novos clientes e uso agregado.",
    requires: "platform_admin",
  },
  "platform-customers": {
    base: "Clientes do SaaS — escritórios e profissionais que compraram a plataforma.",
    requires: "platform_admin",
  },
  "platform-users": {
    base: "Todos os usuários do sistema, com escritório e permissões.",
    requires: "platform_admin",
  },
  "platform-credentials": {
    base: "Credenciais OAuth do SaaS (Google, Outlook) usadas por todos os clientes.",
    requires: "super_admin",
  },
  "platform-requests": {
    base: "Solicitações de serviço enviadas pelos escritórios à B2B.",
    requires: "platform_admin",
  },
  "platform-audit": {
    base: "Log de ações administrativas da B2B.",
    requires: "platform_admin",
  },
  "platform-plans": {
    base: "Planos comerciais, preços e limites de cada contrato.",
    requires: "platform_admin",
  },
  "platform-subscriptions": {
    base: "Assinaturas vigentes, ciclos e receita recorrente.",
    requires: "platform_admin",
  },
  "platform-invoices": {
    base: "Faturas emitidas, vencimentos e inadimplência.",
    requires: "platform_admin",
  },
  "platform-payments": {
    base: "Pagamentos recebidos, falhas e conciliação.",
    requires: "platform_admin",
  },
  "platform-usage": {
    base: "Consumo de IA por cliente e custo agregado.",
    requires: "platform_admin",
  },
  "platform-commercial-settings": {
    base: "Regras comerciais: avaliação, tolerância e política de inadimplência.",
    requires: "super_admin",
  },

  // Escritório — cobrança
  billing: {
    base: "Plano, assinatura, faturas e pagamentos do escritório.",
    requires: "office_admin",
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
