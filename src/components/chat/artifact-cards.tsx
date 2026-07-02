import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  Pencil,
  Presentation,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/chat/rich-text-editor";
import { supabase } from "@/integrations/supabase/client";

async function downloadBlob(url: string, body: unknown, filename: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // segue sem branding
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    toast.error(`Falha ao gerar arquivo (${res.status})`);
    return;
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p>${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

function EditorCard({
  titulo,
  conteudo,
  icon,
  color,
}: {
  titulo: string;
  conteudo: string;
  icon: React.ReactNode;
  color: string;
}) {
  const initialHtml = useMemo(
    () => (/<\w+/.test(conteudo) ? conteudo : textToHtml(conteudo)),
    [conteudo],
  );
  const [t, setT] = useState(titulo);
  const [html, setHtml] = useState(initialHtml);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [busyDocx, setBusyDocx] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);

  const preview = useMemo(() => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 220 ? text.slice(0, 220) + "…" : text;
  }, [html]);

  return (
    <div className="mt-3 overflow-hidden rounded-md border bg-background text-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-left text-sm font-semibold hover:bg-muted"
      >
        <span className={`flex items-center gap-2 ${color}`}>
          {icon}
          <span className="text-foreground">{t || "Documento gerado"}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
          {open ? "Recolher" : "Abrir editor"}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {!open && (
        <p className="px-3 py-2 text-xs italic text-muted-foreground">{preview}</p>
      )}

      {open && (
        <div
          className={
            full ? "fixed inset-0 z-50 flex flex-col bg-background p-4" : "p-3"
          }
        >
          <div className="mb-2 flex items-center gap-2">
            <Input
              value={t}
              onChange={(e) => setT(e.target.value)}
              className="font-semibold"
              placeholder="Título"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={full ? "Restaurar" : "Tela cheia"}
              onClick={() => setFull((v) => !v)}
            >
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
          <div className={full ? "min-h-0 flex-1 overflow-auto" : ""}>
            <RichTextEditor html={html} onChange={setHtml} minHeight={full ? 600 : 360} />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {full && (
              <Button size="sm" variant="outline" onClick={() => setFull(false)}>
                Fechar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busyPdf}
              onClick={async () => {
                setBusyPdf(true);
                await downloadBlob(
                  "/api/tools/pdf",
                  { titulo: t, html },
                  `${t || "documento"}.pdf`,
                );
                setBusyPdf(false);
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button
              size="sm"
              disabled={busyDocx}
              onClick={async () => {
                setBusyDocx(true);
                await downloadBlob(
                  "/api/tools/petition",
                  { titulo: t, html },
                  `${t || "documento"}.docx`,
                );
                setBusyDocx(false);
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> Word
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PetitionCard({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <EditorCard
      titulo={titulo}
      conteudo={conteudo}
      icon={<FileText className="h-4 w-4 text-primary" />}
      color="text-primary"
    />
  );
}

export function PDFCard({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <EditorCard
      titulo={titulo}
      conteudo={conteudo}
      icon={<FileText className="h-4 w-4 text-rose-600" />}
      color="text-rose-600"
    />
  );
}

// Suppress unused-import warning for Pencil (kept for future use)
void Pencil;

export function TableCard({
  titulo,
  rows,
}: {
  titulo: string;
  rows: Array<Record<string, unknown>>;
}) {
  const [busy, setBusy] = useState(false);
  const cols = Array.from(
    new Set(rows.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : []))),
  );
  return (
    <div className="mt-3 rounded-md border bg-background p-3 text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> {titulo}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await downloadBlob(
              "/api/tools/table",
              { titulo, rows },
              `${titulo || "tabela"}.xlsx`,
            );
            setBusy(false);
          }}
        >
          <Download className="mr-1.5 h-4 w-4" /> Excel
        </Button>
      </div>
      <div className="max-h-72 overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 align-top">
                    {String(r?.[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Mostrando 50 de {rows.length} linhas — baixe o Excel para ver tudo.
        </p>
      )}
    </div>
  );
}

interface SlideData {
  title?: string;
  content?: string[];
}

export function PresentationCard({
  title,
  subtitle,
  slides,
}: {
  title: string;
  subtitle?: string;
  slides: SlideData[];
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 rounded-md border bg-background p-3 text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Presentation className="h-4 w-4 text-orange-600" /> {title}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await downloadBlob(
              "/api/tools/presentation",
              { title, subtitle, slides },
              `${title || "apresentacao"}.pptx`,
            );
            setBusy(false);
          }}
        >
          <Download className="mr-1.5 h-4 w-4" /> PPTX
        </Button>
      </div>
      {subtitle && <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>}
      <ol className="space-y-2 text-xs">
        {slides.map((s, i) => (
          <li key={i} className="rounded border bg-muted/50 p-2">
            <p className="font-semibold">
              {i + 1}. {s.title}
            </p>
            {Array.isArray(s.content) && (
              <ul className="ml-4 list-disc text-muted-foreground">
                {s.content.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
