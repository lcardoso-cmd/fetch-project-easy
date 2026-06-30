import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registerDocument } from "@/lib/documents.functions";
import { indexDocument } from "@/lib/rag.functions";
import { toast } from "sonner";

export function UploadZone({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const registerFn = useServerFn(registerDocument);
  const indexFn = useServerFn(indexDocument);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${caseId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        const doc = await registerFn({
          data: {
            case_id: caseId,
            filename: file.name,
            file_type: file.type || "application/octet-stream",
            file_size: file.size,
            storage_path: path,
          },
        });

        toast.success(`${file.name} enviado. Indexando...`);
        // Indexação roda em background — não aguarda
        indexFn({ data: { document_id: doc.id } })
          .then(() => {
            toast.success(`${file.name} indexado`);
            queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error(`Falha ao indexar ${file.name}: ${msg}`);
            queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
          });
      }
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha no upload: ${msg}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-accent bg-accent/10" : "border-border bg-muted/30"
      }`}
    >
      <UploadCloud className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="font-medium text-foreground">Arraste arquivos aqui</p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, TXT — até 20 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selecionar arquivos"}
      </Button>
    </div>
  );
}
