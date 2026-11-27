import { describe, expect, it } from "vitest";
import { parseSubjectMaterialJson, type MaterialItemInput } from "./study-material-ai";

const EXPL = (art: string) =>
  `«Em uma frase:» o art. ${art} trata de uma regra importante.\n\n«Explicando do zero:» texto suficiente para passar do mínimo.`;

const items: MaterialItemInput[] = [
  { id: "t1", name: "Art. 293 (CP)", notes: "Edital (Código Penal)", articleRef: "293" },
  { id: "t2", name: "Art. 294 (CP)", notes: "Edital (Código Penal)", articleRef: "294" },
  { id: "t3", name: "Art. 295 (CP)", notes: "Edital (Código Penal)", articleRef: "295" },
];

describe("parseSubjectMaterialJson", () => {
  it("casa cada explicação com o seu id", () => {
    const r = parseSubjectMaterialJson(
      JSON.stringify({ items: items.map((i) => ({ id: i.id, explanation: EXPL(i.articleRef!) })) }),
      items,
      "Direito Penal",
    );
    expect(r.missingIds).toEqual([]);
    expect(r.items.map((i) => i.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("JSON inválido NÃO vira texto padrão: todos voltam como faltando", () => {
    const r = parseSubjectMaterialJson('{"items":[{"id":"t1","explanation":"cortado', items, "Direito Penal");
    expect(r.items).toEqual([]);
    expect(r.missingIds).toEqual(["t1", "t2", "t3"]);
    expect(r.rejected[0]!.reason).toMatch(/JSON/);
  });

  it("id ausente fica sem material (antes ganhava o mock igual para todos)", () => {
    const r = parseSubjectMaterialJson(
      JSON.stringify({ items: [{ id: "t1", explanation: EXPL("293") }] }),
      items,
      "Direito Penal",
    );
    expect(r.items.map((i) => i.id)).toEqual(["t1"]);
    expect(r.missingIds).toEqual(["t2", "t3"]);
  });

  it("explicação repetida em dois artigos é recusada", () => {
    const same = "«Em uma frase:» explicação genérica que serve para qualquer item do edital, sem número.";
    const r = parseSubjectMaterialJson(
      JSON.stringify({ items: [{ id: "t1", explanation: same }, { id: "t2", explanation: same }] }),
      items.slice(0, 2),
      "Direito Penal",
    );
    expect(r.items.map((i) => i.id)).toEqual(["t1"]);
    expect(r.rejected).toContainEqual({ id: "t2", reason: "mesma explicação de outro item" });
  });

  it("explicação do artigo errado (ids trocados pela IA) é recusada", () => {
    const r = parseSubjectMaterialJson(
      JSON.stringify({
        items: [
          { id: "t1", explanation: EXPL("294") },
          { id: "t2", explanation: EXPL("293") },
        ],
      }),
      items.slice(0, 2),
      "Direito Penal",
    );
    expect(r.items).toEqual([]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "explica o art. 294 no lugar do art. 293",
      "explica o art. 293 no lugar do art. 294",
    ]);
  });

  it("sem IA configurada (mock), o conteúdo de demonstração é o esperado", () => {
    const r = parseSubjectMaterialJson("qualquer", items, "Direito Penal", { mocked: true });
    expect(r.missingIds).toEqual([]);
    expect(r.items).toHaveLength(3);
  });
});
