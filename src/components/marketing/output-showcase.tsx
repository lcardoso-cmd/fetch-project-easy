import { useId, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Presentation,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Demonstrador público do produto — DADOS FICTÍCIOS.
 *
 * Um único caso (Reclamação Trabalhista — Maria Silva) evolui por cinco etapas:
 * localizar, organizar, produzir, apresentar e conduzir. O visitante escolhe a
 * etapa; nada avança sozinho e nenhum botão dispara download real.
 */

type StageId = "analisar" | "planilha" | "peca" | "apresentacao" | "tarefa";

const STAGES: {
  id: StageId;
  step: string;
  label: string;
  stage: string;
  icon: typeof FileText;
  command: string;
  format: string;
}[] = [
  {
    id: "analisar",
    step: "01",
    label: "Analisar",
    stage: "Localizar",
    icon: Search,
    command: "Compare os cartões de ponto com os recibos e identifique as diferenças.",
    format: "Análise com fontes",
  },
  {
    id: "planilha",
    step: "02",
    label: "Gerar Excel",
    stage: "Organizar",
    icon: FileSpreadsheet,
    command: "Transforme a apuração em uma planilha comparativa.",
    format: "Planilha .xlsx",
  },
  {
    id: "peca",
    step: "03",
    label: "Criar peça",
    stage: "Produzir",
    icon: FileText,
    command: "Redija uma contestação considerando os documentos e a apuração.",
    format: "Word .docx e PDF",
  },
  {
    id: "apresentacao",
    step: "04",
    label: "Criar apresentação",
    stage: "Apresentar",
    icon: Presentation,
    command: "Prepare uma apresentação executiva para a reunião com o cliente.",
    format: "PowerPoint .pptx",
  },
  {
    id: "tarefa",
    step: "05",
    label: "Criar tarefa",
    stage: "Conduzir",
    icon: CalendarClock,
    command: "Crie uma tarefa para revisar a contestação até sexta-feira.",
    format: "Tarefa vinculada ao caso",
  },
];

const REFS = [
  { ref: "F1", doc: "Cartões de ponto", where: "Março/2024 · linhas 12–38" },
  { ref: "F2", doc: "Recibos de pagamento", where: "p. 2 · verba 0031" },
  { ref: "F3", doc: "Contrato de trabalho", where: "p. 1 · cláusula 4ª" },
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

/** Botão ilustrativo: mostra a ação real do produto, sem efeito na vitrine. */
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
    <Button
      size="sm"
      variant={variant}
      type="button"
      tabIndex={-1}
      aria-hidden
      className="pointer-events-none"
    >
      <Icon className="mr-1.5 h-4 w-4" />
      {children}
    </Button>
  );
}

function AnalysisOutput() {
  return (
    <>
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
        <span className="font-semibold text-foreground">Documentos que faltam: </span>
        os cartões de abril e maio não estão no acervo; o cálculo consolidado depende desses
        documentos.
      </p>
    </>
  );
}

function SheetOutput() {
  return (
    <>
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
    </>
  );
}

function PetitionOutput() {
  return (
    <>
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
          Reclamante: Maria Silva · Reclamada: Comercial Aurora Ltda.
        </p>

        <p className="mt-6 font-heading text-base font-bold text-foreground">
          I — Síntese dos fatos
        </p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          A reclamante afirma ter prestado jornada superior à contratual sem a devida remuneração.
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {REFS.map((r) => (
          <RefChip key={r.ref} ref={r.ref} doc={r.doc} where={r.where} />
        ))}
      </div>
    </>
  );
}

function PresentationOutput() {
  return (
    <>
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
              <span className="text-sm font-semibold text-accent">
                {String(i + 2).padStart(2, "0")}
              </span>
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
    </>
  );
}

function TaskOutput() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground dark:text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="font-heading text-lg font-bold text-foreground">
            Revisar minuta de contestação
          </p>
          <p className="text-base text-muted-foreground">
            Criada pelo chat, já vinculada ao caso — aparece nas tarefas e na agenda da equipe.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { t: "Responsável", d: "Dra. Helena Prado" },
          { t: "Prazo", d: "Sexta-feira, 18h" },
          { t: "Caso vinculado", d: "Reclamação Trabalhista — Maria Silva" },
        ].map((i) => (
          <div key={i.t} className="rounded-lg border bg-background p-3">
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {i.t}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">{i.d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StageActions({ id }: { id: StageId }) {
  if (id === "analisar") return <DemoButton icon={FileText}>Abrir documento citado</DemoButton>;
  if (id === "planilha")
    return (
      <DemoButton icon={Download} variant="default">
        Baixar Excel
      </DemoButton>
    );
  if (id === "peca")
    return (
      <>
        <DemoButton icon={Pencil}>Abrir editor</DemoButton>
        <DemoButton icon={Download}>Baixar PDF</DemoButton>
        <DemoButton icon={Download} variant="default">
          Baixar Word
        </DemoButton>
      </>
    );
  if (id === "apresentacao")
    return (
      <>
        <DemoButton icon={Pencil}>Abrir editor</DemoButton>
        <DemoButton icon={Download} variant="default">
          Baixar PowerPoint
        </DemoButton>
      </>
    );
  return <DemoButton icon={CalendarClock}>Ver nas tarefas do caso</DemoButton>;
}

function StageResult({ id }: { id: StageId }) {
  if (id === "analisar") return <AnalysisOutput />;
  if (id === "planilha") return <SheetOutput />;
  if (id === "peca") return <PetitionOutput />;
  if (id === "apresentacao") return <PresentationOutput />;
  return <TaskOutput />;
}

export function OutputShowcase() {
  const [active, setActive] = useState<StageId>("analisar");
  const baseId = useId();
  const stage = STAGES.find((s) => s.id === active) ?? STAGES[0]!;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = STAGES.findIndex((s) => s.id === active);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? (i + 1) % STAGES.length : (i - 1 + STAGES.length) % STAGES.length;
      const target = STAGES[next]!;
      setActive(target.id);
      document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    }
  };

  return (
    <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">
            Caso: Reclamação Trabalhista — Maria Silva
          </p>
          <p className="text-base text-muted-foreground">
            5 documentos indexados · Demonstração com dados fictícios
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-accent-foreground/90 dark:text-accent" aria-hidden />
          Fontes prontas
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Etapas do mesmo caso"
        onKeyDown={onKeyDown}
        className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {STAGES.map((s) => {
          const selected = s.id === active;
          return (
            <button
              key={s.id}
              id={`${baseId}-tab-${s.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-foreground hover:border-primary/40"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold uppercase tracking-wide opacity-80">
                  {s.step} · {s.stage}
                </span>
                <span className="block text-base font-semibold">{s.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${stage.id}`}
        tabIndex={0}
        className="mt-5 overflow-hidden rounded-2xl border bg-background"
      >
        <div className="border-b bg-muted/40 px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Comando do advogado
          </p>
          <p className="mt-1 text-lg font-medium text-foreground">“{stage.command}”</p>
          <p className="mt-2 text-base text-muted-foreground">
            O JurisMind consulta os documentos deste caso antes de produzir · Entrega:{" "}
            <strong className="text-foreground">{stage.format}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StageActions id={stage.id} />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <StageResult id={stage.id} />
        </div>
      </div>

      <p className="mt-4 text-base text-muted-foreground">
        Uma mesma base documental pode se transformar em evidência, análise, peça, planilha,
        apresentação e ação da equipe.
      </p>
    </div>
  );
}
