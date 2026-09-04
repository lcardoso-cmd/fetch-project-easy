import { describe, it, expect } from "vitest";
import {
  INTAKE_TEXT_PAGE_LIMIT,
  canOcrFile,
  classifyIntakeError,
  isIntakeActive,
  missingFieldsFrom,
  pagesToAnalyze,
  parseModelJson,
  storagePathBelongsToOrg,
  weakPages,
  buildAnalysisContext,
} from "@/lib/intake/intake-core";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  sanitizeStorageFilename,
  validateDocumentUpload,
} from "@/lib/documents-limits";

describe("intake-core: seleção de páginas", () => {
  it("limita a análise às primeiras páginas", () => {
    expect(pagesToAnalyze(3)).toEqual([1, 2, 3]);
    expect(pagesToAnalyze(200)).toHaveLength(INTAKE_TEXT_PAGE_LIMIT);
    expect(pagesToAnalyze(200)[0]).toBe(1);
  });

  it("detecta páginas sem texto pesquisável", () => {
    expect(weakPages(["texto ".repeat(60), "", "x"])).toEqual([2, 3]);
  });

  it("respeita o orçamento de caracteres do modelo", () => {
    const { text, pagesUsed } = buildAnalysisContext(["a".repeat(400), "b".repeat(400)], 500);
    expect(pagesUsed).toEqual([1]);
    expect(text.length).toBeLessThanOrEqual(600);
  });
});

describe("intake-core: erros", () => {
  it("classifica falta de créditos como definitiva", () => {
    const c = classifyIntakeError(new Error("Chat falhou (402): sem créditos"));
    expect(c.retryable).toBe(false);
  });

  it("classifica erro de rede como nova tentativa possível", () => {
    const c = classifyIntakeError(new Error("network timeout"));
    expect(c.retryable).toBe(true);
  });
});

describe("intake-core: estado e dados", () => {
  it("reconhece estados em andamento", () => {
    expect(isIntakeActive("queued")).toBe(true);
    expect(isIntakeActive("ready")).toBe(false);
  });

  it("lista campos não identificados", () => {
    const missing = missingFieldsFrom({
      client_name: null,
      case_number: "0001",
      jurisdiction: null,
      case_type: null,
      parties: [],
      description: "",
    });
    expect(missing).toContain("client_name");
    expect(missing).toContain("parties");
    expect(missing).not.toContain("case_number");
  });

  it("lê JSON com cercas de código", () => {
    expect(parseModelJson('```json\n{"title":"X"}\n```')).toEqual({ title: "X" });
    expect(parseModelJson("não é json")).toEqual({});
  });

  it("aceita OCR só dentro do limite de arquivo", () => {
    expect(canOcrFile(1024)).toBe(true);
    expect(canOcrFile(MAX_DOCUMENT_SIZE_BYTES)).toBe(false);
  });
});

describe("segurança de caminhos e envio", () => {
  it("rejeita caminho de outra organização", () => {
    const org = "11111111-1111-1111-1111-111111111111";
    expect(storagePathBelongsToOrg(`${org}/_intake/a.pdf`, org)).toBe(true);
    expect(storagePathBelongsToOrg("22222222/_intake/a.pdf", org)).toBe(false);
    expect(storagePathBelongsToOrg(`${org}/../x.pdf`, org)).toBe(false);
  });

  it("valida tamanho e formato do arquivo", () => {
    expect(validateDocumentUpload({ filename: "a.pdf", file_size: 1000 }).ok).toBe(true);
    expect(
      validateDocumentUpload({ filename: "a.pdf", file_size: MAX_DOCUMENT_SIZE_BYTES + 1 }).ok,
    ).toBe(false);
    expect(validateDocumentUpload({ filename: "a.exe", file_size: 10 }).ok).toBe(false);
  });

  it("limpa nomes de arquivo", () => {
    expect(sanitizeStorageFilename("meu processo (1).pdf")).not.toMatch(/[()\s]/);
  });
});
