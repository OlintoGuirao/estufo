import {
  getShopItem,
  QUEST_SHOP_STARTER_CHARACTER,
  QUEST_SHOP_STARTER_SKIN,
} from "@/data/tjsp-quest/shop-catalog";
import { xpToLevel } from "@/lib/tjsp-quest/progress";
import type {
  QuestPlayerState,
  QuestShopHelpKind,
  QuestShopInventory,
} from "@/types/tjsp-quest";

export function createDefaultShopInventory(): QuestShopInventory {
  return {
    ownedCharacterIds: [QUEST_SHOP_STARTER_CHARACTER],
    ownedSkinIds: [QUEST_SHOP_STARTER_SKIN],
    equippedCharacterId: QUEST_SHOP_STARTER_CHARACTER,
    equippedSkinId: QUEST_SHOP_STARTER_SKIN,
    helps: { eliminate: 0, tip: 0, fifty: 0 },
    lives: 0,
  };
}

export function normalizeShop(shop?: Partial<QuestShopInventory> | null): QuestShopInventory {
  const base = createDefaultShopInventory();
  if (!shop) return base;
  return {
    ownedCharacterIds: Array.from(
      new Set([...(shop.ownedCharacterIds ?? []), QUEST_SHOP_STARTER_CHARACTER]),
    ),
    ownedSkinIds: Array.from(new Set([...(shop.ownedSkinIds ?? []), QUEST_SHOP_STARTER_SKIN])),
    equippedCharacterId: shop.equippedCharacterId ?? base.equippedCharacterId,
    equippedSkinId: shop.equippedSkinId ?? base.equippedSkinId,
    helps: {
      eliminate: Math.max(0, shop.helps?.eliminate ?? 0),
      tip: Math.max(0, shop.helps?.tip ?? 0),
      fifty: Math.max(0, shop.helps?.fifty ?? 0),
    },
    lives: Math.max(0, shop.lives ?? 0),
  };
}

export type ShopPurchaseResult =
  | { ok: true; state: QuestPlayerState }
  | { ok: false; reason: "not-found" | "owned" | "no-xp" | "invalid" };

export function purchaseShopItem(
  state: QuestPlayerState,
  itemId: string,
): ShopPurchaseResult {
  const item = getShopItem(itemId);
  if (!item) return { ok: false, reason: "not-found" };

  const shop = normalizeShop(state.shop);

  if (item.category === "personagem") {
    if (shop.ownedCharacterIds.includes(item.id)) return { ok: false, reason: "owned" };
  }
  if (item.category === "skin") {
    if (shop.ownedSkinIds.includes(item.id)) return { ok: false, reason: "owned" };
  }

  if (item.priceXp > 0 && state.xp < item.priceXp) {
    return { ok: false, reason: "no-xp" };
  }

  const xp = Math.max(0, state.xp - item.priceXp);
  let nextShop = { ...shop, helps: { ...shop.helps } };

  if (item.category === "personagem") {
    nextShop = {
      ...nextShop,
      ownedCharacterIds: [...nextShop.ownedCharacterIds, item.id],
      equippedCharacterId: item.id,
    };
  } else if (item.category === "skin") {
    nextShop = {
      ...nextShop,
      ownedSkinIds: [...nextShop.ownedSkinIds, item.id],
      equippedSkinId: item.id,
    };
  } else if (item.category === "ajuda" && item.helpKind && item.helpQty) {
    nextShop = {
      ...nextShop,
      helps: {
        ...nextShop.helps,
        [item.helpKind]: nextShop.helps[item.helpKind] + item.helpQty,
      },
    };
  } else if (item.category === "vida" && item.livesQty) {
    nextShop = { ...nextShop, lives: nextShop.lives + item.livesQty };
  } else {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    state: {
      ...state,
      xp,
      level: xpToLevel(xp),
      shop: nextShop,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function equipShopCosmetic(
  state: QuestPlayerState,
  kind: "personagem" | "skin",
  itemId: string,
): QuestPlayerState {
  const shop = normalizeShop(state.shop);
  if (kind === "personagem") {
    if (!shop.ownedCharacterIds.includes(itemId)) return state;
    return {
      ...state,
      shop: { ...shop, equippedCharacterId: itemId },
      updatedAt: new Date().toISOString(),
    };
  }
  if (!shop.ownedSkinIds.includes(itemId)) return state;
  return {
    ...state,
    shop: { ...shop, equippedSkinId: itemId },
    updatedAt: new Date().toISOString(),
  };
}

export function consumeHelp(
  state: QuestPlayerState,
  kind: QuestShopHelpKind,
): { state: QuestPlayerState; ok: boolean } {
  const shop = normalizeShop(state.shop);
  if (shop.helps[kind] <= 0) return { state, ok: false };
  return {
    ok: true,
    state: {
      ...state,
      shop: {
        ...shop,
        helps: { ...shop.helps, [kind]: shop.helps[kind] - 1 },
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function consumeLife(state: QuestPlayerState): { state: QuestPlayerState; ok: boolean } {
  const shop = normalizeShop(state.shop);
  if (shop.lives <= 0) return { state, ok: false };
  return {
    ok: true,
    state: {
      ...state,
      shop: { ...shop, lives: shop.lives - 1 },
      updatedAt: new Date().toISOString(),
    },
  };
}
