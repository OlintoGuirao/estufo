import { describe, expect, it, vi } from "vitest";
import { assertNoSecretsInMessages, checkOllamaStatus, extractAssistantText } from "./client";
import { OllamaError } from "./errors";

describe("ollama client", () => {
  it("status offline não quebra — retorna available false", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const st = await checkOllamaStatus({ fetchImpl });
    expect(st.available).toBe(false);
    expect(st.useMock).toBe(false);
    expect(st.message.length).toBeGreaterThan(0);
  });

  it("bloqueia mensagens com segredo explícito", () => {
    expect(() =>
      assertNoSecretsInMessages(
        [{ role: "user", content: "Explicação secreta longa demais aqui" }],
        ["Explicação secreta longa demais aqui"],
      ),
    ).toThrow(OllamaError);
  });

  it("extractAssistantText usa content ou fallback do thinking", () => {
    expect(extractAssistantText({ content: "dica útil" })).toBe("dica útil");
    expect(
      extractAssistantText({
        content: "",
        thinking: "raciocínio longo\n\nRelia o enunciado com calma.",
      }),
    ).toBe("Relia o enunciado com calma.");
  });
});
