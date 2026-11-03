import { describe, expect, it } from "vitest";
import {
  expandStudyPackArticles,
  extractArticleTipification,
  pickArticlesToExpand,
  tipificationTitle,
} from "./expand-articles";
import type { StudyPackAi } from "@/lib/tutor/study-pack";

const MATERIAL_293_301 = `
Crimes contra a fe publica.
Falsidade de Titulos e Outros Papeis Publicos e Falsidade Documental.

Art. 293 - Falsificar, fabricando-os ou alterando-os, papeis publicos: selos de controle tributario, papeis de credito publico, cautelas, bilhetes de transporte oficial.
Pena: reclusao, de dois a oito anos, e multa.

Art. 299 - Omitir, em documento publico ou particular, declaracao que nele deveria constar, ou nele inserir ou fazer inserir declaracao falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigacao ou alterar a verdade sobre fato juridicamente relevante:
Pena - reclusao, de um a cinco anos, e multa, se o documento e publico, e reclusao de um a tres anos e multa, se o documento e particular.

Art. 301 - Falsificar, no todo ou em parte, atestado ou certidao, ou alterar o verdadeiro:
Pena - detencao, de dois meses a um ano.
`;

describe("extractArticleTipification", () => {
  it("traz tipificacao e pena do material", () => {
    const tip293 = extractArticleTipification(MATERIAL_293_301, 293);
    expect(tip293).toBeTruthy();
    expect(tip293!.toLowerCase()).toMatch(/falsificar|papeis|selos/);
    expect(tip293!.toLowerCase()).toMatch(/pena/);
    expect(tip293!.toLowerCase()).toMatch(/dois a oito|2 a 8|reclus/);

    const tip301 = extractArticleTipification(MATERIAL_293_301, 301);
    expect(tip301).toBeTruthy();
    expect(tip301!.toLowerCase()).toMatch(/atestado|certida/);
    expect(tip301!.toLowerCase()).toMatch(/pena/);

    expect(tipificationTitle(293, tip293!).length).toBeGreaterThan(8);
  });
});

describe("pickArticlesToExpand", () => {
  it("nao amostra faixa gigante sem material", () => {
    const range = Array.from({ length: 67 }, (_, i) => 293 + i);
    expect(pickArticlesToExpand(range, new Set(), 12)).toEqual([]);
    expect(pickArticlesToExpand(range, new Set([301, 312]), 12)).toEqual([
      301, 312,
    ]);
  });

  it("aceita faixa curta 293-305 mesmo sem material", () => {
    const range = Array.from({ length: 13 }, (_, i) => 293 + i);
    expect(pickArticlesToExpand(range, new Set(), 14)).toHaveLength(13);
  });
});

describe("expandStudyPackArticles", () => {
  it("liga Art sob a faixa com tipificacao + pena (sem Complete com)", () => {
    const pack: StudyPackAi = {
      summary: "teste",
      centralTitle: "CP",
      nodes: [
        {
          tempId: "faixa",
          title: "Arts. 293 a 305 CP",
          kind: "topico",
          summary:
            "Falsidade de Titulos e Outros Papeis Publicos e Falsidade Documental",
          keywords: ["Arts. 293-305"],
          parentTempId: null,
        },
        {
          tempId: "e301",
          title: "O que tipifica o Art. 301",
          kind: "explicacao",
          summary:
            "Complete com o que o Art. 301 pune ou tipifica, conforme o material.",
          keywords: ["Art. 301"],
          parentTempId: null,
        },
      ],
      links: [],
      flashcards: [
        { front: "q1", back: "r1", topic: "t", tags: [], nodeId: null },
        { front: "q2", back: "r2", topic: "t", tags: [], nodeId: null },
      ],
      warnings: [],
    };
    const out = expandStudyPackArticles(pack, MATERIAL_293_301);

    const faixaKids = out.nodes.filter((n) => n.parentTempId === "faixa");
    expect(faixaKids.some((n) => n.kind === "artigo")).toBe(true);

    const art293 = out.nodes.find(
      (n) => n.kind === "artigo" && /293/.test(n.title),
    );
    expect(art293?.parentTempId).toBe("faixa");
    const exp293 = out.nodes.find(
      (n) => n.kind === "explicacao" && n.parentTempId === art293?.tempId,
    );
    expect(exp293?.summary.toLowerCase()).toMatch(/pena/);
    expect(exp293?.summary).not.toMatch(/Complete com/i);

    const exp301 = out.nodes.find((n) => n.tempId === "e301");
    expect(exp301?.summary).not.toMatch(/Complete com/i);
    expect(exp301?.summary.toLowerCase()).toMatch(/atestado|falsificar/);
  });
});
