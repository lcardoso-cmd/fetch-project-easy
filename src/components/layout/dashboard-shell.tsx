import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
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
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ConversationsDrawer } from "@/components/chat/conversations-drawer";
import { TeamChatDock } from "@/components/chat/team-chat-dock";

/* ────────────────────────────────────────────────────────────────
   Modelo de navegação orientado a dados.
   Uma única configuração alimenta desktop, recolhido e mobile.
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
        link("hire-b2b", "/contratar-b2b", "Serviços especializados", ShieldCheck, "startsWith"),
      ],
    },
  ];
}

/** Itens fixos do rodapé da barra lateral, por ambiente (máx. 2 no escritório). */
export function buildFooterNav(scope: ShellScope = "office"): NavLink[] {
  if (scope === "b2b") return [];
  return [
    link("billing", "/organizacao/cobranca", "Assinatura e cobrança", CreditCard, "startsWith"),
    link("settings", "/configuracoes", "Administração", Settings2, "startsWith"),
  ];
}

/**
 * Filtra links por permissão e remove grupos/seções sem nenhum item
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

/* ── Tokens visuais da barra lateral ──────────────────────────────
   Dimensões e tipografia são idênticas em repouso, hover, foco e
   estado ativo. O ativo muda apenas cor de fundo/marcador.
   ──────────────────────────────────────────────────────────────── */

const SIDEBAR_W = "15rem"; // 240px
const SIDEBAR_W_COLLAPSED = "4rem"; // 64px

/** Linha principal: 40px desktop / 44px mobile (alvo de toque). */
const rowBase =
  "group relative flex w-full items-center gap-2.5 rounded-[6px] text-[14px] font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const rowHeight = "h-11 lg:h-10";
const subRowHeight = "h-11 lg:h-9";
const iconCls = "size-[17px] shrink-0";
const idleText = "text-sidebar-foreground/[0.74] hover:bg-white/[0.06] hover:text-sidebar-foreground";
const activeText = "bg-white/[0.08] text-sidebar-foreground";

function ActiveMark() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
    />
  );
}

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
      className={cn(
        rowBase,
        nested ? subRowHeight : rowHeight,
        nested && "text-[13px]",
        collapsed ? "justify-center px-0" : nested ? "pl-[34px] pr-2.5" : "px-2.5",
        active ? activeText : idleText,
      )}
    >
      {active && !collapsed && <ActiveMark />}
      <Icon className={iconCls} strokeWidth={1.75} aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right" className="text-[13px]">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Grupo recolhido: um único ícone + flyout lateral com os subitens. */
function CollapsedGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActive = group.items.some((i) => matchesPath(pathname, i));
  const Icon = group.icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={group.label}
          onMouseEnter={() => setOpen(true)}
          className={cn(
            rowBase,
            rowHeight,
            "justify-center px-0",
            hasActive ? activeText : idleText,
          )}
        >
          <Icon className={iconCls} strokeWidth={1.75} aria-hidden="true" />
          {hasActive && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1/2 size-1 -translate-y-1/2 rounded-full bg-sidebar-primary"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        onMouseLeave={() => setOpen(false)}
        className="w-56 border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground"
      >
        <p className="px-2 pb-1.5 pt-0.5 text-[12px] font-semibold text-sidebar-foreground">
          {group.label}
        </p>
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const active = matchesPath(pathname, item);
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  rowBase,
                  subRowHeight,
                  "px-2.5 text-[13px]",
                  active ? activeText : idleText,
                )}
              >
                {active && <ActiveMark />}
                <ItemIcon className={iconCls} strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
  if (collapsed) {
    return <CollapsedGroup group={group} pathname={pathname} onNavigate={onNavigate} />;
  }

  const hasActive = group.items.some((i) => matchesPath(pathname, i));
  const Icon = group.icon;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          rowBase,
          rowHeight,
          "px-2.5 text-left",
          hasActive && !open ? activeText : idleText,
        )}
      >
        <Icon className={iconCls} strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1 truncate">{group.label}</span>
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5">
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
  openGroupId,
  setOpenGroupId,
  collapsed,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  openGroupId: string | null;
  setOpenGroupId: (id: string | null) => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.id} className="mb-2 last:mb-0">
          {section.label && !collapsed && (
            <div className="px-2.5 pb-1 pt-3 text-[12px] font-semibold leading-4 tracking-[0.06em] text-sidebar-foreground">
              {section.label}
            </div>
          )}
          {section.label && collapsed && (
            <div
              aria-hidden="true"
              className="mx-3 my-2 border-t border-white/[0.12]"
            />
          )}
          <div className="space-y-0.5">
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
                  open={openGroupId === node.id}
                  onOpenChange={(v) => setOpenGroupId(v ? node.id : null)}
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
            className="mx-auto mb-1 flex size-9 items-center justify-center rounded-[6px] text-sidebar-foreground/[0.74] transition hover:bg-white/[0.06] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <other.icon className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-[13px]">
          Alternar para {other.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div
      role="group"
      aria-label="Contexto de trabalho"
      className="mx-2.5 mb-1.5 grid h-9 grid-cols-2 gap-0.5 rounded-[6px] border border-white/[0.12] p-0.5"
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
              "relative flex items-center justify-center gap-1.5 rounded-[4px] px-1.5 text-[13px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-white/[0.08] text-sidebar-foreground"
                : "text-sidebar-foreground/[0.74] hover:bg-white/[0.06] hover:text-sidebar-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-sidebar-primary"
              />
            )}
            <o.icon className="size-[15px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{o.short}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  useAuth();
  useProfile();
  const { hasOrgPermission, hasPlatformRole } = useAccess();

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
  const canAdminB2B = hasPlatformRole("platform_admin");

  const sections = useMemo(
    () => applyAccess(buildNavSections(scope), can),
    [can, scope],
  );
  const footerNav = useMemo(
    () => buildFooterNav(scope).filter(can),
    [can, scope],
  );

  // Grupo da rota ativa: apenas ele fica aberto.
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

  // Um único grupo aberto por vez; nunca persistido.
  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId);
  useEffect(() => {
    setOpenGroupId(activeGroupId);
  }, [activeGroupId]);
  // Trocar de ambiente limpa o estado anterior.
  useEffect(() => {
    setOpenGroupId(null);
  }, [scope]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navTree = (opts: { collapsed?: boolean; onNavigate?: () => void }) => (
    <NavTree
      sections={sections}
      pathname={pathname}
      openGroupId={openGroupId}
      setOpenGroupId={setOpenGroupId}
      collapsed={opts.collapsed}
      onNavigate={opts.onNavigate}
    />
  );

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
        {/* Sidebar desktop */}
        <aside
          style={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
          className={cn(
            "relative hidden min-h-0 shrink-0 flex-col border-r border-white/[0.12] bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex",
          )}
        
        >
          {/* Cabeçalho da sidebar: 56px */}
          <div
            className={cn(
              "flex h-14 shrink-0 items-center gap-2 px-2.5",
              collapsed && "justify-center px-0",
            )}
          >
            <Link
              to="/painel"
              aria-label="Ir para o Início"
              className="flex min-w-0 items-center gap-2 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <JurisMindMark size={22} context={JURISMIND_CONTEXT.sidebar} interactive />
              {!collapsed && (
                <span className="truncate font-heading text-[16px] font-semibold leading-5 tracking-tight text-sidebar-foreground">
                  JurisMind
                </span>
              )}
            </Link>
            {!collapsed && (
              <button
                onClick={toggle}
                className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-[6px] text-sidebar-foreground/[0.74] transition hover:bg-white/[0.06] hover:text-sidebar-foreground"
                aria-label="Recolher barra lateral"
              >
                <PanelLeftClose className="size-[17px]" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={toggle}
              className="mx-auto mb-1 flex size-9 shrink-0 items-center justify-center rounded-[6px] text-sidebar-foreground/[0.74] transition hover:bg-white/[0.06] hover:text-sidebar-foreground"
              aria-label="Expandir barra lateral"
            >
              <PanelLeftOpen className="size-[17px]" />
            </button>
          )}

          {canAdminB2B && (
            <div className="shrink-0">
              <ScopeSwitcher scope={scope} collapsed={collapsed} />
            </div>
          )}

          <nav
            aria-label="Navegação principal"
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
          >
            {navTree({ collapsed })}
          </nav>

          {/* Rodapé — só existe quando há acesso autorizado */}
          {footerNav.length > 0 && (
            <div className="shrink-0 space-y-0.5 border-t border-white/[0.12] px-2 py-2">
              {footerRows({ collapsed })}
            </div>
          )}
        </aside>

        {/* Main column */}
        <div className={cn("flex flex-1 flex-col min-w-0", simulation && "mt-6")}>
          <header className="flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-3 lg:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Abrir menu"
                    className="flex size-11 shrink-0 items-center justify-center rounded-[6px] text-foreground/70 transition hover:bg-accent hover:text-foreground"
                  >
                    <Menu className="size-5" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="flex w-[18rem] max-w-[88vw] flex-col overflow-x-hidden border-r border-white/[0.12] bg-sidebar p-0 text-sidebar-foreground"
                >
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <div className="flex h-14 shrink-0 items-center gap-2 px-3">
                    <JurisMindMark size={22} context={JURISMIND_CONTEXT.sidebar} interactive />
                    <span className="truncate font-heading text-[16px] font-semibold text-sidebar-foreground">
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
                    className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
                  >
                    {navTree({ onNavigate: () => setMobileOpen(false) })}
                  </nav>
                  {footerNav.length > 0 && (
                    <div className="shrink-0 space-y-0.5 border-t border-white/[0.12] px-2 py-2">
                      {footerRows({ onNavigate: () => setMobileOpen(false) })}
                    </div>
                  )}
                </SheetContent>
              </Sheet>
              <Link
                to="/painel"
                aria-label="Ir para o Início"
                className="group flex min-w-0 items-center gap-2 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <JurisMindMark size={26} context={JURISMIND_CONTEXT.header} interactive />
                <span className="truncate whitespace-nowrap font-heading text-[15px] font-semibold sm:text-[16px]">
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

          <header className="hidden h-14 items-center justify-between gap-4 border-b border-border bg-card pl-6 pr-[4.5rem] lg:flex xl:pl-10">
            <div className="flex min-w-0 items-center gap-3">
              <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-2">
                <Link
                  to={scope === "b2b" ? "/plataforma" : "/painel"}
                  className="whitespace-nowrap text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {scope === "b2b" ? "Administração B2B" : "Ambiente do escritório"}
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
                <span className="truncate text-[14px] font-semibold text-foreground">
                  {currentSection}
                </span>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isSuperAdmin && <ViewAsSwitcher />}
              <ConversationsDrawer />
              <NotificationBell />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto lg:pr-14">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-10 lg:py-8">
              {children}
            </div>
          </main>
        </div>
        <TeamChatDock />
      </div>
    </TooltipProvider>
  );
}
