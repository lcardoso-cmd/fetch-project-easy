import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { JurisMindMark } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useCapabilities, VIEW_AS_PRESETS } from "@/hooks/use-capabilities";
import { labelsForPractice } from "@/lib/practice-labels";
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
  Microscope,
  Globe2,
  Info,
  Users2,
  Building2,
  KeyRound,
  ScrollText,
  Eye,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
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

function buildNav(practice: PracticeType | null | undefined): NavItem[] {
  const labels = labelsForPractice(practice);
  const isLawyer = !practice || practice === "advogado";

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
    section("principal", "Principal"),
    link("dashboard", "/painel", "Painel", Home, "exact"),
    link(
      "cases",
      "/assistencias",
      isLawyer ? "Casos" : labels.entityPlural,
      FolderKanban,
      "startsWith",
    ),
    link("my-tasks", "/tarefas", "Minhas Tarefas", ClipboardCheck),
    link("inbox", "/conversas", "Conversas", MessageSquare, "startsWith"),
    link("calendar", "/agenda", "Agenda", CalendarDays),
    link("my-files", "/documentos", "Meus Documentos", FileArchive),
    link("drafter", "/pecas", isLawyer ? "Peças Jurídicas" : labels.outputLabel, Scale),
    link("expert-opinion", "/parecer-tecnico", "Parecer Técnico", Microscope),

    // ─── NEGÓCIO ───
    { type: "separator" },
    section("business", "Negócio"),
    link("proposal", "/propostas", "Proposta Comercial", Handshake),
    link("monitoring", "/publicacoes", "Publicações", FileSearch),
    link("marketing", "/marketing", "Marketing", Megaphone),

    // ─── ESCRITÓRIO ───
    { type: "separator" },
    section("office", "Escritório"),
    link("integrations", "/integracoes", "Integrações", Puzzle),
    link("settings", "/configuracoes", "Configurações", Settings2),

    // ─── PLATAFORMA B2B ───
    { type: "separator" },
    section("platform", "Plataforma JurisMind"),
    link("platform", "/plataforma", "Visão B2B", Globe2, "exact"),
    link("platform-customers", "/plataforma/clientes", "Clientes SaaS", Building2, "startsWith"),
    link("platform-users", "/plataforma/usuarios", "Usuários", Users2, "startsWith"),
    link("platform-credentials", "/plataforma/credenciais", "Credenciais SaaS", KeyRound, "startsWith"),
    link("platform-audit", "/plataforma/auditoria", "Log de auditoria", ScrollText, "startsWith"),
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
  const [collapsed, setCollapsed] = useState(false);

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
          <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 py-1 text-center text-xs font-medium text-black shadow">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Você está vendo o sistema como <strong>{activePreset.label}</strong>. As
              autorizações do servidor continuam usando sua conta real.
            </span>
            <button
              type="button"
              className="rounded bg-black/10 px-2 py-0.5 hover:bg-black/20"
              onClick={clearSimulation}
            >
              Sair da simulação
            </button>
          </div>
        )}
        {/* Sidebar */}
        <aside
          className={cn(
            "relative hidden flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:flex",
            collapsed ? "w-20" : "w-64",
            activePreset && "mt-6",
          )}
        >
          <button
            onClick={toggle}
            className="absolute top-16 -right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-sidebar-primary shadow-lg ring-1 ring-sidebar-border transition-transform hover:scale-105"
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <div
            className={cn(
              "flex h-20 items-center border-b border-sidebar-border px-4",
              collapsed && "justify-center px-2",
            )}
          >
            <Link
              to="/painel"
              aria-label="Ir para o Dashboard"
              className="group flex items-center gap-3 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <JurisMindMark size={32} context="sidebar" interactive />
              {!collapsed && (
                <h2 className="font-heading text-base font-semibold leading-tight truncate">
                  B2B | JurisMind AI
                </h2>
              )}
            </Link>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-4">
            {NAV.map((item, idx) => {
              if (item.type === "separator") {
                return <div key={idx} className="my-2 border-t border-sidebar-border/50" />;
              }
              if (item.type === "label") {
                if (collapsed) return null;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50"
                  >
                    <span>{item.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Sobre a seção ${item.label}`}
                          className="rounded-full p-0.5 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="max-w-xs bg-popover text-popover-foreground border shadow-md"
                      >
                        {item.description}
                      </TooltipContent>
                    </Tooltip>
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
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="max-w-xs bg-popover text-popover-foreground border shadow-md"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold">{item.label}</div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-3 space-y-2">
            {isSuperAdmin && !collapsed && <ViewAsSwitcher />}
            {!collapsed && user && (
              <div className="flex items-center gap-2 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase">
                  {user.email?.charAt(0) ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-sidebar-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={signOut}
              className={cn(
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "h-9 w-9 mx-auto" : "w-full justify-start gap-2",
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "Sair"}
            </Button>
          </div>
        </aside>

        {/* Main column */}
        <div className={cn("flex flex-1 flex-col min-w-0", activePreset && "mt-6")}>
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:hidden">
            <Link
              to="/painel"
              aria-label="Ir para o Dashboard"
              className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <JurisMindMark size={32} context="header" interactive />

              <span className="font-heading text-lg font-bold">B2B | JurisMind AI</span>
            </Link>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 lg:hidden">
            {NAV.filter((i) => i.type === "link").map((item) => {
              if (item.type !== "link") return null;
              const Icon = item.icon;
              const active = isActive(item.to, item.match);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.description}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <header className="hidden h-16 items-center justify-end gap-3 border-b bg-card px-6 lg:flex">
            <NotificationBell />
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
