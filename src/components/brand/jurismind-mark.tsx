import sidebarIcon from "@/assets/brain-sidebar.png.asset.json";
import squareNavy from "@/assets/brain-square-navy.png.asset.json";
import squareWhite from "@/assets/brain-square-white.png.asset.json";
import glyphNavy from "@/assets/brain-glyph-navy.png.asset.json";
import glyphWhite from "@/assets/brain-glyph-white.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * JurisMind brand mark — standardized variants.
 *
 * Layout convention (do not change without design approval):
 * - "sidebar"      → sidebar / app menu icon (white bg, navy brain, rounded)
 * - "square-navy"  → header / hero / auth (navy bg, white brain, rounded)
 * - "square-white" → chips on dark surfaces
 * - "glyph-navy"   → inline with text on light bg (no background)
 * - "glyph-white"  → inline with text on dark bg (no background)
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
 */
export type JurisMindContext =
  | "sidebar"
  | "header"
  | "landing"
  | "auth"
  | "chat"
  | "chip-dark"
  | "inline-light"
  | "inline-dark";

const CONTEXT_TO_VARIANT: Record<JurisMindContext, JurisMindVariant> = {
  sidebar: "sidebar",
  header: "square-navy",
  landing: "square-navy",
  auth: "square-navy",
  chat: "square-navy",
  "chip-dark": "square-white",
  "inline-light": "glyph-navy",
  "inline-dark": "glyph-white",
};

export function variantForContext(context: JurisMindContext): JurisMindVariant {
  return CONTEXT_TO_VARIANT[context];
}

export function JurisMindMark({
  className,
  size = 20,
  variant,
  context,
  rounded,
}: {
  className?: string;
  size?: number;
  /** Explicit variant. Prefer `context` unless you need a specific asset. */
  variant?: JurisMindVariant;
  /** Semantic layout context; resolves to the correct variant automatically. */
  context?: JurisMindContext;
  /** Force rounded corners. Square variants are rounded by default. */
  rounded?: boolean;
}) {
  const resolved: JurisMindVariant =
    variant ?? (context ? CONTEXT_TO_VARIANT[context] : "sidebar");
  const isSquare =
    resolved === "sidebar" || resolved === "square-navy" || resolved === "square-white";
  const shouldRound = rounded ?? isSquare;
  return (
    <img
      src={SOURCES[resolved]}
      alt="JurisMind AI"
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        "inline-block shrink-0",
        isSquare ? "object-cover" : "object-contain",
        shouldRound && "rounded-[22%]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
