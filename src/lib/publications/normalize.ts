import { createHash } from "crypto";

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
