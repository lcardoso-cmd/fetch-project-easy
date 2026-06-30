import type { MatterKind } from "@/lib/practice-labels";

export type PartyRelationOption = {
  value: string;
  label: string;
  /** Relação que indica "a parte por quem eu atuo" — usada para derivar represented_party / assisted_party_name. */
  isRepresented?: boolean;
};

export const PARTY_RELATIONS: Record<MatterKind, PartyRelationOption[]> = {
  processo: [
    { value: "cliente", label: "Meu cliente", isRepresented: true },
    { value: "contraria", label: "Parte contrária" },
    { value: "litisconsorte", label: "Litisconsorte" },
    { value: "terceiro", label: "Terceiro interessado" },
    { value: "advogado_adverso", label: "Advogado adverso" },
    { value: "perito_juizo", label: "Perito do juízo" },
    { value: "assistente_contrario", label: "Assistente técnico contrário" },
    { value: "outro", label: "Outro" },
  ],
  pericia: [
    { value: "nomeante", label: "Juízo nomeante", isRepresented: true },
    { value: "autor", label: "Autor" },
    { value: "reu", label: "Réu" },
    { value: "advogado_autor", label: "Advogado do autor" },
    { value: "advogado_reu", label: "Advogado do réu" },
    { value: "assistente_autor", label: "Assistente técnico do autor" },
    { value: "assistente_reu", label: "Assistente técnico do réu" },
    { value: "outro", label: "Outro" },
  ],
  assistencia_tecnica: [
    { value: "assistido", label: "Parte que assisto", isRepresented: true },
    { value: "contraria", label: "Parte contrária" },
    { value: "advogado_assistido", label: "Advogado da parte assistida" },
    { value: "advogado_contrario", label: "Advogado contrário" },
    { value: "perito_juizo", label: "Perito do juízo" },
    { value: "assistente_contrario", label: "Assistente técnico contrário" },
    { value: "outro", label: "Outro" },
  ],
};

export function relationLabel(matter: MatterKind, value: string | null | undefined): string {
  if (!value) return "";
  return PARTY_RELATIONS[matter]?.find((r) => r.value === value)?.label ?? value;
}

export function representedRelationFor(matter: MatterKind): string | null {
  return PARTY_RELATIONS[matter]?.find((r) => r.isRepresented)?.value ?? null;
}

/**
 * Heurística para inferir a relação de uma parte a partir do papel/nome
 * extraído do documento (ex.: "perito", "requerente", "réu").
 * Retorna null se não houver match confiável — UI marca como "Classificar".
 */
export function guessRelation(
  party: { role?: string | null; name?: string | null },
  matter: MatterKind,
): string | null {
  const hay = `${party.role ?? ""} ${party.name ?? ""}`.toLowerCase();
  if (!hay.trim()) return null;

  const has = (...needles: string[]) => needles.some((n) => hay.includes(n));

  // Perito do juízo aparece em qualquer matéria
  if (has("perito") && !has("assistente")) {
    if (matter === "pericia") return null; // o próprio usuário é o perito
    return "perito_juizo";
  }

  if (matter === "processo") {
    if (has("requerente", "autor", "exequente", "reclamante", "demandante")) return "cliente";
    if (has("requerido", "réu", "reu", "executado", "reclamado", "demandado")) return "contraria";
    if (has("litisconsorte")) return "litisconsorte";
    if (has("terceiro")) return "terceiro";
    if (has("advogado") && has("adverso", "contrário", "contrario")) return "advogado_adverso";
    if (has("assistente técnico", "assistente tecnico")) return "assistente_contrario";
  }

  if (matter === "pericia") {
    if (has("requerente", "autor", "exequente", "reclamante")) return "autor";
    if (has("requerido", "réu", "reu", "executado", "reclamado")) return "reu";
    if (has("juiz", "juízo", "juizo", "vara", "tribunal")) return "nomeante";
    if (has("assistente") && has("autor", "requerente", "reclamante")) return "assistente_autor";
    if (has("assistente") && has("réu", "reu", "requerido", "reclamado")) return "assistente_reu";
    if (has("advogado") && has("autor", "requerente")) return "advogado_autor";
    if (has("advogado") && has("réu", "reu", "requerido")) return "advogado_reu";
  }

  if (matter === "assistencia_tecnica") {
    if (has("assistido")) return "assistido";
    if (has("contrária", "contraria", "adverso")) return "contraria";
    if (has("assistente técnico", "assistente tecnico")) return "assistente_contrario";
    if (has("advogado")) return "advogado_assistido";
  }

  return null;
}
