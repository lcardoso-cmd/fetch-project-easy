import type { PracticeType } from "@/lib/profile.functions";

export type MatterKind = "processo" | "pericia" | "assistencia_tecnica";

/** Vocabulário adaptado por perfil profissional / tipo de matéria. */
export type PracticeLabels = {
  /** Substantivo singular usado para a entidade principal. */
  entitySingular: string;
  /** Substantivo plural. */
  entityPlural: string;
  /** Substantivo da pessoa/órgão vinculado (cliente / parte assistida...). */
  clientLabel: string;
  /** Verbo de relação com a parte ("Represento" / "Assisto"). */
  representVerb: string;
  /** Saída esperada (peça / laudo / parecer). */
  outputLabel: string;
  /** Rótulo curto para badge. */
  shortBadge: string;
};

const BY_MATTER: Record<MatterKind, PracticeLabels> = {
  processo: {
    entitySingular: "Caso",
    entityPlural: "Casos",
    clientLabel: "Cliente",
    representVerb: "Represento",
    outputLabel: "Petição",
    shortBadge: "Processo",
  },
  pericia: {
    entitySingular: "Perícia",
    entityPlural: "Perícias",
    clientLabel: "Órgão nomeante",
    representVerb: "Atuo como perito",
    outputLabel: "Laudo pericial",
    shortBadge: "Perícia",
  },
  assistencia_tecnica: {
    entitySingular: "Assistência",
    entityPlural: "Assistências",
    clientLabel: "Parte assistida",
    representVerb: "Assisto",
    outputLabel: "Parecer técnico",
    shortBadge: "Assistência",
  },
};

/** Tipo de matéria padrão sugerido a partir do perfil principal. */
export function defaultMatterKindFor(practice: PracticeType | null | undefined): MatterKind {
  if (practice === "perito_judicial") return "pericia";
  if (practice === "assistente_tecnico") return "assistencia_tecnica";
  return "processo";
}

export function labelsForMatter(kind: MatterKind): PracticeLabels {
  return BY_MATTER[kind] ?? BY_MATTER.processo;
}




