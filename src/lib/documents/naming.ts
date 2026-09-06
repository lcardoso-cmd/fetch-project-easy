/** Nome base do documento, sem o sufixo de parte gerado na divisão. */
export function baseDocumentName(filename: string): string {
  return (
    filename
      .replace(/\s*[-–—]?\s*\(?parte\s*\d+(\s*(de|\/)\s*\d+)?\)?\s*(\.\w+)?$/i, "")
      .trim() || filename
  );
}
