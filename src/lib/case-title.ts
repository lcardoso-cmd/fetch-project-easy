import type { MatterKind } from "@/lib/practice-labels";

type PartyLike = { name?: string | null; relation?: string | null };

/**
 * Regras do caption padrão pedido pelo usuário:
 * - Assistência técnica: "{assistido} vs {contrária}"
 * - Perícia: "{réu/requerida} vs {autor/requerente}"
 * - Processo: "{cliente} vs {contrária}"
 *
 * Em todos os casos: Parte1 é a "assistida/requerida/cliente" e Parte2 é a
 * "contrária/requerente" — independente de qual lado seja o do usuário.
 *
 * Retorna null quando falta qualquer um dos dois nomes.
 */
export function buildCaseTitle(
  matter: MatterKind,
  parties: PartyLike[],
): string | null {
  const clean = (parties ?? []).filter((p) => (p?.name ?? "").trim());
  const byRel = (rel: string) =>
    clean.find((p) => p.relation === rel)?.name?.trim() ?? null;

  let left: string | null = null;
  let right: string | null = null;

  if (matter === "assistencia_tecnica") {
    left = byRel("assistido");
    right = byRel("contraria");
  } else if (matter === "pericia") {
    left = byRel("reu");
    right = byRel("autor");
  } else {
    // processo
    left = byRel("cliente");
    right = byRel("contraria");
  }

  if (!left || !right) return null;
  return `${left} vs ${right}`;
}
