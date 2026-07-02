import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { JURISMIND_ROUND_CLASS } from "@/components/brand/jurismind-mark";

/**
 * IconBox — ícone com fundo primário e cantos arredondados.
 *
 * Usa o mesmo token de arredondamento do `JurisMindMark` para garantir
 * que ícones de recursos e a marca fiquem visualmente coerentes lado a lado,
 * em qualquer tamanho, no desktop e no mobile.
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
        "inline-flex shrink-0 items-center justify-center bg-primary text-primary-foreground align-middle",
        JURISMIND_ROUND_CLASS,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="shrink-0" style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
