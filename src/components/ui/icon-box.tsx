import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * IconBox — ícone com fundo primário e cantos arredondados.
 *
 * Use para ícones de recursos, cards e listas. Garante consistência de
 * arredondamento, cor e alinhamento em toda a aplicação.
 */
export function IconBox({
  icon: Icon,
  size = 40,
  iconSize = 20,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="shrink-0" style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
