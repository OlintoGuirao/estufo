import { describe, expect, it } from "vitest";
import { formatProfessorHtml, normalizeProfessorPlainText } from "./professor-text";

describe("normalizeProfessorPlainText", () => {
  it("remove asteriscos de markdown e destaca com aspas", () => {
    const raw =
      "Vamos começar: *compreensão* e *interpretação* não são a mesma coisa. A **compreensão** é o que está escrito.";
    const out = normalizeProfessorPlainText(raw);
    expect(out).not.toMatch(/\*/);
    expect(out).toContain("«compreensão»");
    expect(out).toContain("«interpretação»");
  });
});

describe("formatProfessorHtml", () => {
  it("gera HTML com strong e parágrafos", () => {
    const html = formatProfessorHtml(
      "A **compreensão** é o que está no texto.\n\nA interpretação vai além.",
    );
    expect(html).toContain("<strong>compreensão</strong>");
    expect(html).toContain("<p>");
    expect(html).not.toContain("*");
  });
});
