import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  QUEST_SHOP_CATEGORIES,
  getShopItem,
  questShopCatalog,
  type QuestShopCategory,
} from "@/data/tjsp-quest/shop-catalog";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { normalizeShop } from "@/lib/tjsp-quest/shop";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/quest/loja")({
  component: QuestShopPage,
});

function QuestShopPage() {
  const [player, refresh] = useTjspQuest();
  const shop = normalizeShop(player.shop);
  const [tab, setTab] = useState<QuestShopCategory>("personagem");

  const equippedChar = getShopItem(shop.equippedCharacterId);
  const equippedSkin = getShopItem(shop.equippedSkinId);

  const items = useMemo(
    () => questShopCatalog.filter((i) => i.category === tab),
    [tab],
  );

  const owned = (itemId: string, category: QuestShopCategory) => {
    if (category === "personagem") return shop.ownedCharacterIds.includes(itemId);
    if (category === "skin") return shop.ownedSkinIds.includes(itemId);
    return false;
  };

  const equipped = (itemId: string, category: QuestShopCategory) => {
    if (category === "personagem") return shop.equippedCharacterId === itemId;
    if (category === "skin") return shop.equippedSkinId === itemId;
    return false;
  };

  const buy = (itemId: string) => {
    const res = tjspQuestStore.purchase(itemId);
    refresh();
    if (!res.ok) {
      if (res.reason === "no-xp") toast.error("XP insuficiente — continue nas fases!");
      else if (res.reason === "owned") toast.message("Você já tem este item.");
      else toast.error("Não foi possível comprar.");
      return;
    }
    toast.success("Compra feita! Boa sorte nas questões.");
  };

  const equip = (kind: "personagem" | "skin", itemId: string) => {
    tjspQuestStore.equip(kind, itemId);
    refresh();
    toast.message("Equipado.");
  };

  return (
    <QuestShell title="Loja" backTo="/quest">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            {equippedChar?.emoji ?? "🧑‍💼"}
          </span>
          <div>
            <p className="text-sm font-bold text-white">{equippedChar?.name ?? "Personagem"}</p>
            <p className="text-xs text-white/70">Skin: {equippedSkin?.name ?? "—"}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4cc9f0]/20 px-3 py-1.5 text-sm font-black text-[#4cc9f0]">
          <Star className="h-4 w-4 fill-current" aria-hidden />
          {player.xp}
        </div>
      </div>

      <QuestCard className="mb-4 bg-white/95">
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-[#ff6b35]/15 px-2.5 py-1 font-bold text-[#c1121f]">
            ❤️ {shop.lives} vidas
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-900">
            ✂️ {shop.helps.eliminate}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900">
            💡 {shop.helps.tip}
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-900">
            🎯 {shop.helps.fifty}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ganhe estrelas (XP) passando nas fases e gaste aqui em personagens, skins, ajudas e
          vidas.
        </p>
      </QuestCard>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {QUEST_SHOP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition",
              tab === c.id
                ? "bg-[#ff9f1c] text-[#0b132b]"
                : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isOwned = owned(item.id, item.category);
          const isEquipped = equipped(item.id, item.category);
          const canBuyCosmetic = item.category === "personagem" || item.category === "skin";
          const free = item.priceXp <= 0;

          return (
            <QuestCard key={item.id} className="bg-white/95">
              <div className="flex gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0b132b]/5 text-3xl">
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#4cc9f0]/15 px-2 py-1 text-xs font-black text-[#0077b6]">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {free ? "Grátis" : item.priceXp}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canBuyCosmetic && isOwned ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={isEquipped ? "secondary" : "default"}
                        className="rounded-full"
                        disabled={isEquipped}
                        onClick={() =>
                          equip(item.category === "personagem" ? "personagem" : "skin", item.id)
                        }
                      >
                        {isEquipped ? "Equipado" : "Equipar"}
                      </Button>
                    ) : canBuyCosmetic ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-[#e85d04] text-white hover:bg-[#d00000]"
                        disabled={!free && player.xp < item.priceXp}
                        onClick={() => buy(item.id)}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Comprar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-[#e85d04] text-white hover:bg-[#d00000]"
                        disabled={player.xp < item.priceXp}
                        onClick={() => buy(item.id)}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Comprar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </QuestCard>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-white/60">
        <Link to="/quest" className="underline hover:text-white">
          Voltar ao Quest
        </Link>
      </p>
    </QuestShell>
  );
}
