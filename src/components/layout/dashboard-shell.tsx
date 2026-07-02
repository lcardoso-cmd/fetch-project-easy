import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { labelsForPractice } from "@/lib/practice-labels";
import type { PracticeType } from "@/lib/profile.functions";
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
  BrainCircuit,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";

type NavItem =
  | { type: "label"; label: string }
  | { type: "separator" }
  | { type: "link"; to: string; label: string; icon: LucideIcon; match?: "exact" | "startsWith" };

function buildNav(practice: PracticeType | null | undefined): NavItem[] {
  const labels = labelsForPractice(practice);
  const isLawyer = !practice || practice === "advogado";
  return [
    { type: "label", label: "Principal" },
    { type: "link", to: "/dashboard", label: "Painel", icon: Home, match: "exact" },
    {
      type: "link",
      to: "/cases",
      label: isLawyer ? "Casos" : labels.entityPlural,
      icon: FolderKanban,
      match: "startsWith",
    },
    { type: "link", to: "/my-tasks", label: "Minhas Tarefas", icon: ClipboardCheck },
    { type: "link", to: "/inbox", label: "Conversas", icon: MessageSquare, match: "startsWith" },
    { type: "link", to: "/calendar", label: "Agenda", icon: CalendarDays },
    { type: "link", to: "/my-files", label: "Meus Documentos", icon: FileArchive },
    { type: "separator" },
    { type: "label", label: "Gestão" },
    { type: "link", to: "/monitoring", label: "Publicações", icon: FileSearch },
    {
      type: "link",
      to: "/drafter",
      label: isLawyer ? "Peças Jurídicas" : labels.outputLabel,
      icon: Scale,
    },
    { type: "link", to: "/proposal", label: "Proposta Comercial", icon: Handshake },
    { type: "link", to: "/marketing", label: "Marketing", icon: Megaphone },
    { type: "separator" },
    { type: "label", label: "Sistema" },
    { type: "link", to: "/integrations", label: "Integrações", icon: Puzzle },
    { type: "link", to: "/settings", label: "Configurações", icon: Settings2 },
  ];
}


export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const NAV = buildNav((profile?.practice_type as PracticeType | undefined) ?? null);
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
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "relative hidden flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:flex",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo button (toggle) */}
        <button
          onClick={toggle}
          className="absolute top-16 -right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-sidebar-primary shadow-lg ring-1 ring-sidebar-border transition-transform hover:scale-105"
          aria-label={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {/* Header */}
        <div
          className={cn(
            "flex h-20 items-center border-b border-sidebar-border px-4",
            collapsed && "justify-center px-2"
          )}
        >
          <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <JurisMindMark size={36} variant="square-navy" className="rounded-lg" />
            {!collapsed && (
              <h2 className="font-heading text-base font-semibold leading-tight truncate">
                B2B | JurisMind AI
              </h2>
            )}
          </Link>
        </div>

        {/* Nav */}
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
                  className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50"
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
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          {!collapsed && user && (
            <div className="mb-3 flex items-center gap-2 px-2">
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
              collapsed ? "h-9 w-9 mx-auto" : "w-full justify-start gap-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="font-heading text-lg font-bold">B2B | JurisMind AI</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile nav strip */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 lg:hidden">
          {NAV.filter((i) => i.type === "link").map((item) => {
            if (item.type !== "link") return null;
            const Icon = item.icon;
            const active = isActive(item.to, item.match);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop topbar */}
        <header className="hidden h-16 items-center justify-end gap-3 border-b bg-card px-6 lg:flex">
          <NotificationBell />
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
