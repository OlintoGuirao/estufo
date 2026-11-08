import { beforeEach, describe, expect, it, vi } from "vitest";

describe("redação — progresso salvo", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("o texto escrito continua lá ao voltar (nova sessão)", async () => {
    const { redacaoStore } = await import("./redacao-store");
    const essay = redacaoStore.startEssay({
      id: "t1",
      title: "Tema",
      prompt: "Proposta",
      context: "",
      genre: "dissertativa-argumentativa",
      likelihood: "alta",
      createdAt: new Date().toISOString(),
    } as never);
    redacaoStore.saveDraftLocal(essay.id, "Meu primeiro parágrafo.");

    vi.resetModules(); // simula fechar e abrir o app
    const again = (await import("./redacao-store")).redacaoStore;
    expect(again.getEssay(essay.id)?.body).toBe("Meu primeiro parágrafo.");
  });
});
