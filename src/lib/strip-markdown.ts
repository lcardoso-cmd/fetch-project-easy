// Strip common Markdown syntax so generated text renders as clean prose.
export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  // Code fences and inline code
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim());
  s = s.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) and links [text](url)
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Headings: # Title -> Title
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Blockquotes
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  // Bold/italic/strike
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1$2");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  // List bullets / numbered
  s = s.replace(/^\s*[-*+]\s+/gm, "• ");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  // Horizontal rules
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
  // Collapse extra blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
