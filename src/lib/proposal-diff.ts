import { diffWordsWithSpace } from "diff";

// Extrai texto legível de HTML preservando quebras de bloco.
export function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<br\s*\/?>(?!$)/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Adiciona quebra após elementos de bloco para o innerText do jsdom-like
  tmp.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, tr, br").forEach((el) => {
    el.append("\n");
  });
  return (tmp.textContent ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Retorna HTML com <ins> (verde) e <del> (vermelho) marcando diferenças
// palavra a palavra entre o texto normalizado de a e b.
export function diffHtml(a: string, b: string): string {
  const parts = diffWordsWithSpace(htmlToText(a), htmlToText(b));
  return parts
    .map((p) => {
      const safe = esc(p.value).replace(/\n/g, "<br/>");
      if (p.added) {
        return `<ins style="background:#dcfce7;color:#065f46;text-decoration:none;padding:0 2px;border-radius:2px">${safe}</ins>`;
      }
      if (p.removed) {
        return `<del style="background:#fee2e2;color:#991b1b;text-decoration:line-through;padding:0 2px;border-radius:2px">${safe}</del>`;
      }
      return safe;
    })
    .join("");
}

// Diff campo a campo entre dois formulários (objetos simples).
export function diffForms<T extends Record<string, unknown>>(
  a: T,
  b: T,
): Array<{ field: string; from: string; to: string }> {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const out: Array<{ field: string; from: string; to: string }> = [];
  for (const k of keys) {
    const av = String(a?.[k] ?? "");
    const bv = String(b?.[k] ?? "");
    if (av !== bv) out.push({ field: k, from: av, to: bv });
  }
  return out.sort((x, y) => x.field.localeCompare(y.field));
}
