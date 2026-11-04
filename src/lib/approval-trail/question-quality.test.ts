import { describe, expect, it } from "vitest";
import {
  isBrokenSubstitutionStem,
  polishPracticeStatement,
  repairHighlightedTerm,
} from "./question-quality";

describe("question-quality", () => {
  it("marca «contudo» quando o enunciado fala em termo destacado sem destaque", () => {
    const raw =
      "No trecho 'O réu confessou o crime, contudo manteve algumas dúvidas', o termo destacado estabelece relação de:";
    const { statement, ok } = repairHighlightedTerm(raw, "Oposição real adversativa");
    expect(ok).toBe(true);
    expect(statement).toContain("«contudo»");
    expect(statement).toMatch(/termo destacado/i);
  });

  it("rejeita substituição «em que mantém o sentido» com rótulos meta", () => {
    const statement =
      "Assinale a opção em que a substituição de 'Portanto' por 'Porquanto' mantém o sentido original:";
    const alts = [
      { text: "Muda para concessão" },
      { text: "Altera para causa" },
      { text: "Mantém o efeito" },
      { text: "São sinônimos perfeitos" },
    ];
    expect(isBrokenSubstitutionStem(statement, alts)).toBe(true);
    expect(polishPracticeStatement(statement, alts).accept).toBe(false);
  });

  it("aceita substituição cobrando efeito com alternativas semânticas", () => {
    const statement =
      "A substituição de «portanto» por «porquanto» no período altera a relação para:";
    const alts = [
      { text: "Conclusão" },
      { text: "Causa / explicação" },
      { text: "Concessão" },
      { text: "Finalidade" },
    ];
    expect(isBrokenSubstitutionStem(statement, alts)).toBe(false);
    expect(polishPracticeStatement(statement, alts).accept).toBe(true);
  });

  it("aceita «assinale em que» com períodos completos", () => {
    const statement =
      "Assinale a opção em que a substituição de 'portanto' por 'porquanto' mantém o sentido original:";
    const alts = [
      { text: "Choveu muito; portanto, a rua alagou rápido." },
      { text: "Estudei, portanto passei — troca inviável." },
      { text: "Erro: portanto e porquanto nunca equivalem aqui." },
      { text: "Nenhuma das frases admite a troca sem mudar o sentido." },
    ];
    // Ainda é enunciado ruim (troca nunca mantém), mas formato bate com frases —
    // a regra só barra meta-rótulos. Aqui sentenceLike >= 2 → não broken por meta.
    expect(isBrokenSubstitutionStem(statement, alts)).toBe(false);
  });
});
