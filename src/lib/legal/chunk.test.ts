import { describe, expect, it } from "vitest";
import {
  chunkLawText,
  citedArticleNumbers,
  keywordSearch,
  mergeArticleChunks,
  type LegalChunk,
} from "./chunk";
import { decodeHtmlBytes, stripHtmlToText } from "@/lib/tutor/fonte";

const LAW = { id: "x", name: "Lei X", url: "" };

describe("chunkLawText: rótulo do artigo", () => {
  it("milhar com ponto não vira 'Art. 1' (Normas da Corregedoria, CPC)", () => {
    const c = chunkLawText(
      "Art. 1.011. Recebido o recurso de apelação no tribunal. Art. 1.012. A apelação terá efeito suspensivo, salvo disposição.",
      LAW,
    );
    expect(c.map((x) => x.article)).toEqual(["Art. 1011", "Art. 1012"]);
  });

  it("'Artigo 1.º' das leis da ALESP é artigo (não 'Preâmbulo')", () => {
    const text = stripHtmlToText(
      "<p>Artigo 1.&#186; - Esta lei institui o regime jur&iacute;dico.</p><p>Artigo 171 - O funcion&aacute;rio ter&aacute; direito.</p>",
      1e6,
    );
    expect(text).toContain("regime jurídico");
    expect(chunkLawText(text, LAW).map((x) => x.article)).toEqual(["Art. 1", "Art. 171"]);
  });

  it("sufixo só quando colado ao número: 311-A sim, '171 - O funcionário' não", () => {
    const c = chunkLawText(
      "Art. 311-A. Utilizar ou divulgar, indevidamente, conteúdo sigiloso. Artigo 171 - O funcionário terá direito a férias.",
      LAW,
    );
    expect(c.map((x) => x.article)).toEqual(["Art. 311-A", "Art. 171"]);
  });
});

describe("decodeHtmlBytes", () => {
  it("página sem charset em Windows-1252 (Planalto) não vira 'cita��o'", () => {
    const bytes = new Uint8Array([...Buffer.from("Art. 5", "latin1"), 0xba, ...Buffer.from(" A cita", "latin1"), 0xe7, 0xe3, ...Buffer.from("o", "latin1")]);
    expect(decodeHtmlBytes(bytes.buffer, "text/html")).toBe("Art. 5º A citação");
  });

  it("UTF-8 continua UTF-8", () => {
    const bytes = new TextEncoder().encode("citação");
    expect(decodeHtmlBytes(bytes.buffer as ArrayBuffer, "text/html")).toBe("citação");
  });
});

describe("keywordSearch", () => {
  const cp: LegalChunk = {
    id: "cp:351", lawId: "cp", lawName: "CP", article: "Art. 351",
    content: "Art. 351 - Promover ou facilitar a fuga de pessoa legalmente presa.", sourceUrl: "",
  };
  const cpp351: LegalChunk = {
    id: "cpp:351", lawId: "cpp", lawName: "CPP", article: "Art. 351",
    content: "Art. 351. A citação inicial far-se-á por mandado.", sourceUrl: "",
  };
  const cpp3: LegalChunk = {
    id: "cpp:3", lawId: "cpp", lawName: "CPP", article: "Art. 3",
    content: `Art. 3º ${"código de processo penal processual penal ".repeat(40)}`, sourceUrl: "",
  };

  it("artigo citado vem primeiro, mesmo contra trecho longo com as palavras da busca", () => {
    const hits = keywordSearch([cpp3, cpp351], "Direito Processual Penal Art. 351 (CPP) código de processo penal", {
      limit: 2,
      lawIds: ["cpp"],
    });
    expect(hits[0]!.id).toBe("cpp:351");
  });

  it("com a lei filtrada, o art. 351 do CP não entra no lugar do CPP", () => {
    const hits = keywordSearch([cp, cpp351], "Art. 351 citação", { limit: 3, lawIds: ["cpp"] });
    expect(hits.map((h) => h.lawId)).toEqual(["cpp"]);
  });

  it("artigo longo (vários trechos) aparece uma vez só e inteiro", () => {
    const p1: LegalChunk = { id: "cf:12:1", lawId: "cf88", lawName: "CF", article: "Art. 12", content: "Art. 12. São brasileiros natos", sourceUrl: "" };
    const p2: LegalChunk = { ...p1, id: "cf:12:2", content: "Art. 12 (cont.) os nascidos no estrangeiro" };
    const a13: LegalChunk = { id: "cf:13", lawId: "cf88", lawName: "CF", article: "Art. 13", content: "Art. 13. A língua portuguesa é o idioma oficial", sourceUrl: "" };
    const corpus = [p1, p2, a13];
    const hits = keywordSearch(corpus, "nacionalidade (CF, arts. 12 e 13) brasileiros natos", { limit: 3 });
    const merged = mergeArticleChunks(hits, corpus);
    expect(merged.map((m) => m.article)).toEqual(["Art. 12", "Art. 13"]);
    expect(merged[0]!.content).toBe("Art. 12. São brasileiros natos os nascidos no estrangeiro");
  });

  it("lê listas e faixas citadas", () => {
    expect([...citedArticleNumbers("artigos 60 a 62; 88 e 89")]).toEqual(["60", "61", "62", "88", "89"]);
    expect([...citedArticleNumbers("Art. 311-A (CP)")]).toEqual(["311-A"]);
    expect([...citedArticleNumbers("Lei 9.099/1995, art. 1.012")]).toEqual(["1012"]);
  });
});
