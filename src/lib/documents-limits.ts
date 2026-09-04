/**
 * Fonte única de verdade dos limites e formatos aceitos no envio de documentos.
 * Importado tanto pelo cliente (validação imediata do seletor de arquivos)
 * quanto pelo servidor (validação real antes de gerar a URL de upload).
 */

/** Limite único de tamanho por arquivo: 250 MB. */
export const MAX_DOCUMENT_SIZE_BYTES = 250 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE_LABEL = "250 MB";

/** Extensões aceitas (minúsculas, com ponto). */
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

/** Atributo `accept` do <input type="file"> derivado da lista acima. */
export const DOCUMENT_ACCEPT_ATTR = [
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
].join(",");

export const DOCUMENT_FORMATS_LABEL = "PDF, DOCX, XLSX, CSV, TXT ou imagem";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function documentExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export function isAllowedDocumentName(filename: string): boolean {
  return (ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(
    documentExtension(filename),
  );
}

/** Nome seguro para uso como sufixo do caminho no Storage. */
export function sanitizeStorageFilename(filename: string): string {
  const clean = filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "");
  return (clean || "arquivo").slice(-160);
}

export type DocumentValidationResult = { ok: true } | { ok: false; message: string };

/** Validação compartilhada — mesma mensagem no cliente e no servidor. */
export function validateDocumentUpload(input: {
  filename: string;
  file_size: number;
}): DocumentValidationResult {
  if (!input.filename.trim()) {
    return { ok: false, message: "Informe o nome do arquivo." };
  }
  if (!isAllowedDocumentName(input.filename)) {
    return {
      ok: false,
      message: `Formato não aceito (${documentExtension(input.filename) || "sem extensão"}). Envie ${DOCUMENT_FORMATS_LABEL}.`,
    };
  }
  if (input.file_size <= 0) {
    return { ok: false, message: "O arquivo está vazio." };
  }
  if (input.file_size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false,
      message: `O arquivo tem ${formatBytes(input.file_size)} e o limite por arquivo é ${MAX_DOCUMENT_SIZE_LABEL}.`,
    };
  }
  return { ok: true };
}
