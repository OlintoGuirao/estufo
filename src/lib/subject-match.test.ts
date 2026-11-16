import { describe, expect, it } from "vitest";
import { matchesAnySubject, subjectsMatch } from "./subject-match";

describe("subject-match", () => {
  it("Português casa com Língua Portuguesa", () => {
    expect(subjectsMatch("Português", "Língua Portuguesa")).toBe(true);
    expect(subjectsMatch("Língua Portuguesa", "Português")).toBe(true);
  });

  it("não mistura matérias diferentes", () => {
    expect(subjectsMatch("Português", "Direito Penal")).toBe(false);
    expect(subjectsMatch("Informática", "Atualidades")).toBe(false);
  });

  it("Matemática casa com o rótulo composto do banco", () => {
    expect(subjectsMatch("Matemática", "Matemática e Raciocínio Lógico")).toBe(true);
    expect(subjectsMatch("Raciocínio Lógico", "Matemática e Raciocínio Lógico")).toBe(true);
  });

  it("filtra lista pedida", () => {
    expect(matchesAnySubject("Língua Portuguesa", ["Português"])).toBe(true);
    expect(matchesAnySubject("Direito Penal", ["Português"])).toBe(false);
  });
});
