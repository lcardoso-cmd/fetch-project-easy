import { Link } from "@tanstack/react-router";
import { LogOut, Settings, LayoutDashboard, UserCog, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

function initialsFrom(name?: string | null, email?: string | null) {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "US";
  if (source.includes("@")) return source[0]?.toUpperCase() ?? "U";
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "US";
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();

  const name = profile?.full_name ?? null;
  const email = user?.email ?? "";
  const initials = initialsFrom(name, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-auto items-center gap-2 rounded-full px-1.5 py-1 hover:bg-accent"
          aria-label="Abrir menu do usuário"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="hidden max-w-[180px] truncate text-sm font-medium text-foreground md:inline">
              {name || email}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{name || "Sem nome"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/painel" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Painel
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/configuracoes" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/configuracoes/escritorio" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/ajuda/permissoes" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Ajuda e acessos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
