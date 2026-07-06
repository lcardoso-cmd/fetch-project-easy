/**
 * Conversor Markdown → HTML minimalista para alimentar o RichTextEditor
 * a partir do texto gerado pela IA de marketing. Cobre: headings (# ##
 * ###), negrito (**x** / __x__), itálico (*x* / _x_), listas (- / *  / 1.),
 * quebras de parágrafo por linha em branco, quebras de linha simples,
 * hashtags e URLs deixadas como texto (o editor sanitiza depois).
 *
 * Não é um parser completo — o objetivo é apenas rearranjar o output em
 * blocos editáveis sem instalar deps novas. Se o modelo já retornar HTML,
 * devolve como está.
 */
export function markdownToHtml(input: string): string {
  if (!input) return "";
  const src = input.trim();
  if (/<\w+[^>]*>/.test(src)) return src;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) => {
    let out = esc(s);
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
    out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");
    return out;
  };

  const lines = src.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i++;
      continue;
    }
    // Heading
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const level = Math.min(3, h[1].length); // capa em h3 para o editor
      blocks.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    // Lista não ordenada
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    // Lista ordenada
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    // Parágrafo: junta linhas até uma vazia
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*+]\s|\d+\.\s)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(`<p>${inline(para.join("<br>"))}</p>`);
  }
  return blocks.join("\n");
}
