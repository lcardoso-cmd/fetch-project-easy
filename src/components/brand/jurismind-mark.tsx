import { Brain } from "lucide-react";
import brainAsset from "@/assets/jurismind-brain.png";
import { cn } from "@/lib/utils";

type Variant = "brain" | "glyph";

export function JurisMindMark({
  className,
  size = 20,
  variant = "brain",
}: {
  className?: string;
  size?: number;
  /**
   * "brain"  — navy brain PNG on transparent background (use on light surfaces / next to text).
   * "glyph"  — outlined brain icon using currentColor (use on dark surfaces / colored chips).
   */
  variant?: Variant;
  rounded?: boolean;
}) {
  if (variant === "glyph") {
    return (
      <Brain
        className={cn("shrink-0", className)}
        style={{ width: size, height: size }}
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={brainAsset}
      alt="JurisMind AI"
      width={size}
      height={size}
      loading="lazy"
      className={cn("inline-block object-contain shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
