import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookCopy,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Presentation,
  RefreshCw,
  
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { summarizeCase } from "@/lib/chat.functions";
import { exportSummaryDocx, exportSummaryPptx } from "@/lib/export.functions";
import { stripMarkdown } from "@/lib/strip-markdown";

export function CaseSummaryCard({
  caseId,
  caseTitle,
  summary,
  summaryUpdatedAt,
  hasReadyDocs,
  actions,
}: {
  caseId: string;
  caseTitle: string;
  summary: string | null;
  summaryUpdatedAt: string | null;
  hasReadyDocs: boolean;
  actions?: React.ReactNode;
}) {
  const summarizeFn = useServerFn(summarizeCase);
  const exportDocxFn = useServerFn(exportSummaryDocx);
  const exportPptxFn = useServerFn(exportSummaryPptx);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pptx" | null>(null);
  const [expanded, setExpanded] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      await summarizeFn({ data: { case_id: caseId } });
      await qc.invalidateQueries({ queryKey: ["case", caseId] });
      toast.success("Resumo gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no resumo");
    } finally {
      setBusy(false);
    }
  };

  const download = async (kind: "docx" | "pptx") => {
    if (!summary) return;
    setExporting(kind);
    try {
      const fn = kind === "docx" ? exportDocxFn : exportPptxFn;
      const res = await fn({
        data: {
          case_id: caseId,
          title: `Resumo - ${caseTitle}`,
          content: summary,
        },
      });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mime =
        kind === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      saveAs(new Blob([bytes], { type: mime }), res.fileName);
      toast.success(`Download iniciado: ${res.fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookCopy className="h-5 w-5 text-primary" />
              Resumo do caso (IA)
            </CardTitle>
            <CardDescription>
              {summaryUpdatedAt
                ? `Última atualização: ${new Date(summaryUpdatedAt).toLocaleString("pt-BR")}`
                : "Análise automática dos principais pontos do caso."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {summary && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generate}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Atualizar
                </Button>
                <Sheet open={expanded} onOpenChange={setExpanded}>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !summary}
                    >
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Expandir
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="flex w-full flex-col p-0 sm:max-w-3xl lg:max-w-4xl"
                  >
                    <SheetHeader className="border-b p-4">
                      <SheetTitle className="flex items-center gap-2 truncate">
                        <BookCopy className="h-5 w-5 text-primary" />
                        Resumo do caso — {caseTitle}
                      </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="min-h-0 flex-1 p-6">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {summary ? stripMarkdown(summary) : "Nenhum resumo gerado."}
                      </p>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!!exporting}>
                      {exporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => download("docx")}
                      disabled={exporting === "docx"}
                    >
                      <FileText className="mr-2 h-4 w-4" /> Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => download("pptx")}
                      disabled={exporting === "pptx"}
                    >
                      <Presentation className="mr-2 h-4 w-4" /> Apresentação (.pptx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-[140px]">
        {busy && !summary ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando documentos...
          </div>
        ) : summary ? (
          <ScrollArea className="max-h-64 pr-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {stripMarkdown(summary)}
            </p>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {hasReadyDocs
                ? "Clique abaixo para gerar um resumo com IA."
                : "Indexe documentos para gerar um resumo automático."}
            </p>
            <Button onClick={generate} disabled={busy || !hasReadyDocs}>
              <JurisMindMark size={16} context={JURISMIND_CONTEXT.inlineLight} className="mr-2" /> Gerar resumo com IA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
