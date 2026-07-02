import sidebarIcon from "@/assets/brain-sidebar.png.asset.json";
import squareNavy from "@/assets/brain-square-navy.png.asset.json";
import squareWhite from "@/assets/brain-square-white.png.asset.json";
import glyphNavy from "@/assets/brain-glyph-navy.png.asset.json";
import glyphWhite from "@/assets/brain-glyph-white.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * JurisMind brand mark — unified icon component.
 *
 * Use `context` to pick the correct layout variant automatically. This is the
 * preferred API because it keeps the whole app consistent when a design token
 * changes (e.g. if the landing header icon should switch from square-navy to
 * sidebar, you update only CONTEXT_TO_VARIANT below).
 *
 * ## `context` guide (recommended)
 *
 * | Context         | Where to use it                            | Result                                  |
 * |-----------------|-------------------------------------------|-----------------------------------------|
 * | `sidebar`       | Sidebar / mobile app header              | White bg, navy brain, rounded corners   |
 * | `header`        | Landing page header                      | Navy bg, white brain, rounded corners   |
 * | `landing`       | Hero sections, feature cards on home     | Navy bg, white brain, rounded corners   |
 * | `auth`          | Authentication screen                      | Navy bg, white brain, rounded corners   |
 * | `chat`          | Chat placeholder, assistant avatars      | Navy bg, white brain, rounded corners   |
 * | `chip-dark`     | Chips/badges on dark surfaces              | White bg, navy brain, rounded corners   |
 * | `inline-light`  | Inline with text on light backgrounds    | Navy brain, transparent bg              |
 * | `inline-dark`   | Inline with text on dark backgrounds     | White brain, transparent bg             |
 *
 * ## Practical examples
 *
 * ```tsx
 * // Sidebar menu (preferred — always use context)
 * <JurisMindMark context="sidebar" size={28} />
 *
 * // Landing page header
 * <JurisMindMark context="header" size={32} />
 *
 * // Hero feature card with a dark primary background
 * <JurisMindMark context="landing" size={48} />
 *
 * // Auth screen logo
 * <JurisMindMark context="auth" size={40} />
 *
 * // Chat empty state / assistant avatar
 * <JurisMindMark context="chat" size={64} />
 *
 * // Chip inside a dark badge
 * <JurisMindMark context="chip-dark" size={16} />
 *
 * // Inline next to a heading on a white card
 * <h3><JurisMindMark context="inline-light" size={20} /> Assistente IA</h3>
 *
 * // Inline next to text on a navy banner
 * <p><JurisMindMark context="inline-dark" size={18} /> JurisMind AI</p>
 * ```
 *
 * ## When to use `variant` (override only)
 *
 * `variant` exists for exceptional cases where a specific asset must be forced
 * regardless of the context convention. You should almost always prefer `context`.
 *
 * Good reasons to use `variant`:
 * - A marketing page needs a one-off transparent glyph on a dark hero despite the
 *   global `header` context mapping to square-navy.
 * - A third-party embed / white-label requires the white-square version.
 * - You are building a design-system showcase that intentionally shows every asset.
 *
 * Bad reasons to use `variant`:
 * - “I just want the sidebar icon in the header.” → Change the `header` mapping
 *   in CONTEXT_TO_VARIANT instead, or add a new context if the design really
 *   differs.
 * - “The chat icon looks better here.” → That means the `chat` context mapping is
 *   wrong; update it once for the whole app.
 *
 * Example override:
 * ```tsx
 * <JurisMindMark context="header" variant="glyph-white" size={24} />
 * ```
 * This renders the transparent white glyph while still documenting *why* it is
 * there through `context`.
 */

export type JurisMindVariant =
  | "sidebar"
  | "square-navy"
  | "square-white"
  | "glyph-navy"
  | "glyph-white";

const SOURCES: Record<JurisMindVariant, string> = {
  sidebar: sidebarIcon.url,
  "square-navy": squareNavy.url,
  "square-white": squareWhite.url,
  "glyph-navy": glyphNavy.url,
  "glyph-white": glyphWhite.url,
};

/**
 * Semantic contexts where the mark is rendered. Prefer passing `context`
 * instead of hand-picking a `variant`, so the layout stays consistent if
 * the design token for a context changes.
 *
 * Single source of truth — the union type, the runtime list and the
 * variant mapping are all derived from `JURISMIND_CONTEXTS`, so TypeScript
 * autocompletion, exhaustiveness checks and iteration stay in sync.
 */
export const JURISMIND_CONTEXTS = [
  "sidebar",
  "header",
  "landing",
  "auth",
  "chat",
  "chip-dark",
  "inline-light",
  "inline-dark",
] as const;

export type JurisMindContext = (typeof JURISMIND_CONTEXTS)[number];

/**
 * Named lookup for every `JurisMindContext` literal. Prefer this over passing
 * raw strings so misspellings become type errors and future renames propagate.
 *
 * @example
 * <JurisMindMark context={JURISMIND_CONTEXT.header} size={32} />
 */
export const JURISMIND_CONTEXT = {
  sidebar: "sidebar",
  header: "header",
  landing: "landing",
  auth: "auth",
  chat: "chat",
  chipDark: "chip-dark",
  inlineLight: "inline-light",
  inlineDark: "inline-dark",
} as const satisfies Record<string, JurisMindContext>;

export function isJurisMindContext(value: unknown): value is JurisMindContext {
  return (
    typeof value === "string" &&
    (JURISMIND_CONTEXTS as readonly string[]).includes(value)
  );
}

// Regra global de contraste do quadrado da marca:
//   • Fundo CLARO  → quadrado NAVY  (bg-brand-navy    + glyph-white)
//   • Fundo ESCURO → quadrado BRANCO (bg-brand-surface + glyph-navy)
// A cor do quadrado vem de tokens do tema (--color-brand-*), NUNCA hardcoded.
// Assets legado (`sidebar`, `square-navy`, `square-white`) permanecem apenas
// para overrides explícitos via `variant=`; o caminho de `context=` usa o
// composto CSS (wrapper com bg tokenizado + glyph transparente).
const CONTEXT_TO_VARIANT: Record<JurisMindContext, JurisMindVariant> = {
  sidebar: "square-white",
  header: "square-navy",
  landing: "square-navy",
  auth: "square-navy",
  chat: "square-navy",
  "chip-dark": "square-white",
  "inline-light": "glyph-navy",
  "inline-dark": "glyph-white",
};

/**
 * Tipos de composição do mark quando derivado de `context`:
 * - `square-token`: wrapper com bg tokenizado (fixo por contexto);
 * - `square-token-theme-aware`: wrapper que troca navy↔branco via `.dark`;
 * - `glyph`: apenas o glyph transparente, sem quadrado.
 * Sidebar/chip-dark são fixos porque seus fundos são fixos por design.
 */
type ContextComposition =
  | { kind: "square-token"; tone: "navy" | "surface" }
  | { kind: "square-token-theme-aware" }
  | { kind: "glyph"; tone: "navy" | "white" };

const CONTEXT_COMPOSITION: Record<JurisMindContext, ContextComposition> = {
  sidebar: { kind: "square-token", tone: "surface" },      // sidebar navy fixa
  header: { kind: "square-token-theme-aware" },
  landing: { kind: "square-token-theme-aware" },
  auth: { kind: "square-token-theme-aware" },
  chat: { kind: "square-token-theme-aware" },
  "chip-dark": { kind: "square-token", tone: "surface" },  // chip sempre em bg escuro
  "inline-light": { kind: "glyph", tone: "navy" },
  "inline-dark": { kind: "glyph", tone: "white" },
};

/**
 * Fallback context used when a caller passes `null`, `undefined` or an
 * unknown value. `sidebar` is the safest default because its asset renders
 * legibly on both light and dark surfaces.
 */
export const DEFAULT_JURISMIND_CONTEXT: JurisMindContext = "sidebar";

export function variantForContext(
  context: JurisMindContext | null | undefined,
): JurisMindVariant {
  const safe = isJurisMindContext(context) ? context : DEFAULT_JURISMIND_CONTEXT;
  return CONTEXT_TO_VARIANT[safe];
}

function isJurisMindVariant(value: unknown): value is JurisMindVariant {
  return typeof value === "string" && value in SOURCES;
}

/**
 * Shared rounding token for square brand marks. Keep in sync with `IconBox`
 * so that mark + icon backgrounds visually match at the same size.
 */
export const JURISMIND_ROUND_CLASS = "rounded-[22%]";

const INTERACTIVE_CLASS =
  "transition-transform duration-150 ease-out will-change-transform hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Glyph transparente renderizado dentro de um quadrado tokenizado. */
function BrandGlyph({ tone, size }: { tone: "navy" | "white"; size: number }) {
  const src = tone === "navy" ? SOURCES["glyph-navy"] : SOURCES["glyph-white"];
  // O glyph ocupa ~72% do quadrado (mesma proporção visual dos PNGs antigos).
  const inner = Math.round(size * 0.72);
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={inner}
      height={inner}
      loading="lazy"
      draggable={false}
      className="block object-contain select-none pointer-events-none"
      style={{ width: inner, height: inner }}
    />
  );
}

/**
 * Quadrado da marca desenhado via CSS + tokens (`bg-brand-navy` /
 * `bg-brand-surface`) com o glyph transparente sobreposto. Substitui os
 * quadrados embutidos nos PNGs (`square-navy`, `square-white`) para que
 * mudanças de tema/paleta se propaguem automaticamente.
 */
function BrandSquare({
  tone,
  size,
  rounded,
  interactive,
  className,
  themeAware,
}: {
  tone?: "navy" | "surface";
  size: number;
  rounded: boolean;
  interactive: boolean;
  className?: string;
  /** Quando true ignora `tone` e alterna navy↔surface via `.dark`. */
  themeAware?: boolean;
}) {
  const commonWrapper = cn(
    "inline-flex items-center justify-center shrink-0 select-none align-middle overflow-hidden",
    rounded && JURISMIND_ROUND_CLASS,
    interactive && INTERACTIVE_CLASS,
    className,
  );
  const style = { width: size, height: size } as const;

  if (themeAware) {
    return (
      <span
        role="img"
        aria-label="JurisMind AI"
        className={cn(commonWrapper, "bg-brand-navy dark:bg-brand-surface")}
        style={style}
      >
        {/* light: quadrado navy → glyph branco */}
        <span className="contents dark:hidden">
          <BrandGlyph tone="white" size={size} />
        </span>
        {/* dark: quadrado branco → glyph navy */}
        <span className="contents hidden dark:inline">
          <BrandGlyph tone="navy" size={size} />
        </span>
      </span>
    );
  }

  const bg = tone === "navy" ? "bg-brand-navy" : "bg-brand-surface";
  const glyphTone: "navy" | "white" = tone === "navy" ? "white" : "navy";
  return (
    <span
      role="img"
      aria-label="JurisMind AI"
      className={cn(commonWrapper, bg)}
      style={style}
    >
      <BrandGlyph tone={glyphTone} size={size} />
    </span>
  );
}

export function JurisMindMark({
  className,
  size = 20,
  variant,
  context,
  rounded,
  interactive = false,
}: {
  className?: string;
  size?: number;
  /** Explicit variant. Prefer `context` unless you need a specific asset. */
  variant?: JurisMindVariant | null;
  /** Semantic layout context; resolves to the correct variant automatically. */
  context?: JurisMindContext | null;
  /** Force rounded corners. Square variants are rounded by default. */
  rounded?: boolean;
  /**
   * Adds hover/active/focus affordances (subtle scale + opacity + ring).
   * Enable when the mark sits inside a clickable link/button so the whole
   * app shares the same interaction feel across desktop and mobile.
   */
  interactive?: boolean;
}) {
  const explicitVariant = isJurisMindVariant(variant) ? variant : null;

  // Override explícito → mantém o PNG legado (compat total).
  if (explicitVariant) {
    const isSquare =
      explicitVariant === "sidebar" ||
      explicitVariant === "square-navy" ||
      explicitVariant === "square-white";
    const shouldRound = rounded ?? isSquare;
    return (
      <img
        src={SOURCES[explicitVariant]}
        alt="JurisMind AI"
        width={size}
        height={size}
        loading="lazy"
        draggable={false}
        className={cn(
          "block shrink-0 select-none align-middle",
          isSquare ? "object-cover" : "object-contain",
          shouldRound && JURISMIND_ROUND_CLASS,
          interactive && INTERACTIVE_CLASS,
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const safeContext: JurisMindContext = isJurisMindContext(context)
    ? context
    : DEFAULT_JURISMIND_CONTEXT;
  const composition = CONTEXT_COMPOSITION[safeContext];

  if (composition.kind === "glyph") {
    const shouldRound = rounded ?? false;
    return (
      <img
        src={SOURCES[composition.tone === "navy" ? "glyph-navy" : "glyph-white"]}
        alt="JurisMind AI"
        width={size}
        height={size}
        loading="lazy"
        draggable={false}
        className={cn(
          "block shrink-0 select-none align-middle object-contain",
          shouldRound && JURISMIND_ROUND_CLASS,
          interactive && INTERACTIVE_CLASS,
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <BrandSquare
      size={size}
      rounded={rounded ?? true}
      interactive={interactive}
      className={className}
      themeAware={composition.kind === "square-token-theme-aware"}
      tone={composition.kind === "square-token" ? composition.tone : undefined}
    />
  );
}


