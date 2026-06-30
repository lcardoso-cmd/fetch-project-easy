import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { toast } from "sonner";

async function downloadBlob(url: string, body: unknown, filename: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export function PetitionCard({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  const [t, setT] = useState(titulo);
  const [c, setC] = useState(conteudo);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 rounded-md border bg-background p-3 text-foreground">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-primary" /> Minuta gerada
      </div>
      <Input value={t} onChange={(e) => setT(e.target.value)} className="mb-2 font-semibold" />
      <Textarea
        value={c}
        onChange={(e) => setC(e.target.value)}
        className="min-h-[260px] font-serif text-sm leading-relaxed"
      />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await downloadBlob(
              "/api/tools/petition",
              { titulo: t, conteudo: c },
              `${t || "peticao"}.docx`,
            );
            setBusy(false);
          }}
        >
          <Download className="mr-1.5 h-4 w-4" /> Baixar Word
        </Button>
      </div>
    </div>
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
