import { describe, expect, it } from "vitest";
import {
  attachmentPath,
  conversationLabel,
  dmKey,
  initialsOf,
  messagePreview,
  resolveMentionIds,
} from "@/lib/conversation-utils";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("dmKey", () => {
  it("é idêntica independente da ordem (uma DM por par)", () => {
    expect(dmKey(A, B)).toBe(dmKey(B, A));
  });
  it("rejeita conversa consigo mesmo", () => {
    expect(() => dmKey(A, A)).toThrow();
  });
});

describe("resolveMentionIds", () => {
  const parts = [
    { id: A, name: "Maria Silva" },
    { id: B, name: "João" },
  ];

  it("resolve nomes simples e compostos", () => {
    expect(resolveMentionIds("bom dia @João", parts)).toEqual([B]);
    expect(resolveMentionIds("@Maria Silva revisar peça", parts)).toEqual([A]);
  });

  it("ignora menções desconhecidas e não duplica", () => {
    expect(resolveMentionIds("@Ninguem @João @João", parts)).toEqual([B]);
  });

  it("não resolve nada em texto sem menções", () => {
    expect(resolveMentionIds("sem mencao aqui", parts)).toEqual([]);
  });
});

describe("conversationLabel", () => {
  it("rotula canal geral, caso e DM", () => {
    expect(conversationLabel({ kind: "general", title: null })).toBe("Canal geral");
    expect(
      conversationLabel({ kind: "case", title: null, case_title: "Ação trabalhista" }),
    ).toBe("Ação trabalhista");
    expect(conversationLabel({ kind: "dm", title: null, other_name: "João" })).toBe("João");
    expect(conversationLabel({ kind: "dm", title: null, other_name: null })).toBe(
      "Mensagem direta",
    );
  });
});

describe("messagePreview", () => {
  it("respeita exclusão lógica", () => {
    expect(messagePreview({ body: "oi", deleted_at: "2026-01-01" })).toBe("Mensagem removida");
  });
  it("descreve anexos quando não há texto", () => {
    expect(messagePreview({ body: "   ", attachments: [{}] })).toBe("1 anexo(s)");
  });
  it("mostra o texto quando existe", () => {
    expect(messagePreview({ body: "prazo amanhã" })).toBe("prazo amanhã");
  });
});

describe("attachmentPath", () => {
  it("mantém organização e conversa no caminho e sanitiza o nome", () => {
    const path = attachmentPath(A, B, "peça final (2).pdf");
    expect(path.startsWith(`${A}/${B}/`)).toBe(true);
    expect(path).not.toContain(" ");
    expect(path.endsWith(".pdf")).toBe(true);
  });
});

describe("initialsOf", () => {
  it("gera até duas letras", () => {
    expect(initialsOf("Maria Silva Souza")).toBe("MS");
    expect(initialsOf("João")).toBe("JO");
    expect(initialsOf("  ")).toBe("?");
  });
});
