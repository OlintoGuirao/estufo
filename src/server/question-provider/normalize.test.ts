import { describe, expect, it } from "vitest";
import {
  applyClientSideFilterHints,
  evaluateMatchQuality,
  externalAppId,
  normalizeListResponse,
  normalizeUpstreamQuestion,
  stripExternalPrefix,
  TJSP_ESCREVENTE_PRESET,
} from "./normalize";

describe("external ids", () => {
  it("prefixa e remove prefixo", () => {
    expect(externalAppId("abc")).toBe("ext:abc");
    expect(externalAppId("ext:abc")).toBe("ext:abc");
    expect(stripExternalPrefix("ext:abc")).toBe("abc");
  });
});

describe("applyClientSideFilterHints", () => {
  it("limita pageSize e normaliza página", () => {
    expect(applyClientSideFilterHints({ page: 0, pageSize: 100 })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});

describe("evaluateMatchQuality", () => {
  const filters = {
    board: TJSP_ESCREVENTE_PRESET.board,
    institution: TJSP_ESCREVENTE_PRESET.institution,
    role: TJSP_ESCREVENTE_PRESET.role,
  };

  it("marca exact quando banca, órgão e cargo batem", () => {
    const r = evaluateMatchQuality(filters, [
      {
        id: "1",
        board: "VUNESP",
        institution: "Tribunal de Justiça de São Paulo",
        role: "Escrevente Técnico Judiciário",
      },
    ]);
    expect(r.matchQuality).toBe("exact");
  });

  it("marca partial quando só a banca bate", () => {
    const r = evaluateMatchQuality(filters, [
      { id: "1", board: "VUNESP", institution: "Prefeitura X", role: "Outro cargo" },
    ]);
    expect(r.matchQuality).toBe("partial");
    expect(r.matchNote).toMatch(/não identifica a prova/i);
  });
});

describe("normalizeUpstreamQuestion", () => {
  it("sanitiza script e preserva metadados", () => {
    const q = normalizeUpstreamQuestion({
      id: "99",
      statementHtml: "<p>Ok</p><script>alert(1)</script>",
      alternatives: [{ key: "a", html: "<b>Alt</b>" }],
      board: "VUNESP",
      year: "2023",
      institution: "TJSP",
      role: "Escrevente",
      examName: "Prova",
      source: "Fornecedor",
      images: [
        { url: "http://insecure.example/a.png" },
        { url: "https://cdn.example/a.png", alt: "fig" },
      ],
    });
    expect(q.id).toBe("ext:99");
    expect(q.statementHtml).toContain("<p>Ok</p>");
    expect(q.statementHtml).not.toContain("script");
    expect(q.year).toBe(2023);
    expect(q.images).toHaveLength(1);
    expect(q.images[0]?.url).toMatch(/^https:/);
  });
});

describe("normalizeListResponse", () => {
  it("pagina e aplica estado do usuário", () => {
    const res = normalizeListResponse(
      {
        items: [
          { id: "1", statement: "Texto", board: "VUNESP", alternatives: [{ key: "A", text: "x" }] },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      },
      { page: 1, pageSize: 10, board: "VUNESP" },
      { "1": { favorite: true, answered: { choice: "A", correct: false } } },
    );
    expect(res.items[0]?.favorite).toBe(true);
    expect(res.items[0]?.answered?.correct).toBe(false);
    expect(res.total).toBe(1);
  });
});
