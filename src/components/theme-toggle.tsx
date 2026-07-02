import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "ghost" | "outline";
  floating?: boolean;
};

export function ThemeToggle({ className, variant = "ghost", floating = false }: Props) {
  const { theme, resolved, setTheme } = useTheme();

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          aria-label="Alternar tema"
          title="Alternar tema"
          className={cn(
            floating &&
              "fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full border bg-background/90 shadow-lg backdrop-blur hover:bg-background print:hidden",
            className,
          )}
        >
          <Sun className={cn("h-4 w-4 transition-all", resolved === "dark" && "hidden")} />
          <Moon className={cn("h-4 w-4 transition-all", resolved === "light" && "hidden")} />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(active && "bg-accent font-medium")}
            >
              <Icon className="mr-2 h-4 w-4" />
              {opt.label}
              {active && <span className="ml-auto text-xs text-muted-foreground">Ativo</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
