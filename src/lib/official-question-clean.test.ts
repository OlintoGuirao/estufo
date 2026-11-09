import { describe, expect, it } from "vitest";
import {
  repairQuotes,
  cleanOfficialProva,
  fixParagraphMarks,
  isCleanOfficialQuestion,
  splitSupportText,
} from "./official-question-clean";

const alts = (e = "Alternativa E") =>
  ["A", "B", "C", "D", "E"].map((key) => ({ key, text: key === "E" ? e : `Alternativa ${key}` }));

describe("limpeza das questões oficiais (PDF)", () => {
  it("remonta a marca de parágrafo quebrada no meio da palavra", () => {
    const s =
      "a passagem – Achava os sinos frios, quando vovô Emílio deso parágrafo) pertava-lhes a sanha e os fazia pularem... (5 – está adequadamente reescrita em:";
    expect(fixParagraphMarks(s)).toBe(
      "a passagem – Achava os sinos frios, quando vovô Emílio despertava-lhes a sanha e os fazia pularem... (5º parágrafo) – está adequadamente reescrita em:",
    );
  });

  it("tira o 'o' solto e coloca o º", () => {
    expect(fixParagraphMarks("davam a ela doces e o beijos... (4 parágrafo)")).toBe(
      "davam a ela doces e beijos... (4º parágrafo)",
    );
    expect(fixParagraphMarks("limpar-lhes o bojo proo parágrafo) fundo... (6")).toBe(
      "limpar-lhes o bojo profundo... (6º parágrafo)",
    );
  });

  it("número órfão antes do comando e 'o' depois da marca", () => {
    expect(
      fixParagraphMarks(
        "• ... renováveis... (5º parágrafo) o • ... de importação... (7 Os termos destacados significam:",
      ),
    ).toBe("• ... renováveis... (5º parágrafo) • ... de importação... (7º parágrafo) Os termos destacados significam:");
  });

  it("conserta trecho citado que perdeu letra, usando o texto de apoio", () => {
    const passage = "O bárbaro diagnóstico expõe a falha. Um recorte mais amplo mostra que houve aumento.";
    expect(repairQuotes("Um recorte mais amplmostra... (3º parágrafo)", passage)).toBe(
      "Um recorte mais amplo mostra... (3º parágrafo)",
    );
    expect(repairQuotes("16 confidencial", passage)).toBe("16 confidencial");
  });

  it("move o texto de apoio vazado na alternativa E para as questões certas", () => {
    const passage = "A andorinha da torre. ".repeat(10).trim();
    const prova = cleanOfficialProva([
      {
        id: "q2",
        number: 2,
        statement: "Assinale a alternativa correta:",
        alternatives: alts(
          `Texto da E. Leia trecho do conto de Raul Pompeia para responder às questões de números 03 a 04. ${passage}`,
        ),
      },
      { id: "q3", number: 3, statement: "O narrador da história deixa claro que", alternatives: alts() },
      { id: "q4", number: 4, statement: "No texto, predomina", alternatives: alts() },
    ]);
    expect(prova[0]!.alternatives[4]!.text).toBe("Texto da E.");
    const s3 = splitSupportText(prova[1]!.statement);
    expect(s3.label).toBe("Texto de apoio (questões 03 a 04)");
    expect(s3.passage).toBe(passage);
    expect(s3.question).toBe("O narrador da história deixa claro que");
    expect(isCleanOfficialQuestion(prova[1]!)).toBe(true);
  });

  it("descarta do desafio questão que pede o texto mas não tem texto", () => {
    expect(
      isCleanOfficialQuestion({ id: "x", statement: "No texto, o autor defende que", alternatives: alts() }),
    ).toBe(false);
    expect(
      isCleanOfficialQuestion({
        id: "y",
        statement: "Conforme o texto constitucional, são gratuitas as ações de",
        alternatives: alts(),
      }),
    ).toBe(true);
  });
});
