import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/layout/user-menu";
import { useProfile } from "@/hooks/use-profile";
import { useCapabilities, VIEW_AS_PRESETS } from "@/hooks/use-capabilities";
import type { PracticeType } from "@/lib/profile.functions";
import type { Capability } from "@/lib/capabilities.functions";
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
  Home,
  FolderKanban,
  ClipboardCheck,
  CalendarDays,
  FileArchive,
  FileSearch,
  Scale,
  Handshake,
  Megaphone,
  Puzzle,
  Settings2,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  
  Globe2,
  Menu,
  Users2,
  Building2,
  KeyRound,
  ScrollText,
  Eye,
  ShieldCheck,
  type LucideIcon,
  HelpCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";

type NavLink = {
  type: "link";
  to: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "startsWith";
  requires?: Capability;
  description: string;
};
type NavLabel = {
  type: "label";
  label: string;
  description: string;
};
type NavItem = NavLabel | { type: "separator" } | NavLink;

function buildNav(_practice: PracticeType | null | undefined): NavItem[] {
  const link = (
    key: NavKey,
    to: string,
    label: string,
    icon: LucideIcon,
    match?: "exact" | "startsWith",
  ): NavLink => {
    const entry = NAV_ENTRIES[key];
    return {
      type: "link",
      to,
      label,
      icon,
      match,
      requires: entry.requires,
      description: describeNav(entry),
    };
  };
  const section = (key: NavSectionKey, label: string): NavLabel => ({
    type: "label",
    label,
    description: describeNav(NAV_SECTIONS[key]),
  });

  return [
    // ─── PRINCIPAL ───
    section("main", "Principal"),
    link("dashboard", "/painel", "Início", Home, "exact"),
    link("cases", "/assistencias", "Casos", FolderKanban, "startsWith"),
    link("assistant", "/assistente", "JurisMind AI", MessageSquare, "startsWith"),
    link("my-work", "/tarefas", "Meu trabalho", ClipboardCheck),
    link("library", "/documentos", "Biblioteca", FileArchive),

    // ─── MÓDULOS ───
    { type: "separator" },
    section("modules", "Módulos"),
    link("monitoring", "/publicacoes", "Monitoramento", FileSearch),
    link("proposal", "/comercial", "Comercial", Handshake),

    // ─── PLATAFORMA B2B ───
    { type: "separator" },
    section("platform", "Plataforma JurisMind"),
    link("platform", "/plataforma", "Visão B2B", Globe2, "exact"),
    link("platform-customers", "/plataforma/clientes", "Clientes SaaS", Building2, "startsWith"),
    link("platform-users", "/plataforma/usuarios", "Usuários", Users2, "startsWith"),
    link("platform-requests", "/plataforma/solicitacoes", "Solicitações B2B", Handshake, "startsWith"),
    link("platform-credentials", "/plataforma/credenciais", "Credenciais SaaS", KeyRound, "startsWith"),
    link("platform-audit", "/plataforma/auditoria", "Log de auditoria", ScrollText, "startsWith"),
  ];
}

/** Itens fixos do rodapé da barra lateral. */
export function buildFooterNav(): NavItem[] {
  const link = (
    key: NavKey,
    to: string,
    label: string,
    icon: LucideIcon,
    match?: "exact" | "startsWith",
  ): NavLink => {
    const entry = NAV_ENTRIES[key];
    return {
      type: "link",
      to,
      label,
      icon,
      match,
      requires: entry.requires,
      description: describeNav(entry),
    };
  };
  return [
    link("hire-b2b", "/contratar-b2b", "Serviços especializados", ShieldCheck, "startsWith"),
    link("settings", "/configuracoes", "Administração", Settings2, "startsWith"),
    link("help", "/ajuda/permissoes", "Ajuda", HelpCircle, "startsWith"),
  ];
}

// Filtra links por capacidade e remove labels/separators órfãos.
// Não expõe nada ao usuário sobre itens escondidos.
function applyCapabilities(
  raw: NavItem[],
  has: (c: Capability) => boolean,
): NavItem[] {
  const filtered: NavItem[] = raw.filter((item) => {
    if (item.type !== "link") return true;
    if (!item.requires) return true;
    return has(item.requires);
  });

  const cleaned: NavItem[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    if (item.type === "label") {
      let hasLink = false;
      for (let j = i + 1; j < filtered.length; j++) {
        const next = filtered[j];
        if (next.type === "label" || next.type === "separator") break;
        if (next.type === "link") {
          hasLink = true;
          break;
        }
      }
      if (!hasLink) continue;
    }
    if (item.type === "separator") {
      const last = cleaned[cleaned.length - 1];
      if (!last || last.type === "separator" || last.type === "label") continue;
    }
    cleaned.push(item);
  }
  while (cleaned.length && cleaned[cleaned.length - 1].type === "separator") cleaned.pop();

  return cleaned;
}

function ViewAsSwitcher() {
  const { isSuperAdmin, simulation, activePreset, setSimulation } = useCapabilities();
  if (!isSuperAdmin) return null;
  const currentId = simulation ?? "super_admin";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition",
            activePreset
              ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {activePreset ? `Vendo como: ${activePreset.label}` : "Ver como…"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-72 p-2">
        <div className="mb-2 flex items-center gap-1.5 px-2 pt-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Simulação visual — o servidor mantém sua permissão real.</span>
        </div>
        <ul className="space-y-0.5">
          {VIEW_AS_PRESETS.map((p) => {
            const active = currentId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSimulation(p.id === "super_admin" ? null : p.id)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-xs transition",
                    active ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                  )}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.description}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { has, isSuperAdmin, activePreset, clearSimulation } = useCapabilities();
  const raw = useMemo(
    () => buildNav((profile?.practice_type as PracticeType | undefined) ?? null),
    [profile?.practice_type],
  );
  const NAV = useMemo(() => applyCapabilities(raw, has), [raw, has]);
  const FOOTER_NAV = useMemo(
    () => applyCapabilities(buildFooterNav(), has),
    [has],
  );
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

  const isActive = (to: string, match?: "exact" | "startsWith") =>
    match === "exact" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Simulation banner */}
        {activePreset && (
          <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-secondary py-1 text-center text-xs font-medium text-secondary-foreground shadow">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Você está vendo o sistema como <strong>{activePreset.label}</strong>. As
              autorizações do servidor continuam usando sua conta real.
            </span>
            <button
              type="button"
              className="rounded bg-background/20 px-2 py-0.5 hover:bg-background/30"
              onClick={clearSimulation}
            >
              Sair da simulação
            </button>
          </div>
        )}
        {/* Sidebar */}
        <aside
          className={cn(
            "relative hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-16" : "w-60",
            activePreset && "mt-6",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center gap-2 px-3",
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
                <span className="truncate font-heading text-[13px] font-semibold text-foreground">
                  JurisMind
                </span>
              )}
            </Link>
            {!collapsed && (
              <button
                onClick={toggle}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Recolher"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={toggle}
              className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Expandir"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          )}

          <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-2">
            {NAV.map((item, idx) => {
              if (item.type === "separator") {
                return <div key={idx} className="my-2" />;
              }
              if (item.type === "label") {
                if (collapsed) return null;
                return (
                  <div
                    key={idx}
                    className="px-2 pb-1 pt-3 text-[13px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60"
                  >
                    {item.label}
                  </div>
                );
              }
              const Icon = item.icon;
              const active = isActive(item.to, item.match);
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                        "h-9",
                        active
                          ? "bg-sidebar-accent font-medium text-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-sidebar-primary" />
                      )}
                      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-2 space-y-1">
            {FOOTER_NAV.map((item) =>
              item.type !== "link" ? null : (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                        isActive(item.to, item.match)
                          ? "bg-sidebar-accent font-medium text-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              ),
            )}
            {isSuperAdmin && !collapsed && <ViewAsSwitcher />}
            {!collapsed && user && (
              <div className="flex items-center gap-2 px-1 py-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase text-foreground">
                  {user.email?.charAt(0) ?? "U"}
                </div>
                <p className="truncate text-[13px] text-sidebar-foreground/75 flex-1">
                  {user.email}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={signOut}
              className={cn(
                "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
                collapsed ? "h-8 w-8 mx-auto" : "w-full justify-start gap-2 h-9 text-sm font-normal px-2",
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "Sair"}
            </Button>
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground/70 transition hover:bg-accent hover:text-foreground"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                >
                  <div className="flex h-14 items-center gap-2 px-3">
                    <JurisMindMark size={26} context={JURISMIND_CONTEXT.sidebar} interactive />
                    <span className="truncate font-heading text-[13px] font-semibold text-foreground">
                      JurisMind
                    </span>
                  </div>
                  <nav className="h-[calc(100vh-3.5rem-4rem)] space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-2">
                    {NAV.map((item, idx) => {
                      if (item.type === "separator") {
                        return <div key={idx} className="my-2" />;
                      }
                      if (item.type === "label") {
                        return (
                          <div
                            key={idx}
                            className="px-2 pb-1 pt-3 text-[13px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60"
                          >
                            {item.label}
                          </div>
                        );
                      }
                      const Icon = item.icon;
                      const active = isActive(item.to, item.match);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent font-medium text-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-sidebar-primary" />
                          )}
                          <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                    <div className="my-2" />
                    {FOOTER_NAV.map((item) =>
                      item.type !== "link" ? null : (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                            isActive(item.to, item.match)
                              ? "bg-sidebar-accent font-medium text-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          <item.icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      ),
                    )}
                  </nav>
                  <div className="border-t border-sidebar-border p-2 space-y-1">
                    {isSuperAdmin && <ViewAsSwitcher />}
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-[12px] font-normal px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <Link to="/ajuda/permissoes" onClick={() => setMobileOpen(false)}>
                        <HelpCircle className="h-3.5 w-3.5" />
                        Ajuda
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMobileOpen(false);
                        signOut();
                      }}
                      className="w-full justify-start gap-2 h-8 text-[12px] font-normal px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <LogOut className="h-3.5 w-3.5" />
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


          <header className="hidden h-16 items-center justify-end gap-3 border-b bg-card/95 px-6 lg:flex">
            <ConversationsDrawer />
            <NotificationBell />
            <UserMenu />
          </header>


          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
