import { describe, expect, it } from "vitest";
import { extractJsonText, parseLlmJson, resolveCallOptions } from "./llm-tasks";
import { buildGeminiBody } from "./gemini/client";
import { applyVerification } from "./question-verify";
import { findUnsupportedArticles } from "./legal/citations";
import { openAnswer, sealAnswer } from "./answer-token";

describe("llm-tasks", () => {
  it("perfil por tarefa escolhe tier e JSON", () => {
    expect(resolveCallOptions({ task: "mastigado" }).tier).toBe("smart");
    expect(resolveCallOptions({ task: "tip" }).tier).toBe("fast");
    expect(resolveCallOptions({ task: "practice" }).json).toBe(true);
    expect(resolveCallOptions({ task: "tip", tier: "smart" }).tier).toBe("smart");
  });

  it("extrai JSON com cerca ou texto em volta", () => {
    expect(parseLlmJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLlmJson('Claro! Aqui está: {"a":[1,2]} espero ter ajudado')).toEqual({ a: [1, 2] });
    expect(extractJsonText("[1,2]")).toBe("[1,2]");
  });
});

describe("gemini body", () => {
  it("normaliza turnos: começa no usuário e junta papéis repetidos", () => {
    const body = buildGeminiBody(
      [
        { role: "system", content: "sys" },
        { role: "assistant", content: "pergunta antiga do professor" },
        { role: "user", content: "a" },
        { role: "user", content: "b" },
        { role: "assistant", content: "c" },
      ],
      resolveCallOptions({ task: "practice" }),
      { thinkingLevel: "medium" },
    ) as {
      contents: { role: string; parts: { text: string }[] }[];
      generationConfig: Record<string, unknown>;
      systemInstruction: unknown;
    };
    expect(body.contents.map((c) => c.role)).toEqual(["user", "model"]);
    expect(body.contents[0]!.parts[0]!.text).toContain("a\n\nb");
    expect(body.generationConfig["responseMimeType"]).toBe("application/json");
    expect(body.generationConfig["thinkingConfig"]).toEqual({ thinkingLevel: "medium" });
    expect(body.systemInstruction).toBeTruthy();
  });
});

describe("verificação de questões", () => {
  const q = (correctKey: string) => ({
    statement: "x",
    alternatives: ["A", "B", "C", "D", "E"].map((key) => ({ key, text: key })),
    correctKey,
  });
  it("descarta divergentes e ambíguas, mantém as que batem", () => {
    const r = applyVerification(
      [q("A"), q("B"), q("C"), q("D")],
      [
        { i: 0, key: "A" },
        { i: 1, key: "C" },
        { i: 2, key: "C", ambiguous: true, issue: "duas corretas" },
      ],
    );
    expect(r.kept.map((x) => x.correctKey)).toEqual(["A", "D"]);
    expect(r.dropped).toHaveLength(2);
  });
});

describe("citações", () => {
  it("aponta artigo citado que não está nas fontes", () => {
    const out = findUnsupportedArticles("Conforme o art. 312 e o art. 5º…", ["Art. 5º Todos são iguais"]);
    expect(out).toEqual(["art. 312"]);
  });
});

describe("answer token", () => {
  it("cifra e abre; adulterado falha; base64 antigo não abre", () => {
    const t = sealAnswer({ correctKey: "C", explanation: "porque sim" });
    expect(t).not.toContain("correctKey");
    expect(Buffer.from(t.slice(3), "base64url").toString("utf8")).not.toContain("correctKey");
    expect(openAnswer<{ correctKey: string }>(t).correctKey).toBe("C");
    expect(() => openAnswer(`${t.slice(0, -4)}AAAA`)).toThrow();
    expect(() => openAnswer(btoa('{"correctKey":"C"}'))).toThrow();
  });
});
