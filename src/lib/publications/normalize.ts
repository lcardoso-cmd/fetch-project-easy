/**
 * Hash determinístico (FNV-1a 64-bit) em JS puro.
 * Suficiente para deduplicação de publicações (não é criptográfico).
 * Evita importar `node:crypto` para manter o módulo isomórfico
 * (usado por código server e potencialmente bundlado pelo client via chains).
 */
function fnv1a64Hex(input: string): string {
  // Usamos BigInt para caber 64 bits.
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Normaliza CNJ para 20 dígitos numéricos, ou null. */
export function normalizeCnj(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  return digits.length >= 15 ? digits.slice(0, 20) : null;
}

export function normalizeOab(value: string, uf?: string | null): string {
  const digits = String(value).replace(/\D/g, "");
  return uf ? `${digits}/${uf.toUpperCase()}` : digits;
}

export function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function makeSnippet(content: string, maxLen = 320): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen)}…`;
}

/** Hash estável para dedupe: fonte + tribunal + data + primeiros 400 chars. */
export function publicationHash(input: {
  source: string;
  tribunal?: string | null;
  publication_date?: string | null;
  content: string;
  external_id?: string | null;
}): string {
  const key = [
    input.source,
    input.tribunal ?? "",
    input.publication_date ?? "",
    input.external_id ?? "",
    stripAccents(input.content).replace(/\s+/g, " ").slice(0, 400),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export type NormalizedPublication = {
  source: "djen" | "firecrawl" | "codilo";
  external_id: string | null;
  tribunal: string | null;
  orgao: string | null;
  publication_date: string | null; // YYYY-MM-DD
  cnj: string | null;
  content: string;
  url_original: string | null;
};

const CONNECTIVES = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);

/**
 * Gera variações normalizadas de um nome de pessoa/empresa para busca e
 * matching tolerante a acentos, caixa, conectivos e ordem inversa.
 * Ex.: "José da Silva Souza" -> ["jose da silva souza", "jose silva souza",
 *      "souza, jose da silva", "j silva souza", "jose s souza", ...]
 */
export function nameVariants(input: string): string[] {
  const base = stripAccents(input).replace(/[^\p{L}\p{N}\s,.'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!base) return [];
  const tokens = base.split(" ").filter(Boolean);
  const meaningful = tokens.filter((t) => !CONNECTIVES.has(t));
  const set = new Set<string>();
  const push = (s: string) => {
    const v = s.replace(/\s+/g, " ").trim();
    if (v.length >= 3) set.add(v);
  };

  push(base);
  push(tokens.join(" "));
  push(meaningful.join(" "));

  if (meaningful.length >= 2) {
    const first = meaningful[0];
    const last = meaningful[meaningful.length - 1];
    push(`${first} ${last}`);
    // "Sobrenome, Nome ..." (padrão de listagens forenses)
    push(`${last}, ${meaningful.slice(0, -1).join(" ")}`);
    // Abreviação do primeiro nome
    push(`${first[0]} ${meaningful.slice(1).join(" ")}`);
    // Abreviação dos meios
    if (meaningful.length >= 3) {
      const mids = meaningful.slice(1, -1).map((m) => m[0]).join(" ");
      push(`${first} ${mids} ${last}`);
    }
  }

  return Array.from(set);
}

/** Verifica se algum variante ocorre no conteúdo (comparando sem acentos). */
export function contentMatchesAnyVariant(content: string, variants: string[]): string | null {
  const c = stripAccents(content).replace(/\s+/g, " ");
  for (const v of variants) {
    if (v.length < 3) continue;
    // borda de palavra para reduzir falso-positivo
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(c)) return v;
  }
  return null;
}
