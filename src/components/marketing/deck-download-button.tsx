import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DECK_URL = "/api/public/deck";
const FILE_NAME = "JurisMind-Apresentacao.pdf";

export function DeckDownloadButton({
  className,
  size = "lg",
  variant = "outline",
  label = "Baixar apresentação (PDF)",
}: {
  className?: string;
  size?: "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(DECK_URL);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível preparar a apresentação agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handleDownload}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="mr-2 h-4 w-4" aria-hidden />
      )}
      {loading ? "Gerando apresentação…" : label}
    </Button>
  );
}
