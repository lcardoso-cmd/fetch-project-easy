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
