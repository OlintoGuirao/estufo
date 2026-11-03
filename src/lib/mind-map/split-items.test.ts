import { describe, expect, it } from "vitest";
import {
  collectNodeCardItems,
  expandArticleRange,
  inferNodeKind,
  splitStudyItems,
} from "./split-items";

describe("splitStudyItems", () => {
  it("separa lista com vírgula e 'e'", () => {
    expect(
      splitStudyItems("Denunciação caluniosa, falso testemunho e fraude processual"),
    ).toEqual(["Denunciação caluniosa", "falso testemunho", "fraude processual"]);
  });
});

describe("collectNodeCardItems", () => {
  it("une explicação e keywords sem duplicar", () => {
    const items = collectNodeCardItems({
      summary: "Denunciação caluniosa, falso testemunho e fraude processual",
      keywords: ["falso testemunho", "fraude processual"],
    });
    expect(items).toEqual([
      "Denunciação caluniosa",
      "falso testemunho",
      "fraude processual",
    ]);
  });

  it("expande faixa de artigos no título", () => {
    expect(
      collectNodeCardItems({
        title: "Arts. 293 a 295 CP",
        summary: "bloco",
        keywords: [],
      }),
    ).toEqual(["Art. 293", "Art. 294", "Art. 295"]);
  });
});

describe("expandArticleRange / inferNodeKind", () => {
  it("parseia Arts. 293 a 305", () => {
    expect(expandArticleRange("Arts. 293 a 295")?.length).toBe(3);
    expect(inferNodeKind("Art. 293 CP")).toBe("artigo");
    expect(inferNodeKind("Crimes contra a Fé Pública")).toBe("conceito");
  });
});
