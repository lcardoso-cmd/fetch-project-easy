import sidebarIcon from "@/assets/brain-sidebar.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * JurisMind brand mark — unified single asset.
 *
 * All variants now render the same official icon: white rounded square with
 * a navy brain silhouette. The `variant` and `rounded` props are kept for
 * backward compatibility with existing call-sites but no longer change the
 * rendered artwork.
 */
export type JurisMindVariant =
  | "sidebar"
  | "square-navy"
  | "square-white"
  | "glyph-navy"
  | "glyph-white"
  | "full";

export function JurisMindMark({
  className,
  size = 20,
  variant: _variant = "sidebar",
  rounded: _rounded = true,
}: {
  className?: string;
  size?: number;
  variant?: JurisMindVariant;
  rounded?: boolean;
}) {
  return (
    <img
      src={sidebarIcon.url}
      alt="JurisMind AI"
      width={size}
      height={size}
      loading="lazy"
      className={cn("inline-block shrink-0 object-cover rounded-[22%]", className)}
      style={{ width: size, height: size }}
    />
  );
}
