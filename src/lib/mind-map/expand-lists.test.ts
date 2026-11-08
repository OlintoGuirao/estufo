import { describe, expect, it } from "vitest";
import { applyExpandedLists, extractEnumeration, findListsToExpand } from "./expand-lists";
import type { StudyPackAi } from "@/lib/tutor/study-pack";

const TEXT =
  "Palavras que substituem ou acompanham um substantivo, relacionando-o às pessoas do discurso. Dividem-se em pessoais, possessivos, demonstrativos, relativos, indefinidos e interrogativos.";

describe("expand-lists", () => {
  it("acha a lista do card de pronomes", () => {
    expect(extractEnumeration(TEXT)).toEqual([
      "pessoais",
      "possessivos",
      "demonstrativos",
      "relativos",
      "indefinidos",
      "interrogativos",
    ]);
  });

  it("não inventa lista em frase comum", () => {
    expect(extractEnumeration("Classe de palavras que acompanham ou substituem o substantivo.")).toEqual([]);
  });

  const pack: StudyPackAi = {
    summary: "",
    centralTitle: "Pronomes",
    nodes: [
      { tempId: "c1", title: "Conceito e Função dos Pronomes", kind: "conceito", summary: TEXT, keywords: [], parentTempId: null },
      { tempId: "k1", title: "Pronomes pessoais", kind: "explicacao", summary: "Eu, tu, ele…", keywords: [], parentTempId: "c1" },
    ],
    links: [],
    flashcards: [],
    warnings: [],
  };

  it("pede só os itens que ainda não têm card", () => {
    const lists = findListsToExpand(pack);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.items).not.toContain("pessoais");
    expect(lists[0]!.items).toContain("possessivos");
  });

  it("acrescenta os cards-filho explicados", () => {
    const next = applyExpandedLists(pack, {
      groups: [
        {
          parentId: "c1",
          items: [{ title: "Possessivos", summary: "Indicam a quem algo pertence. Ex.: \"meu\" livro." }],
        },
      ],
    });
    const child = next.nodes.find((n) => n.title === "Possessivos");
    expect(child?.parentTempId).toBe("c1");
    expect(child?.kind).toBe("explicacao");
  });
});
