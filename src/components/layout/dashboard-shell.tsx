import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/layout/user-menu";
import { useProfile } from "@/hooks/use-profile";
import { useAccess, VIEW_AS_ROLES } from "@/hooks/use-access";
import type { OrgPermission, OrgRole, PlatformRole } from "@/lib/org-permissions";
import {
  NAV_ENTRIES,
  NAV_SECTIONS,
  describeNav,
  type NavKey,
  type NavSectionKey,
} from "@/lib/nav-registry";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Home,
  FolderKanban,
  ClipboardCheck,
  FileArchive,
  FileSearch,
  Handshake,
  Settings2,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Globe2,
  Layers,
  Repeat,
  ReceiptText,
  CreditCard,
  Gauge,
  SlidersHorizontal,
  Menu,
  Users2,
  Building2,
  KeyRound,
  ScrollText,
  Eye,
  ShieldCheck,
  Wallet,
  Cog,
  Activity,
  ChevronDown,
  type LucideIcon,
  HelpCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ConversationsDrawer } from "@/components/chat/conversations-drawer";

/* ────────────────────────────────────────────────────────────────
   Modelo de navegação orientado a dados.
   Uma única configuração alimenta desktop e mobile.
   ──────────────────────────────────────────────────────────────── */

type NavLink = {
  kind: "link";
  to: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "startsWith";
  requires?: OrgPermission;
  platformRole?: PlatformRole;
  description: string;
};

/** Grupo recolhível com itens internos. */
type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
};

type NavNode = NavLink | NavGroup;

/** Seção de navegação: título opcional + nós (links diretos ou grupos). */
type NavSection = {
  id: string;
  label?: string;
  description?: string;
  nodes: NavNode[];
};

/** Ambientes de navegação: escritório (operação) e administração global B2B. */
type ShellScope = "office" | "b2b";

function link(
  key: NavKey,
  to: string,
  label: string,
  icon: LucideIcon,
  match?: "exact" | "startsWith",
): NavLink {
  const entry = NAV_ENTRIES[key];
  return {
    kind: "link",
    to,
    label,
    icon,
    match,
    requires: entry.requires,
    platformRole: entry.platformRole,
    description: describeNav(entry),
  };
}

function sectionMeta(key: NavSectionKey) {
  return describeNav(NAV_SECTIONS[key]);
}

/** Navegação principal por ambiente. */
function buildNavSections(scope: ShellScope): NavSection[] {
  if (scope === "b2b") {
    return [
      {
        id: "b2b-root",
        description: sectionMeta("platform"),
        nodes: [
          link("platform", "/plataforma", "Visão geral", Globe2, "exact"),
          {
            kind: "group",
            id: "b2b-gestao",
            label: "Gestão",
            icon: Building2,
            items: [
              link("platform-customers", "/plataforma/clientes", "Clientes SaaS", Building2, "startsWith"),
              link("platform-users", "/plataforma/usuarios", "Usuários", Users2, "startsWith"),
            ],
          },
          {
            kind: "group",
            id: "b2b-financeiro",
            label: "Financeiro",
            icon: Wallet,
            items: [
              link("platform-plans", "/plataforma/planos", "Planos e limites", Layers, "startsWith"),
              link("platform-subscriptions", "/plataforma/assinaturas", "Assinaturas", Repeat, "startsWith"),
              link("platform-invoices", "/plataforma/faturas", "Faturas", ReceiptText, "startsWith"),
              link("platform-payments", "/plataforma/pagamentos", "Pagamentos", CreditCard, "startsWith"),
            ],
          },
          {
            kind: "group",
            id: "b2b-operacao",
            label: "Operação",
            icon: Activity,
            items: [
              link("platform-usage", "/plataforma/consumo", "Consumo de IA", Gauge, "startsWith"),
              link("platform-requests", "/plataforma/solicitacoes", "Solicitações B2B", Handshake, "startsWith"),
            ],
          },
          {
            kind: "group",
            id: "b2b-sistema",
            label: "Sistema",
            icon: Cog,
            items: [
              link("platform-credentials", "/plataforma/credenciais", "Credenciais SaaS", KeyRound, "startsWith"),
              link(
                "platform-commercial-settings",
                "/plataforma/configuracoes",
                "Configuração comercial",
                SlidersHorizontal,
                "startsWith",
              ),
              link("platform-audit", "/plataforma/auditoria", "Log de auditoria", ScrollText, "startsWith"),
            ],
          },
        ],
      },
    ];
  }

  return [
    {
      id: "office-main",
      label: "Principal",
      description: sectionMeta("main"),
      nodes: [
        link("dashboard", "/painel", "Início", Home, "exact"),
        link("cases", "/assistencias", "Casos", FolderKanban, "startsWith"),
        link("assistant", "/assistente", "JurisMind AI", MessageSquare, "startsWith"),
        link("my-work", "/tarefas", "Meu trabalho", ClipboardCheck),
        link("library", "/documentos", "Biblioteca", FileArchive),
      ],
    },
    {
      id: "office-modules",
      label: "Módulos",
      description: sectionMeta("modules"),
      nodes: [
        link("monitoring", "/publicacoes", "Monitoramento", FileSearch),
        link("proposal", "/comercial", "Comercial", Handshake),
      ],
    },
  ];
}

/** Itens fixos do rodapé da barra lateral, por ambiente. */
export function buildFooterNav(scope: ShellScope = "office"): NavLink[] {
  if (scope === "b2b") {
    return [link("help", "/ajuda/permissoes", "Ajuda", HelpCircle, "startsWith")];
  }
  return [
    link("hire-b2b", "/contratar-b2b", "Serviços especializados", ShieldCheck, "startsWith"),
    link("billing", "/organizacao/cobranca", "Assinatura e cobrança", CreditCard, "startsWith"),
    link("settings", "/configuracoes", "Administração", Settings2, "startsWith"),
    link("help", "/ajuda/permissoes", "Ajuda", HelpCircle, "startsWith"),
  ];
}

/**
 * Filtra links por capacidade e remove grupos/seções sem nenhum item
 * autorizado. Nada é revelado ao usuário sobre itens ocultos.
 */
function applyAccess(
  sections: NavSection[],
  can: (l: NavLink) => boolean,
): NavSection[] {
  const allowed = can;
  const result: NavSection[] = [];
  for (const section of sections) {
    const nodes: NavNode[] = [];
    for (const node of section.nodes) {
      if (node.kind === "link") {
        if (allowed(node)) nodes.push(node);
        continue;
      }
      const items = node.items.filter(allowed);
      if (items.length > 0) nodes.push({ ...node, items });
    }
    if (nodes.length > 0) result.push({ ...section, nodes });
  }
  return result;
}

function flattenLinks(sections: NavSection[]): NavLink[] {
  return sections.flatMap((s) =>
    s.nodes.flatMap((n) => (n.kind === "link" ? [n] : n.items)),
  );
}

function matchesPath(pathname: string, l: NavLink) {
  return l.match === "exact"
    ? pathname === l.to
    : pathname === l.to || pathname.startsWith(`${l.to}/`);
}

function ViewAsSwitcher() {
  const { isPlatformUser, simulation, roleLabel, setSimulation } = useAccess();
  if (!isPlatformUser) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ui font-medium transition",
            simulation
              ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/60"
              : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <Eye className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {simulation ? `Vendo como: ${roleLabel}` : "Ver como…"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-72 p-2">
        <div className="mb-2 flex items-center gap-1.5 px-2 pt-1 text-sm text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Simulação visual — o servidor mantém sua permissão real.</span>
        </div>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => setSimulation(null)}
              className={cn(
                "w-full rounded-md px-2.5 py-2 text-left text-ui transition",
                !simulation ? "bg-primary/10 text-foreground" : "hover:bg-muted",
              )}
            >
              <div className="font-medium">Minha visão real</div>
              <div className="text-sm text-muted-foreground">
                Papéis reais da sua conta.
              </div>
            </button>
          </li>
          {VIEW_AS_ROLES.map((p) => (
            <li key={p.role}>
              <button
                type="button"
                onClick={() => setSimulation(p.role as OrgRole)}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left text-ui transition",
                  simulation === p.role ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                )}
              >
                <div className="font-medium">{p.label}</div>
                <div className="text-sm text-muted-foreground">
                  Permissões padrão do papel «{p.label}» na organização.
                </div>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Controle de contexto: separa o ambiente do escritório da administração B2B. */
const SCOPE_OPTIONS: {
  id: ShellScope;
  label: string;
  short: string;
  to: string;
  icon: LucideIcon;
}[] = [
  { id: "office", label: "Ambiente do escritório", short: "Escritório", to: "/painel", icon: Building2 },
  { id: "b2b", label: "Administração B2B", short: "B2B", to: "/plataforma", icon: Globe2 },
];

function ScopeSwitcher({
  scope,
  collapsed,
  onNavigate,
}: {
  scope: ShellScope;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    const other = SCOPE_OPTIONS.find((o) => o.id !== scope)!;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={other.to}
            onClick={onNavigate}
            aria-label={`Alternar para ${other.label}`}
            className="mx-auto mb-2 flex size-11 items-center justify-center rounded-md border border-sidebar-border text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <other.icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-sm">
          Alternar para {other.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div
      role="group"
      aria-label="Contexto de trabalho"
      className="mx-2 mb-3 grid grid-cols-2 gap-1 rounded-lg border border-sidebar-border p-1"
    >
      {SCOPE_OPTIONS.map((o) => {
        const active = o.id === scope;
        return (
          <Link
            key={o.id}
            to={o.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={o.label}
            className={cn(
              "relative flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/78 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0.5 h-[3px] rounded-full bg-sidebar-primary"
              />
            )}
            <o.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{o.short}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ── Primitivas visuais reutilizadas por desktop e mobile ── */

const rowBase =
  "group relative flex min-h-11 items-center gap-3 rounded-md pr-2 text-ui transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function NavRow({
  item,
  active,
  collapsed,
  nested,
  onNavigate,
}: {
  item: NavLink;
  active: boolean;
  collapsed?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const row = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? undefined : item.description}
      className={cn(
        rowBase,
        collapsed ? "justify-center px-0" : nested ? "pl-6" : "pl-3",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-sidebar-primary"
        />
      )}
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right" className="text-sm">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavGroupBlock({
  group,
  open,
  onOpenChange,
  pathname,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const hasActive = group.items.some((i) => matchesPath(pathname, i));

  // Recolhida: grupos viram lista plana de ícones, com tooltip por item.
  if (collapsed) {
    return (
      <div className="space-y-0.5 border-t border-sidebar-border/60 pt-1">
        {group.items.map((item) => (
          <NavRow
            key={item.to}
            item={item}
            active={matchesPath(pathname, item)}
            collapsed
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  const Icon = group.icon;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          rowBase,
          "w-full pl-3 text-left font-semibold",
          hasActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5 pb-1">
        {group.items.map((item) => (
          <NavRow
            key={item.to}
            item={item}
            active={matchesPath(pathname, item)}
            nested
            onNavigate={onNavigate}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavTree({
  sections,
  pathname,
  openGroups,
  setOpenGroup,
  collapsed,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  openGroups: Record<string, boolean>;
  setOpenGroup: (id: string, v: boolean) => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.id} className="mb-3 last:mb-0">
          {section.label && !collapsed && (
            <div
              className="px-3 pb-2 pt-3 text-sm font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/72"
              title={section.description}
            >
              {section.label}
            </div>
          )}
          <div className="space-y-1">
            {section.nodes.map((node) =>
              node.kind === "link" ? (
                <NavRow
                  key={node.to}
                  item={node}
                  active={matchesPath(pathname, node)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ) : (
                <NavGroupBlock
                  key={node.id}
                  group={node}
                  open={openGroups[node.id] ?? false}
                  onOpenChange={(v) => setOpenGroup(node.id, v)}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  useProfile();
  const {
    hasOrgPermission,
    hasPlatformRole,
    isPlatformUser,
    simulation,
    roleLabel,
    clearSimulation,
  } = useAccess();
  const can = useCallback(
    (l: NavLink) =>
      l.platformRole
        ? hasPlatformRole(l.platformRole)
        : !l.requires || hasOrgPermission(l.requires),
    [hasPlatformRole, hasOrgPermission],
  );
  // Ambiente ativo: administração global B2B vive sob /plataforma;
  // todo o restante é o ambiente do escritório.
  const scope: ShellScope = pathname.startsWith("/plataforma") ? "b2b" : "office";
  // Só quem tem papel interno da B2B vê o ambiente de administração global.
  const canAdminB2B = hasPlatformRole("platform_admin");

  const sections = useMemo(
    () => applyAccess(buildNavSections(scope), can),
    [can, scope],
  );
  const footerNav = useMemo(
    () => buildFooterNav(scope).filter(can),
    [can, scope],
  );

  // Grupo da rota ativa abre automaticamente; os demais iniciam recolhidos.
  const activeGroupId = useMemo(() => {
    for (const section of sections) {
      for (const node of section.nodes) {
        if (node.kind === "group" && node.items.some((i) => matchesPath(pathname, i))) {
          return node.id;
        }
      }
    }
    return null;
  }, [sections, pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (activeGroupId) setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  const setOpenGroup = (id: string, v: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [id]: v }));

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((p) => {
      const next = !p;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const currentSection = useMemo(() => {
    const links = [...flattenLinks(sections), ...footerNav];
    const match = links
      .filter((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];
    return match?.label ?? "Painel";
  }, [sections, footerNav, pathname]);

  const footerRows = (opts: { collapsed?: boolean; onNavigate?: () => void }) =>
    footerNav.map((item) => (
      <NavRow
        key={item.to}
        item={item}
        active={matchesPath(pathname, item)}
        collapsed={opts.collapsed}
        onNavigate={opts.onNavigate}
      />
    ));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        {/* Simulation banner */}
        {activePreset && (
          <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-secondary py-1.5 text-center text-sm font-medium text-secondary-foreground shadow">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Você está vendo o sistema como <strong>{activePreset.label}</strong>. As
              autorizações do servidor continuam usando sua conta real.
            </span>
            <button
              type="button"
              className="rounded-md border border-border bg-card px-2.5 py-1 text-sm font-medium hover:bg-secondary"
              onClick={clearSimulation}
            >
              Sair da simulação
            </button>
          </div>
        )}

        {/* Sidebar desktop */}
        <aside
          className={cn(
            "relative hidden min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[4.5rem]" : "w-[16.5rem]",
            activePreset && "mt-6",
          )}
        >
          <div
            className={cn(
              "flex h-16 shrink-0 items-center gap-2 px-3",
              collapsed && "justify-center px-0",
            )}
          >
            <Link
              to="/painel"
              aria-label="Ir para o Dashboard"
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <JurisMindMark size={26} context={JURISMIND_CONTEXT.sidebar} interactive />
              {!collapsed && (
                <span className="truncate font-heading text-lg font-bold tracking-tight text-sidebar-foreground">
                  JurisMind
                </span>
              )}
            </Link>
            {!collapsed && (
              <button
                onClick={toggle}
                className="ml-auto flex size-9 items-center justify-center rounded-md text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Recolher"
              >
                <PanelLeftClose className="size-[18px]" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={toggle}
              className="mx-auto mb-1 flex size-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Expandir"
            >
              <PanelLeftOpen className="size-[18px]" />
            </button>
          )}

          {canAdminB2B && (
            <div className="shrink-0">
              <ScopeSwitcher scope={scope} collapsed={collapsed} />
            </div>
          )}

          <nav
            aria-label="Navegação principal"
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
          >
            <NavTree
              sections={sections}
              pathname={pathname}
              openGroups={openGroups}
              setOpenGroup={setOpenGroup}
              collapsed={collapsed}
            />
          </nav>

          {/* Footer — perfil/sair ficam no UserMenu do cabeçalho */}
          <div className="shrink-0 space-y-1 border-t border-sidebar-border p-2">
            {footerRows({ collapsed })}
            {isPlatformUser && !collapsed && <ViewAsSwitcher />}
          </div>
        </aside>

        {/* Main column */}
        <div className={cn("flex flex-1 flex-col min-w-0", activePreset && "mt-6")}>
          <header className="flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 lg:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Abrir menu"
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-foreground/70 transition hover:bg-accent hover:text-foreground"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="flex w-[19rem] max-w-[88vw] flex-col overflow-x-hidden border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                >
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <div className="flex h-16 shrink-0 items-center gap-3 px-3">
                    <JurisMindMark size={26} context={JURISMIND_CONTEXT.sidebar} interactive />
                    <span className="truncate font-heading text-lg font-bold text-sidebar-foreground">
                      JurisMind
                    </span>
                  </div>
                  {canAdminB2B && (
                    <div className="shrink-0">
                      <ScopeSwitcher scope={scope} onNavigate={() => setMobileOpen(false)} />
                    </div>
                  )}
                  <nav
                    aria-label="Navegação principal"
                    className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
                  >
                    <NavTree
                      sections={sections}
                      pathname={pathname}
                      openGroups={openGroups}
                      setOpenGroup={setOpenGroup}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <div className="mt-3 space-y-1 border-t border-sidebar-border pt-3">
                      {footerRows({ onNavigate: () => setMobileOpen(false) })}
                    </div>
                  </nav>
                  <div className="shrink-0 space-y-1 border-t border-sidebar-border p-2">
                    {isPlatformUser && <ViewAsSwitcher />}
                    {user && (
                      <p className="truncate px-3 py-1 text-sm text-sidebar-foreground/78">
                        {user.email}
                      </p>
                    )}
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-11 w-full justify-start gap-3 pl-3 text-ui font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <Link to="/configuracoes" onClick={() => setMobileOpen(false)}>
                        <Settings2 className="size-[18px]" aria-hidden="true" />
                        Meu perfil
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMobileOpen(false);
                        signOut();
                      }}
                      className="h-11 w-full justify-start gap-3 pl-3 text-ui font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <LogOut className="size-[18px]" aria-hidden="true" />
                      Sair
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <Link
                to="/painel"
                aria-label="Ir para o Dashboard"
                className="group flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <JurisMindMark size={28} context={JURISMIND_CONTEXT.header} interactive />
                <span className="font-heading text-base font-bold whitespace-nowrap truncate sm:text-lg">
                  B2B | JurisMind AI
                </span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ConversationsDrawer />
              <NotificationBell />
              <UserMenu compact />
            </div>
          </header>

          <header className="hidden h-16 items-center justify-between gap-4 border-b border-border bg-card px-6 lg:flex xl:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-2">
                <Link
                  to={scope === "b2b" ? "/plataforma" : "/painel"}
                  className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {scope === "b2b" ? "Administração B2B" : "Ambiente do escritório"}
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
                <span className="truncate text-ui font-semibold text-foreground">
                  {currentSection}
                </span>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConversationsDrawer />
              <NotificationBell />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-10 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
