import { describe, expect, it } from "vitest";
import { createInitialPlayerState } from "./progress";
import { purchaseShopItem, consumeHelp, consumeLife, equipShopCosmetic } from "./shop";

describe("tjsp-quest shop", () => {
  it("compra personagem com moedas e equipa — XP/nível não caem", () => {
    let s = createInitialPlayerState();
    s = { ...s, xp: 1000, coins: 1000, level: 3 };
    const res = purchaseShopItem(s, "char-juiz");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.coins).toBe(1000 - 600);
    expect(res.state.xp).toBe(1000);
    expect(res.state.shop.ownedCharacterIds).toContain("char-juiz");
    expect(res.state.shop.equippedCharacterId).toBe("char-juiz");
  });

  it("recusa compra sem moedas", () => {
    const s = createInitialPlayerState();
    const res = purchaseShopItem(s, "char-juiz");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no-xp");
  });

  it("compra vidas e consome", () => {
    let s = { ...createInitialPlayerState(), coins: 500 };
    const bought = purchaseShopItem(s, "life-1");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.shop.lives).toBe(1);
    const used = consumeLife(bought.state);
    expect(used.ok).toBe(true);
    expect(used.state.shop.lives).toBe(0);
  });

  it("compra ajudas e consome eliminate", () => {
    let s = { ...createInitialPlayerState(), coins: 500 };
    const bought = purchaseShopItem(s, "help-eliminate-3");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.shop.helps.eliminate).toBe(3);
    const used = consumeHelp(bought.state, "eliminate");
    expect(used.ok).toBe(true);
    expect(used.state.shop.helps.eliminate).toBe(2);
  });

  it("equipa skin já possuída", () => {
    let s: ReturnType<typeof createInitialPlayerState> = { ...createInitialPlayerState(), coins: 500 };
    const bought = purchaseShopItem(s, "skin-sunset");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    s = equipShopCosmetic(bought.state, "skin", "skin-classic");
    expect(s.shop.equippedSkinId).toBe("skin-classic");
  });
});
