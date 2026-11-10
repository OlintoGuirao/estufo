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

  it("exclui tema e rascunho e não os traz de volta ao reler", async () => {
    const { redacaoStore } = await import("./redacao-store");
    await redacaoStore.saveThemes(
      [
        {
          id: "tema-x",
          title: "Tema X",
          prompt: "Escreva",
          context: "ctx",
          genre: "dissertativa-argumentativa",
          likelihood: "alta",
          createdAt: new Date().toISOString(),
        },
      ],
      { replace: true },
    );
    const theme = redacaoStore.getTheme("tema-x")!;
    const essay = redacaoStore.startEssay(theme);
    expect(redacaoStore.deleteTheme("tema-x")).toBe(true);
    expect(redacaoStore.getTheme("tema-x")).toBeUndefined();
    expect(redacaoStore.deleteEssay(essay.id)).toBe(true);
    expect(redacaoStore.getEssay(essay.id)).toBeUndefined();

    vi.resetModules();
    const again = (await import("./redacao-store")).redacaoStore;
    expect(again.getTheme("tema-x")).toBeUndefined();
    expect(again.getEssay(essay.id)).toBeUndefined();
  });
});
