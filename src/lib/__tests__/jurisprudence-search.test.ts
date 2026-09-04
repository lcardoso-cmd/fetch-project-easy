import { describe, expect, it } from "vitest";
import {
  buildSiteQuery,
  extractDate,
  extractPanel,
  extractProcessNumber,
  formatJurisprudenceText,
  isOfficialUrl,
  normalizeHits,
  searchJurisprudence,
  type ProviderHit,
} from "@/lib/jurisprudence/jurisprudence-search.server";

const CONSULTED = "2026-09-04T12:00:00.000Z";

/** Respostas simuladas do provedor — nenhuma chamada externa nos testes. */
const FAKE_HITS: ProviderHit[] = [
  {
    url: "https://scon.stj.jus.br/SCON/jurisprudencia/doc.jsp?id=1",
    title: "REsp nº 1.234.567/SP — dano moral por extravio de bagagem",
    markdown:
      "Terceira Turma, julgado em 12/03/2024. A responsabilidade do transportador aéreo é objetiva.",
  },
  {
    url: "https://jurisprudencia.tst.jus.br/decisao/0001234-56.2024.5.02.0012",
    title: "Horas extras — validade do controle de ponto",
    description: "Segunda Turma. Publicado em 2024-05-20.",
  },
  { url: "https://blog-juridico-qualquer.com/precedente", title: "Resumo de julgado" },
  { url: "not-a-url", title: "sem url" },
];

describe("jurisprudence search — domínios oficiais", () => {
  it("aceita apenas domínios oficiais de tribunais", () => {
    expect(isOfficialUrl("https://scon.stj.jus.br/SCON/x")).toBe(true);
    expect(isOfficialUrl("https://jurisprudencia.tst.jus.br/x")).toBe(true);
    expect(isOfficialUrl("https://exemplo.com/stj.jus.br")).toBe(false);
    expect(isOfficialUrl("nada")).toBe(false);
  });

  it("monta a consulta restrita aos domínios dos tribunais pedidos", () => {
    const q = buildSiteQuery("dano moral", ["STJ"]);
    expect(q).toContain("site:scon.stj.jus.br");
    expect(q).not.toContain("tjsp.jus.br");
  });
});

describe("jurisprudence search — normalização", () => {
  it("extrai data, número do processo e órgão julgador", () => {
    expect(extractDate("julgado em 12/03/2024")).toBe("2024-03-12");
    expect(extractDate("publicado em 2024-05-20")).toBe("2024-05-20");
    expect(extractProcessNumber("REsp nº 1.234.567/SP")).toContain("REsp");
    expect(extractProcessNumber("autos 0001234-56.2024.5.02.0012")).toBe(
      "0001234-56.2024.5.02.0012",
    );
    expect(extractPanel("Terceira Turma, julgado")).toBe("Terceira Turma");
    expect(extractPanel("sem indicação")).toBeNull();
  });

  it("descarta fontes não oficiais e numera as referências como J1, J2", () => {
    const hits = normalizeHits(FAKE_HITS, CONSULTED);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.ref)).toEqual(["J1", "J2"]);
    expect(hits[0]!.court).toBe("STJ");
    expect(hits[0]!.date).toBe("2024-03-12");
    expect(hits[0]!.panel).toBe("Terceira Turma");
    expect(hits[1]!.court).toBe("TST");
    expect(hits.every((h) => h.consulted_at === CONSULTED)).toBe(true);
  });

  it("respeita o filtro de tribunais", () => {
    const hits = normalizeHits(FAKE_HITS, CONSULTED, ["TST"]);
    expect(hits.map((h) => h.court)).toEqual(["TST"]);
  });

  it("não duplica a mesma URL", () => {
    const hits = normalizeHits([FAKE_HITS[0]!, FAKE_HITS[0]!], CONSULTED);
    expect(hits).toHaveLength(1);
  });
});

describe("jurisprudence search — execução", () => {
  it("devolve resultados verificáveis com provedor simulado", async () => {
    const res = await searchJurisprudence({
      query: "dano moral extravio de bagagem",
      courts: ["STJ", "TST"],
      provider: async () => FAKE_HITS,
    });
    expect(res.ok).toBe(true);
    expect(res.results).toHaveLength(2);
    expect(formatJurisprudenceText(res)).toContain("[J1] STJ");
    expect(formatJurisprudenceText(res)).toContain("Fonte oficial:");
  });

  it("informa indisponibilidade em vez de inventar precedentes", async () => {
    const res = await searchJurisprudence({
      query: "tese qualquer",
      provider: async () => {
        throw new Error("provedor fora do ar");
      },
    });
    expect(res.ok).toBe(false);
    expect(res.results).toEqual([]);
    expect(formatJurisprudenceText(res)).toContain("indisponível");
  });

  it("informa quando nada é encontrado nas fontes oficiais", async () => {
    const res = await searchJurisprudence({ query: "x", provider: async () => [] });
    expect(res.ok).toBe(true);
    expect(formatJurisprudenceText(res)).toContain("Nenhum resultado");
  });
});
