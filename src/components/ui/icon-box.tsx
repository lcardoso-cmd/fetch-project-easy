import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { JURISMIND_ROUND_CLASS } from "@/components/brand/jurismind-mark";

/**
 * Tokens de tamanho do `IconBox`.
 *
 * Padroniza as proporções em desktop e mobile, garantindo consistência entre
 * header, sidebar, cards e demais superfícies. Cada token define o tamanho do
 * container (`box`) e o do ícone interno (`icon`), na razão ~1:0.5.
 *
 * | Token | Box  | Icon | Uso recomendado                                  |
 * | ----- | ---- | ---- | ------------------------------------------------ |
 * | `xs`  | 24px | 14px | Sidebar colapsada, chips, badges                 |
 * | `sm`  | 32px | 16px | Header, botões de ação, itens de lista           |
 * | `md`  | 40px | 20px | Cards padrão (default)                           |
 * | `lg`  | 56px | 28px | Cards de destaque, hero secundário               |
 * | `xl`  | 72px | 36px | Hero, callouts principais                        |
 */
export const ICON_BOX_SIZES = {
  xs: { box: 24, icon: 14 },
  sm: { box: 32, icon: 16 },
  md: { box: 40, icon: 20 },
  lg: { box: 56, icon: 28 },
  xl: { box: 72, icon: 36 },
} as const;

export type IconBoxSize = keyof typeof ICON_BOX_SIZES;

/**
 * IconBox — ícone em um container arredondado com fundo colorido.
 *
 * Aceita um token de tamanho (`size="sm"`) para manter proporções iguais em
 * todos os contextos, ou valores numéricos custom via `size`/`iconSize` quando
 * necessário. Padrão neutro: o ciano da marca é reservado a CTA, item ativo,
 * foco e seleção — ícones decorativos usam superfície discreta, ícone
 * neutro (superfície discreta) e arredondamento `squircle` (22%).
 *
 * @example
 * // Preset (recomendado)
 * <IconBox icon={Icon} size="md" />
 *
 * @example
 * // Header/sidebar
 * <IconBox icon={Icon} size="sm" bgColor="bg-sidebar-accent" iconColor="text-sidebar-foreground" />
 *
 * @example
 * // Custom
 * <IconBox icon={Icon} size={48} iconSize={22} />
 */
export function IconBox({
  icon: Icon,
  size = "md",
  iconSize,
  rounded = "squircle",
  bgColor = "bg-secondary",
  iconColor = "text-foreground",
  className,
}: {
  icon: LucideIcon;
  /** Preset (`xs|sm|md|lg|xl`) ou pixel exato. */
  size?: IconBoxSize | number;
  /** Sobrescreve o tamanho do ícone. Aceita preset ou pixels. */
  iconSize?: IconBoxSize | number;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "squircle" | "full";
  bgColor?: string;
  iconColor?: string;
  className?: string;
}) {
  const preset = typeof size === "string" ? ICON_BOX_SIZES[size] : null;
  const boxPx = preset ? preset.box : (size as number);
  const iconPx =
    iconSize == null
      ? preset
        ? preset.icon
        : Math.round((size as number) * 0.5)
      : typeof iconSize === "string"
        ? ICON_BOX_SIZES[iconSize].icon
        : iconSize;

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
      style={{ width: boxPx, height: boxPx }}
    >
      <Icon className="shrink-0" style={{ width: iconPx, height: iconPx }} />
    </div>
  );
}
