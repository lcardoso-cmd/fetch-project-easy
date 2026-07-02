import squareNavy from "@/assets/brain-square-navy.png.asset.json";
import squareWhite from "@/assets/brain-square-white.png.asset.json";
import glyphNavy from "@/assets/brain-glyph-navy.png.asset.json";
import glyphWhite from "@/assets/brain-glyph-white.png.asset.json";
import fullLogo from "@/assets/jurismind-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * JurisMind brand mark — 5 official variants, all derived from the same brain icon.
 *
 * - "square-navy"  : navy square + white brain (use on light backgrounds, standalone)
 * - "square-white" : white square + navy brain (use on dark/colored backgrounds, standalone)
 * - "glyph-navy"   : brain only, navy on transparent (use next to text on light bg)
 * - "glyph-white"  : brain only, white on transparent (use next to text on dark bg / colored chips)
 * - "full"         : complete boxed logo with "B2B | JurisMind AI" text (use ONLY alone, never next to the text)
 */
export type JurisMindVariant =
  | "square-navy"
  | "square-white"
  | "glyph-navy"
  | "glyph-white"
  | "full";

const SOURCES: Record<JurisMindVariant, string> = {
  "square-navy": squareNavy.url,
  "square-white": squareWhite.url,
  "glyph-navy": glyphNavy.url,
  "glyph-white": glyphWhite.url,
  full: fullLogo.url,
};

export function JurisMindMark({
  className,
  size = 20,
  variant = "glyph-navy",
  rounded = false,
}: {
  className?: string;
  size?: number;
  variant?: JurisMindVariant;
  /** Round the corners (useful for square variants used as app icons). */
  rounded?: boolean;
}) {
  const src = SOURCES[variant];
  const isSquare = variant.startsWith("square") || variant === "full";
  return (
    <img
      src={src}
      alt="JurisMind AI"
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        "inline-block shrink-0",
        isSquare ? "object-cover" : "object-contain",
        rounded && "rounded-[22%]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
