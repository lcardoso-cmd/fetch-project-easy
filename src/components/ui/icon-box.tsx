import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { JURISMIND_ROUND_CLASS } from "@/components/brand/jurismind-mark";

/**
 * IconBox — ícone em um container redondo/arredondado com fundo colorido.
 *
 * Expõe props de raio, cor do fundo e cor do ícone para ser reutilizado em
 * qualquer contexto (hero, cards de funcionalidade, botões, chips, etc.) sem
 * precisar criar variações ad-hoc.
 *
 * O padrão mantém a coerência com a marca: fundo primário, ícone na cor
 * `primary-foreground` e arredondamento `squircle` (22%), igual ao
 * `JurisMindMark`.
 *
 * @example
 * <IconBox icon={Icon} size={40} />
 *
 * @example
 * // Fundo branco + ícone navy, cantos arredondados padrão
 * <IconBox icon={Icon} bgColor="bg-white" iconColor="text-navy-900" />
 *
 * @example
 * // Círculo perfeito, fundo cinza claro, ícone cinza escuro
 * <IconBox icon={Icon} rounded="full" bgColor="bg-muted" iconColor="text-muted-foreground" />
 */
export function IconBox({
  icon: Icon,
  size = 40,
  iconSize = 20,
  rounded = "squircle",
  bgColor = "bg-primary",
  iconColor = "text-primary-foreground",
  className,
}: {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  /** Raio dos cantos. `squircle` é o mesmo arredondamento do `JurisMindMark`. */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "squircle" | "full";
  /** Classes de cor de fundo (Tailwind), ex: `bg-primary`, `bg-white`, `bg-muted`. */
  bgColor?: string;
  /** Classes de cor do ícone (Tailwind), ex: `text-primary-foreground`, `text-navy-900`. */
  iconColor?: string;
  className?: string;
}) {
  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    squircle: JURISMIND_ROUND_CLASS,
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center align-middle",
        bgColor,
        iconColor,
        roundedClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="shrink-0" style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}

