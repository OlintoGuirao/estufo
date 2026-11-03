import { describe, expect, it } from "vitest";
import { mockStudyPack, parseStudyPackJson } from "./study-pack";
import { layoutStudyPack } from "@/lib/mind-map/layout";

describe("parseStudyPackJson", () => {
  it("aceita pacote válido com nós, links e flashcards", () => {
    const pack = parseStudyPackJson(
      JSON.stringify({
        summary: "Resumo",
        centralTitle: "CPC",
        nodes: [
          {
            tempId: "n1",
            title: "Art. 144",
            kind: "artigo",
            summary: "Impedimento do juiz no processo civil.",
            keywords: ["impedimento"],
            parentTempId: null,
          },
          {
            tempId: "n2",
            title: "Impedimento",
            kind: "conceito",
            summary: "Situação em que o juiz não atua.",
            keywords: [],
            parentTempId: "n1",
          },
          {
            tempId: "n3",
            title: "Art. 183",
            kind: "artigo",
            summary: "Prazo da Fazenda Pública em dobro.",
            keywords: ["prazo"],
            parentTempId: null,
          },
        ],
        links: [{ sourceTempId: "n1", targetTempId: "n3", label: "comparar" }],
        flashcards: [
          {
            front: "O que é Art. 144?",
            back: "Impedimento do juiz.",
            topic: "CPC",
            tags: ["lei"],
            nodeId: "n1",
          },
          {
            front: "Art. 183?",
            back: "Prazo em dobro da Fazenda.",
            topic: "Prazos",
            tags: [],
          },
        ],
        warnings: [],
      }),
    );
    expect(pack.nodes).toHaveLength(3);
    expect(pack.links[0]?.label).toBe("comparar");
    expect(pack.flashcards).toHaveLength(2);
  });

  it("rejeita JSON inválido", () => {
    expect(() => parseStudyPackJson("não é json")).toThrow(/JSON inválido/i);
  });

  it("rejeita poucos nós", () => {
    expect(() =>
      parseStudyPackJson(
        JSON.stringify({
          centralTitle: "X",
          nodes: [{ tempId: "a", title: "A", kind: "topico", summary: "ok", parentTempId: null }],
          flashcards: [
            { front: "q1", back: "r1" },
            { front: "q2", back: "r2" },
          ],
        }),
      ),
    ).toThrow(/pelo menos 3/i);
  });
});

describe("layoutStudyPack", () => {
  it("cria hub central e posiciona ramos", () => {
    const mock = mockStudyPack({ title: "D. Processual Civil", subject: "CPC" });
    const { nodes, links, idMap } = layoutStudyPack({
      centralTitle: mock.centralTitle,
      nodes: mock.nodes,
      links: mock.links,
    });
    expect(nodes.some((n) => n.data.root && n.data.kind === "hub")).toBe(true);
    expect(nodes.length).toBe(mock.nodes.length + 1);
    expect(links.length).toBeGreaterThan(0);
    expect(idMap["a293"]).toBeTruthy();
  });

  it("espalha ramos raiz em cima e embaixo do hub", () => {
    const { nodes } = layoutStudyPack({
      centralTitle: "CP",
      nodes: [
        {
          tempId: "a",
          title: "Bloco A",
          kind: "topico",
          summary: "cima",
          keywords: [],
          parentTempId: null,
        },
        {
          tempId: "b",
          title: "Bloco B",
          kind: "topico",
          summary: "direita",
          keywords: [],
          parentTempId: null,
        },
        {
          tempId: "c",
          title: "Bloco C",
          kind: "topico",
          summary: "baixo",
          keywords: [],
          parentTempId: null,
        },
        {
          tempId: "d",
          title: "Bloco D",
          kind: "topico",
          summary: "esquerda",
          keywords: [],
          parentTempId: null,
        },
      ],
      links: [],
    });
    const hub = nodes.find((n) => n.data.root)!;
    const kids = nodes.filter((n) => !n.data.root);
    const above = kids.some((n) => n.position.y < hub.position.y - 40);
    const below = kids.some((n) => n.position.y > hub.position.y + 40);
    expect(above).toBe(true);
    expect(below).toBe(true);
  });
});
