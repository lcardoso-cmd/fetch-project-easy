import { describe, expect, it } from "vitest";
import { decidePdfPageReadMode, needsNativeVerification } from "./pdf-text-quality";

const base = {
  textItemCount: 0,
  rasterImageCount: 0,
  maxRasterCoverage: 0,
};

describe("decisão de OCR por página", () => {
  it("mantém texto nativo substancial mesmo quando há imagem de fundo", () => {
    expect(
      decidePdfPageReadMode({
        ...base,
        text: "conteúdo jurídico pesquisável ".repeat(20),
        textItemCount: 20,
        rasterImageCount: 1,
        maxRasterCoverage: 1,
      }),
    ).toBe("native");
  });

  it("não manda texto curto para OCR apenas por não alcançar 120 caracteres", () => {
    expect(
      decidePdfPageReadMode({
        ...base,
        text: "Conclusão. Julgo procedente o pedido.",
        textItemCount: 1,
      }),
    ).toBe("native");
  });

  it("não confunde selo ou logotipo pequeno com página escaneada", () => {
    expect(
      decidePdfPageReadMode({
        ...base,
        text: "Despacho: intime-se.",
        textItemCount: 1,
        rasterImageCount: 2,
        maxRasterCoverage: 0.08,
      }),
    ).toBe("native");
  });

  it("usa OCR quando a página é uma imagem grande sem texto suficiente", () => {
    expect(
      decidePdfPageReadMode({
        ...base,
        text: "Documento juntado",
        textItemCount: 1,
        rasterImageCount: 1,
        maxRasterCoverage: 0.96,
      }),
    ).toBe("ocr");
  });

  it("não desperdiça OCR em página realmente vazia", () => {
    const signals = { ...base, text: "" };
    expect(decidePdfPageReadMode(signals)).toBe("blank");
    expect(needsNativeVerification(signals)).toBe(false);
  });
});
