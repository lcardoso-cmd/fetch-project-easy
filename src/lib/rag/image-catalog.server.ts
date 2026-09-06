/**
 * Catálogo das páginas que são só imagem.
 *
 * Em vez de transcrever (OCR, caro e lento), pede ao modelo uma linha por
 * página dizendo o que ela é ("nota fiscal", "cartão de ponto", "foto"). Roda
 * em lotes, com orçamento de tempo, e nunca é obrigatório: falha aqui não
 * invalida a leitura de texto já feita.
 */

export const IMAGE_CATALOG_VERSION = "img-catalog-v1";

export interface ImagePageDescription {
  page: number;
  label: string;
  description: string;
}

function parseCatalogLines(text: string, pages: number[]): ImagePageDescription[] {
  const requested = new Set(pages);
  const out = new Map<number, ImagePageDescription>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 2) continue;
    const page = Number(parts[0]?.replace(/[^\d]/g, ""));
    if (!Number.isFinite(page) || !requested.has(page) || out.has(page)) continue;
    const label = (parts[1] ?? "").slice(0, 60);
    const description = (parts.slice(2).join(" — ") || label).slice(0, 300);
    if (!label) continue;
    out.set(page, { page, label, description });
  }
  return [...out.values()].sort((a, b) => a.page - b.page);
}

/** Extrai um subconjunto de páginas do PDF como um novo PDF (pdf-lib). */
async function slicePdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const total = source.getPageCount();
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < total);
  const copied = await out.copyPages(source, indices);
  for (const p of copied) out.addPage(p);
  return new Uint8Array(await out.save());
}

/**
 * Descreve as páginas informadas em lotes. Cada lote concluído é entregue em
 * `onBatch` antes do próximo começar, então uma parada por tempo preserva o
 * que já foi descrito.
 */
export async function describeImagePages(opts: {
  bytes: Uint8Array;
  filename: string;
  pages: number[];
  batchSize?: number;
  deadlineAt?: number;
  onBatch?: (batch: ImagePageDescription[]) => void | Promise<void>;
}): Promise<{ described: ImagePageDescription[]; incomplete: boolean }> {
  const { visionDescribePdfSlice } = await import("../ai.server");
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 8, 12));
  const described: ImagePageDescription[] = [];
  let incomplete = false;

  for (let i = 0; i < opts.pages.length; i += batchSize) {
    if (opts.deadlineAt && Date.now() >= opts.deadlineAt) {
      incomplete = true;
      break;
    }
    const batch = opts.pages.slice(i, i + batchSize);
    try {
      const slice = await slicePdf(opts.bytes, batch);
      const text = await visionDescribePdfSlice(slice, opts.filename, batch);
      const parsed = parseCatalogLines(text, batch);
      if (parsed.length > 0) {
        described.push(...parsed);
        await opts.onBatch?.(parsed);
      }
    } catch (error) {
      // Catálogo é acessório: registra e segue para o próximo lote.
      console.warn("[image-catalog] lote falhou", {
        pages: batch,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { described, incomplete };
}
