import {
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Presentation,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type OutputId = "analise" | "peca" | "planilha" | "apresentacao";

const OUTPUTS: {
  id: OutputId;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    id: "analise",
    label: "Análise",
    description: "Resposta com citações aos trechos dos documentos do caso",
    icon: Search,
  },
  {
    id: "peca",
    label: "Peça jurídica",
    description: "Minuta editável em Word e PDF",
    icon: FileText,
  },
  {
    id: "planilha",
    label: "Planilha",
    description: "Dados organizados em Excel, com totais e formatação",
    icon: FileSpreadsheet,
  },
  {
    id: "apresentacao",
    label: "Apresentação",
    description: "Slides executivos em PowerPoint",
    icon: Presentation,
  },
];

const OUTPUT_LABEL: Record<OutputId, string> = {
  analise: "Resposta com fontes",
  peca: "Minuta editável",
  planilha: "Planilha gerada",
  apresentacao: "Apresentação editável",
};

const REFS = [
  {
    ref: "F1",
    doc: "Cartões de ponto",
    where: "Março/2024 · linhas 12–38",
  },
  {
    ref: "F2",
    doc: "Recibos de pagamento",
    where: "p. 2 · verba 0031",
  },
  {
    ref: "F3",
    doc: "Contrato de trabalho",
    where: "p. 1 · cláusula 4ª",
  },
];

const SHEET_ROWS = [
  { c: "Janeiro/2024", reg: "22h30", pago: "08h00", dif: "14h30" },
  { c: "Fevereiro/2024", reg: "18h20", pago: "06h00", dif: "12h20" },
  { c: "Março/2024", reg: "26h40", pago: "06h00", dif: "20h40" },
];

const SLIDES = [
  "Contexto e partes",
  "Cronologia dos fatos",
  "Teses do autor",
  "Teses da defesa",
  "Evidências relevantes",
  "Riscos",
  "Estratégia recomendada",
  "Próximos passos",
];

function RefChip({ ref: r, doc, where }: { ref: string; doc: string; where: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-accent/45 bg-accent/10 px-2 py-1 text-sm font-medium text-foreground">
      <span className="font-semibold text-accent-foreground/90 dark:text-accent">[{r}]</span>
      <span className="truncate">{doc}</span>
      <span className="hidden text-muted-foreground sm:inline">· {where}</span>
    </span>
  );
}

function DemoButton({
  children,
  icon: Icon,
  variant = "outline",
}: {
  children: React.ReactNode;
  icon: typeof Download;
  variant?: "outline" | "default";
}) {
  return (
    <Button size="sm" variant={variant} type="button" tabIndex={-1} aria-hidden className="pointer-events-none">
      <Icon className="mr-1.5 h-4 w-4" />
      {children}
    </Button>
  );
}

function OutputCard({
  id,
  label,
  description,
  icon: Icon,
  actions,
  children,
}: {
  id: OutputId;
  label: string;
  description: string;
  icon: typeof FileText;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border bg-background shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-3 border-b bg-muted/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{label}</p>
            <p className="text-base text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function AnalysisOutput() {
  return (
    <OutputCard
      id="analise"
      label={OUTPUT_LABEL.analise}
      description="Resposta com citações aos trechos dos documentos do caso"
      icon={Search}
      actions={<DemoButton icon={FileText}>Abrir documento citado</DemoButton>}
    >
      <div className="rounded-xl border bg-card p-4">
        <p className="text-base leading-relaxed text-foreground">
          Os cartões de ponto registram <strong>67h30</strong> de jornada extraordinária entre
          janeiro e março de 2024 [F1], enquanto os recibos remuneram apenas <strong>20h00</strong>{" "}
          no mesmo período [F2]. Há diferença aparente de <strong>47h30</strong> a apurar.
        </p>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          A jornada contratual é de 44 horas semanais [F3], o que confirma o excesso registrado nos
          controles de ponto.
        </p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fontes utilizadas
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {REFS.map((r) => (
            <RefChip key={r.ref} ref={r.ref} doc={r.doc} where={r.where} />
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed bg-muted/30 p-3 text-base text-muted-foreground">
        <span className="font-semibold text-foreground">Ainda a confirmar: </span>
        os cartões de abril e maio não estão no acervo; o cálculo consolidado depende desses
        documentos.
      </p>
    </OutputCard>
  );
}

function SheetOutput() {
  return (
    <OutputCard
      id="planilha"
      label={OUTPUT_LABEL.planilha}
      description="Dados organizados em Excel, com totais e formatação"
      icon={FileSpreadsheet}
      actions={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm font-medium text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4 text-accent-foreground/80 dark:text-accent" />
            .xlsx
          </span>
          <DemoButton icon={Download} variant="default">
            Baixar Excel
          </DemoButton>
        </>
      }
    >
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-base">
          <caption className="sr-only">
            Comparativo fictício entre horas registradas e horas pagas
          </caption>
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th scope="col" className="border border-primary/60 px-3 py-2 text-left font-semibold">
                Competência
              </th>
              <th scope="col" className="border border-primary/60 px-3 py-2 text-right font-semibold">
                Horas registradas
              </th>
              <th scope="col" className="border border-primary/60 px-3 py-2 text-right font-semibold">
                Horas pagas
              </th>
              <th scope="col" className="border border-primary/60 px-3 py-2 text-right font-semibold">
                Diferença
              </th>
            </tr>
          </thead>
          <tbody>
            {SHEET_ROWS.map((r, i) => (
              <tr key={r.c} className={i % 2 ? "bg-muted/40" : "bg-background"}>
                <td className="border px-3 py-2 text-foreground">{r.c}</td>
                <td className="border px-3 py-2 text-right tabular-nums text-foreground">{r.reg}</td>
                <td className="border px-3 py-2 text-right tabular-nums text-foreground">{r.pago}</td>
                <td className="border px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                  {r.dif}
                </td>
              </tr>
            ))}
            <tr className="bg-accent/15">
              <td className="border border-accent/40 px-3 py-2 font-bold text-foreground">Total</td>
              <td className="border border-accent/40 px-3 py-2 text-right font-bold tabular-nums text-foreground">
                67h30
              </td>
              <td className="border border-accent/40 px-3 py-2 text-right font-bold tabular-nums text-foreground">
                20h00
              </td>
              <td className="border border-accent/40 px-3 py-2 text-right font-bold tabular-nums text-foreground">
                47h30
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {REFS.slice(0, 2).map((r) => (
          <RefChip key={r.ref} ref={r.ref} doc={r.doc} where={r.where} />
        ))}
      </div>
    </OutputCard>
  );
}

function PetitionOutput() {
  return (
    <OutputCard
      id="peca"
      label={OUTPUT_LABEL.peca}
      description="Minuta editável em Word e PDF"
      icon={FileText}
      actions={
        <>
          <DemoButton icon={Pencil}>Abrir editor</DemoButton>
          <DemoButton icon={Download}>Baixar PDF</DemoButton>
          <DemoButton icon={Download} variant="default">
            Baixar Word
          </DemoButton>
        </>
      }
    >
      <div className="mx-auto max-w-[640px] rounded-lg border bg-background p-5 shadow-inner sm:p-8">
        <div className="border-b pb-3 text-center">
          <p className="font-heading text-base font-bold tracking-tight text-foreground">
            Silva &amp; Associados — Advocacia
          </p>
          <p className="text-sm text-muted-foreground">
            Rua Exemplo, 100 · São Paulo/SP · contato@exemplo.adv.br
          </p>
        </div>

        <p className="mt-6 text-center font-heading text-lg font-bold uppercase tracking-wide text-foreground">
          Contestação
        </p>

        <p className="mt-6 text-base leading-relaxed text-foreground">
          Ao Juízo da 12ª Vara do Trabalho de São Paulo/SP
        </p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Reclamação Trabalhista nº 0001234-56.2024.5.02.0012
          <br />
          Reclamante: João da Silva · Reclamada: Comercial Aurora Ltda.
        </p>

        <p className="mt-6 font-heading text-base font-bold text-foreground">
          I — Síntese dos fatos
        </p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          O reclamante afirma ter prestado jornada superior à contratual sem a devida remuneração.
          Os controles de ponto juntados aos autos indicam variações mensais de jornada, adiante
          confrontadas com os recibos de pagamento.{" "}
          <span className="text-muted-foreground">(cartões de ponto, jan–mar/2024)</span>
        </p>

        <p className="mt-5 font-heading text-base font-bold text-foreground">II — Do mérito</p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          A jornada contratada foi de 44 horas semanais, com compensação prevista em acordo
          individual. As horas excedentes efetivamente apuradas foram quitadas nas competências
          próprias, conforme rubrica específica dos recibos.{" "}
          <span className="text-muted-foreground">(recibos, p. 2 · verba 0031)</span>
        </p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          Eventual diferença remanescente, se reconhecida, deve limitar-se aos períodos
          documentalmente comprovados, afastando-se a pretensão de arbitramento genérico.
        </p>

        <p className="mt-5 font-heading text-base font-bold text-foreground">III — Dos pedidos</p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          Requer-se a improcedência dos pedidos ou, subsidiariamente, a limitação da condenação às
          diferenças efetivamente apuradas nos documentos dos autos.
        </p>

        <div className="mt-8 flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
          <span>Silva &amp; Associados · Documento gerado no JurisMind</span>
          <span>1</span>
        </div>
      </div>
    </OutputCard>
  );
}

function PresentationOutput() {
  return (
    <OutputCard
      id="apresentacao"
      label={OUTPUT_LABEL.apresentacao}
      description="Slides executivos em PowerPoint"
      icon={Presentation}
      actions={
        <>
          <DemoButton icon={Pencil}>Abrir editor</DemoButton>
          <DemoButton icon={Download} variant="default">
            Baixar PowerPoint
          </DemoButton>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="aspect-video overflow-hidden rounded-xl bg-primary p-5 text-primary-foreground sm:p-7">
          <div className="flex h-full flex-col justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              JurisMind AI · B2B Consulting
            </p>
            <div>
              <p className="font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
                Análise executiva do caso
              </p>
              <p className="mt-2 text-base text-primary-foreground/85">
                Reclamação Trabalhista nº 0001234-56.2024.5.02.0012
              </p>
            </div>
            <div className="h-1 w-24 rounded-full bg-accent" />
          </div>
        </div>

        <ul className="grid grid-cols-2 content-start gap-2">
          {SLIDES.slice(0, 4).map((s, i) => (
            <li
              key={s}
              className="flex aspect-video flex-col justify-between rounded-lg border border-primary/25 bg-primary/90 p-2.5 text-primary-foreground"
            >
              <span className="text-sm font-semibold text-accent">{String(i + 2).padStart(2, "0")}</span>
              <span className="text-sm font-medium leading-snug">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {SLIDES.slice(4).map((s, i) => (
          <li
            key={s}
            className="rounded-md border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground"
          >
            {String(i + 6).padStart(2, "0")} · {s}
          </li>
        ))}
      </ul>
    </OutputCard>
  );
}

export function OutputShowcase() {
  return (
    <div className="space-y-8">
      <AnalysisOutput />
      <PetitionOutput />
      <SheetOutput />
      <PresentationOutput />
    </div>
  );
}
