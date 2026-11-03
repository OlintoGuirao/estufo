import { describe, expect, it } from "vitest";
import { buildTrailFromAiText } from "./parse-ai-plan";

describe("buildTrailFromAiText", () => {
  it("monta trilha a partir de JSON da IA", () => {
    const trail = buildTrailFromAiText(
      JSON.stringify({
        contestName: "TJSP",
        organ: "TJSP",
        role: "Escrevente",
        board: "Vunesp",
        examDate: null,
        summary: "Resumo",
        subjects: [
          {
            name: "Português",
            questionCountHint: 16,
            topics: [{ name: "Crase", weightHint: "alta", notes: "" }],
          },
        ],
        weeks: [{ week: 1, focus: "Português", subjectNames: ["Português"], hoursSuggested: 10, activities: ["Teoria"] }],
        warnings: [],
      }),
      { fileName: "edital.pdf", sourceTextChars: 1000, mocked: false },
    );
    expect(trail.contestName).toBe("TJSP");
    expect(trail.subjects).toHaveLength(1);
    expect(trail.subjects[0]!.topics[0]!.name).toBe("Crase");
    expect(trail.weeks[0]!.week).toBe(1);
  });
});
