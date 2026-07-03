import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitiza HTML gerado por IA antes de renderizar via
 * `dangerouslySetInnerHTML`. Permite apenas tags de formatação
 * seguras e remove `<script>`, event handlers (`onclick`, ...) e
 * URLs `javascript:` / `data:` executáveis.
 */
export function sanitizeProposalHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(String(input), {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "span", "div",
      "ul", "ol", "li",
      "b", "i", "strong", "em", "u", "s", "sub", "sup",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "a",
    ],
    ALLOWED_ATTR: ["href", "title", "colspan", "rowspan", "align", "class"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style", "srcset", "onerror", "onload", "onclick"],
  });
}
