import { useEffect, useMemo, useState } from "react";
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
  Presentation,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/chat/rich-text-editor";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

/** Cabeçalho comum a todos os materiais gerados. */
function ArtifactHeader({
  icon,
  kindLabel,
  title,
  actions,
}: {
  icon: React.ReactNode;
  kindLabel: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-muted/50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            {kindLabel}
          </span>
          <span className="block truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
        </span>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Divide o HTML da minuta em blocos legíveis para a prévia em folha A4. */
function previewBlocks(html: string) {
  const parts = html
    .split(/<\/(?:p|h1|h2|h3|li|div)>/i)
    .map((chunk) => {
      const heading = /<(h1|h2|h3)[^>]*>/i.test(chunk);
      const text = stripHtml(chunk);
      return { heading, text };
    })
    .filter((b) => b.text.length > 0);
  return parts.slice(0, 8);
}

function EditorCard({
  titulo,
  conteudo,
  kindLabel,
  icon,
}: {
  titulo: string;
  conteudo: string;
  kindLabel: string;
  icon: React.ReactNode;
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

  useEffect(() => {
    setT(titulo);
    setHtml(initialHtml);
  }, [titulo, initialHtml]);

  const blocks = useMemo(() => previewBlocks(html), [html]);

  const downloadPdf = async () => {
    setBusyPdf(true);
    await downloadBlob("/api/tools/pdf", { titulo: t, html }, `${t || "documento"}.pdf`);
    setBusyPdf(false);
  };
  const downloadDocx = async () => {
    setBusyDocx(true);
    await downloadBlob("/api/tools/petition", { titulo: t, html }, `${t || "documento"}.docx`);
    setBusyDocx(false);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-background text-foreground shadow-sm">
      <ArtifactHeader
        icon={icon}
        kindLabel={kindLabel}
        title={t || "Documento gerado"}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
              {open ? (
                <>
                  <ChevronUp className="mr-1.5 h-4 w-4" /> Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1.5 h-4 w-4" /> Abrir editor
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" disabled={busyPdf} onClick={downloadPdf}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
            </Button>
            <Button size="sm" disabled={busyDocx} onClick={downloadDocx}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar Word
            </Button>
          </>
        }
      />

      {!open && (
        <div className="bg-muted/30 p-4">
          {/* Prévia em folha A4 */}
          <div className="mx-auto w-full max-w-[560px] rounded-md border bg-card px-6 py-6 shadow-sm">
            <p className="text-center text-[15px] font-semibold uppercase tracking-wide text-foreground">
              {t || "Minuta"}
            </p>
            <div className="mt-4 space-y-2.5">
              {blocks.map((b, i) => (
                <p
                  key={i}
                  className={cn(
                    "text-[15px] leading-relaxed",
                    b.heading
                      ? "font-semibold uppercase tracking-wide text-foreground"
                      : "text-justify text-muted-foreground",
                  )}
                >
                  {b.text.length > 300 ? `${b.text.slice(0, 300)}…` : b.text}
                </p>
              ))}
              {blocks.length === 0 && (
                <p className="text-[15px] text-muted-foreground">Minuta sem conteúdo.</p>
              )}
            </div>
            <p className="mt-5 border-t pt-2 text-right text-[13px] text-muted-foreground">
              Minuta editável · página 1
            </p>
          </div>
        </div>
      )}

      {open && (
        <div className={full ? "fixed inset-0 z-50 flex flex-col bg-background p-4" : "p-4"}>
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
            <Button size="sm" variant="outline" disabled={busyPdf} onClick={downloadPdf}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
            </Button>
            <Button size="sm" disabled={busyDocx} onClick={downloadDocx}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar Word
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
      kindLabel="Peça jurídica · minuta editável"
      icon={<FileText className="h-4 w-4" />}
    />
  );
}

export function PDFCard({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <EditorCard
      titulo={titulo}
      conteudo={conteudo}
      kindLabel="Documento · minuta editável"
      icon={<FileText className="h-4 w-4" />}
    />
  );
}

function isNumericCell(value: string) {
  return /^[-+]?[\d.,]+(?:\s*%|h(?:\d{2})?)?$/.test(value.trim()) && /\d/.test(value);
}

function isTotalRow(row: Record<string, unknown>) {
  return Object.values(row).some(
    (v) => typeof v === "string" && /^\s*total/i.test(v),
  );
}

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
  const visible = rows.slice(0, 50);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-background text-foreground shadow-sm">
      <ArtifactHeader
        icon={<FileSpreadsheet className="h-4 w-4" />}
        kindLabel="Planilha gerada"
        title={titulo || "Planilha"}
        actions={
          <Button
            size="sm"
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
            <Download className="mr-1.5 h-4 w-4" /> Baixar Excel
          </Button>
        }
      />
      <div className="max-h-80 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-[15px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="border-b border-r px-3 py-2 text-left font-semibold text-foreground last:border-r-0"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const total = isTotalRow(r);
              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b",
                    total ? "bg-primary/5 font-semibold" : i % 2 === 1 ? "bg-muted/30" : undefined,
                  )}
                >
                  {cols.map((c) => {
                    const value = String(r?.[c] ?? "");
                    return (
                      <td
                        key={c}
                        className={cn(
                          "border-r px-3 py-2 align-top tabular-nums last:border-r-0",
                          isNumericCell(value) ? "text-right" : "text-left",
                        )}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && (
        <p className="border-t px-4 py-2 text-[13px] text-muted-foreground">
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
  const [active, setActive] = useState(0);
  const current = slides[active] ?? slides[0];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-background text-foreground shadow-sm">
      <ArtifactHeader
        icon={<Presentation className="h-4 w-4" />}
        kindLabel="Apresentação editável"
        title={title || "Apresentação"}
        actions={
          <Button
            size="sm"
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
            <Download className="mr-1.5 h-4 w-4" /> Baixar PowerPoint
          </Button>
        }
      />
      <div className="space-y-3 bg-muted/30 p-4">
        {/* Lâmina principal 16:9 */}
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-[#000038] p-5 text-white">
          <p className="text-[13px] uppercase tracking-[0.14em] text-[#00FFFF]">
            {active === 0 ? subtitle || "Apresentação" : `Slide ${active + 1}`}
          </p>
          <p className="mt-2 font-heading text-[19px] font-semibold leading-snug sm:text-[22px]">
            {current?.title ?? title}
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] text-white/85">
            {(current?.content ?? []).slice(0, 5).map((b, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="text-[#00FFFF]">
                  —
                </span>
                <span className="min-w-0">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Miniaturas */}
        {slides.length > 1 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-current={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  "flex aspect-video flex-col justify-between rounded-md border p-2 text-left text-[13px] transition",
                  i === active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="line-clamp-3 font-medium">{s.title ?? `Slide ${i + 1}`}</span>
                <span className="text-[13px] opacity-70">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
