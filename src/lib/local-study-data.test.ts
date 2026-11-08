import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/mock/handlers", () => ({ resetMockStudyData: vi.fn() }));

/** Lê a chave crua (sem a gaveta), para conferir onde o dado foi parar. */
function rawKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)!);
  return out.sort();
}

describe("cada conta com seu material no mesmo aparelho", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("conta B nunca vê os dados da conta A", async () => {
    const { ensureLocalDataBelongsTo } = await import("./local-study-data");

    await ensureLocalDataBelongsTo("A");
    localStorage.setItem("estufoo.approval-trail.v1", "trilha-da-A");
    localStorage.setItem("estufoo.redacao.v1", "redacao-da-A");
    expect(rawKeys()).toContain("estufoo.@A.approval-trail.v1");

    const r = await ensureLocalDataBelongsTo("B");
    expect(r.switched).toBe(true);
    expect(localStorage.getItem("estufoo.approval-trail.v1")).toBeNull();
    expect(localStorage.getItem("estufoo.redacao.v1")).toBeNull();
    // A gaveta de A foi apagada do aparelho
    expect(rawKeys().some((k) => k.startsWith("estufoo.@A."))).toBe(false);

    localStorage.setItem("estufoo.approval-trail.v1", "trilha-da-B");
    expect(rawKeys()).toContain("estufoo.@B.approval-trail.v1");
  });

  it("sessão e id do aparelho não são apagados nem separados", async () => {
    const { ensureLocalDataBelongsTo } = await import("./local-study-data");
    localStorage.setItem("estufoo.token", "tok");
    localStorage.setItem("estufoo.device-id", "dev_1");
    localStorage.setItem("sb-x-auth-token", "sess");
    await ensureLocalDataBelongsTo("A");
    await ensureLocalDataBelongsTo("B");
    expect(localStorage.getItem("estufoo.token")).toBe("tok");
    expect(localStorage.getItem("estufoo.device-id")).toBe("dev_1");
    expect(localStorage.getItem("sb-x-auth-token")).toBe("sess");
    expect(rawKeys()).toContain("estufoo.token");
  });

  it("o que foi feito sem login vai para a 1ª conta que entrar", async () => {
    const { ensureLocalDataBelongsTo } = await import("./local-study-data");
    localStorage.setItem("estufoo.redacao.v1", "rascunho");
    expect(rawKeys()).toContain("estufoo.@anon.redacao.v1");
    const r = await ensureLocalDataBelongsTo("A");
    expect(r.firstOwner).toBe(true);
    expect(localStorage.getItem("estufoo.redacao.v1")).toBe("rascunho");
  });

  it("sair da conta limpa a gaveta dela", async () => {
    const { ensureLocalDataBelongsTo, wipeLocalStudyData, setLocalDataOwner } = await import(
      "./local-study-data"
    );
    await ensureLocalDataBelongsTo("A");
    localStorage.setItem("estufoo.redacao.v1", "texto");
    await wipeLocalStudyData();
    setLocalDataOwner(null);
    expect(rawKeys().some((k) => k.startsWith("estufoo.@A."))).toBe(false);
  });
});
