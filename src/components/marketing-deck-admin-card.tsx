import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "marketing-deck";
const OBJECT = "deck.pdf";
const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

export function MarketingDeckAdminCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (limite de 40 MB).");
      return;
    }
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(OBJECT, file, {
          upsert: true,
          contentType: "application/pdf",
          cacheControl: "no-cache",
        });
      if (error) throw error;
      toast.success("Deck atualizado. O botão da homepage já baixa a nova versão.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar o arquivo.";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Deck de marketing (B2B)
        </CardTitle>
        <CardDescription>
          Substitui o PDF disponível no botão “Baixar deck” da homepage. Visível
          apenas para super administradores da B2B.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            size="sm"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Enviar novo deck (PDF)
              </>
            )}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/api/public/marketing-deck" target="_blank" rel="noreferrer">
              Ver deck atual
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O arquivo é armazenado em bucket privado e servido por link temporário
          gerado pelo servidor.
        </p>
      </CardContent>
    </Card>
  );
}
