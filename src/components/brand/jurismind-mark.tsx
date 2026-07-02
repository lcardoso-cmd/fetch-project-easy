import logoAsset from "@/assets/jurismind-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function JurisMindMark({
  className,
  size = 20,
  rounded = true,
}: {
  className?: string;
  size?: number;
  rounded?: boolean;
}) {
  return (
    <img
      src={logoAsset.url}
      alt="B2B | JurisMind AI"
      width={size}
      height={size}
      className={cn(
        "inline-block object-cover shrink-0",
        rounded && "rounded-[20%]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
