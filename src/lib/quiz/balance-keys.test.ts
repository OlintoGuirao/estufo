import { describe, expect, it } from "vitest";
import { balanceCorrectKeys, moveCorrectTo } from "./balance-keys";

const q = (correctKey: string, i = 0) => ({
  statement: `Questão ${i}`,
  alternatives: ["A", "B", "C", "D", "E"].map((key) => ({ key, text: `texto ${key}` })),
  correctKey,
  explanation: `A alternativa ${correctKey} está certa; a letra C erra o prazo.`,
});

describe("balanceCorrectKeys", () => {
  it("espalha a correta entre A–E mesmo se a IA mandou tudo em A/B", () => {
    const out = balanceCorrectKeys(
      Array.from({ length: 10 }, (_, i) => q(i % 2 ? "B" : "A", i)),
      "seed",
    );
    const counts = out.reduce<Record<string, number>>((m, x) => ((m[x.correctKey] = (m[x.correctKey] ?? 0) + 1), m), {});
    expect(Object.keys(counts).sort()).toEqual(["A", "B", "C", "D", "E"]);
    expect(Math.max(...Object.values(counts))).toBe(2);
  });

  it("o texto certo continua certo e a explicação acompanha a nova letra", () => {
    const moved = moveCorrectTo(q("A"), "D");
    expect(moved.correctKey).toBe("D");
    expect(moved.alternatives.find((a) => a.key === "D")!.text).toBe("texto A");
    expect(moved.explanation).toContain("alternativa D está certa");
    // "texto C" foi para outra letra; a explicação aponta para ela
    const newC = moved.alternatives.find((a) => a.text === "texto C")!.key;
    expect(moved.explanation).toContain(`letra ${newC} erra`);
  });

  it("mesma semente = mesmas letras (não muda ao voltar na tela)", () => {
    const list = Array.from({ length: 6 }, (_, i) => q("A", i));
    expect(balanceCorrectKeys(list, "m1").map((x) => x.correctKey)).toEqual(
      balanceCorrectKeys(list, "m1").map((x) => x.correctKey),
    );
  });
});
