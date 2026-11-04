import type { QuestShopHelpKind } from "@/types/tjsp-quest";

export type QuestShopCategory = "personagem" | "skin" | "ajuda" | "vida";

export type QuestShopItem = {
  id: string;
  category: QuestShopCategory;
  name: string;
  description: string;
  priceXp: number;
  /** Ícone emoji leve (sem asset externo). */
  emoji: string;
  /** Personagem/skin inicial grátis. */
  starter?: boolean;
  /** Pacote de ajudas. */
  helpKind?: QuestShopHelpKind;
  helpQty?: number;
  /** Quantidade de vidas no pacote. */
  livesQty?: number;
};

export const QUEST_SHOP_STARTER_CHARACTER = "char-escrevente";
export const QUEST_SHOP_STARTER_SKIN = "skin-classic";

export const questShopCatalog: QuestShopItem[] = [
  // —— Personagens ——
  {
    id: QUEST_SHOP_STARTER_CHARACTER,
    category: "personagem",
    name: "Escrevente iniciante",
    description: "Seu personagem inicial na trilha do TJSP Quest.",
    priceXp: 0,
    emoji: "🧑‍💼",
    starter: true,
  },
  {
    id: "char-juiz",
    category: "personagem",
    name: "Juiz mentor",
    description: "Companheiro sério — visual de quem já passou no chefão.",
    priceXp: 600,
    emoji: "⚖️",
  },
  {
    id: "char-promotor",
    category: "personagem",
    name: "Promotor relâmpago",
    description: "Visual acelerado para quem vive de streak de acertos.",
    priceXp: 900,
    emoji: "⚡",
  },
  {
    id: "char-corregedor",
    category: "personagem",
    name: "Corregedor lendário",
    description: "Skin de prestígio para quem domina a legislação interna.",
    priceXp: 1400,
    emoji: "🏛️",
  },

  // —— Skins ——
  {
    id: QUEST_SHOP_STARTER_SKIN,
    category: "skin",
    name: "Clássica azul",
    description: "Visual padrão da trilha.",
    priceXp: 0,
    emoji: "🔵",
    starter: true,
  },
  {
    id: "skin-sunset",
    category: "skin",
    name: "Pôr do sol VUNESP",
    description: "Tons laranja/âmbar na trilha e no quiz.",
    priceXp: 350,
    emoji: "🌅",
  },
  {
    id: "skin-emerald",
    category: "skin",
    name: "Esmeralda do fórum",
    description: "Verde institucional para quem acumula fases.",
    priceXp: 450,
    emoji: "🟢",
  },
  {
    id: "skin-gold",
    category: "skin",
    name: "Ouro do chefão",
    description: "Brilho dourado — cara de quem zera o boss.",
    priceXp: 800,
    emoji: "🟡",
  },

  // —— Ajudas ——
  {
    id: "help-eliminate-3",
    category: "ajuda",
    name: "Eliminar 2 erradas ×3",
    description: "Remove duas alternativas incorretas na questão atual.",
    priceXp: 220,
    emoji: "✂️",
    helpKind: "eliminate",
    helpQty: 3,
  },
  {
    id: "help-tip-3",
    category: "ajuda",
    name: "Dica de prova ×3",
    description: "Revela a memory tip / pista da questão.",
    priceXp: 160,
    emoji: "💡",
    helpKind: "tip",
    helpQty: 3,
  },
  {
    id: "help-fifty-3",
    category: "ajuda",
    name: "50/50 ×3",
    description: "Deixa só a correta e mais uma alternativa.",
    priceXp: 280,
    emoji: "🎯",
    helpKind: "fifty",
    helpQty: 3,
  },

  // —— Vidas ——
  {
    id: "life-1",
    category: "vida",
    name: "1 vida extra",
    description: "Ao errar, pode tentar de novo a mesma questão.",
    priceXp: 180,
    emoji: "❤️",
    livesQty: 1,
  },
  {
    id: "life-3",
    category: "vida",
    name: "Pacote 3 vidas",
    description: "Três chances extras no quiz.",
    priceXp: 450,
    emoji: "💖",
    livesQty: 3,
  },
];

export function getShopItem(id: string): QuestShopItem | undefined {
  return questShopCatalog.find((i) => i.id === id);
}

export const QUEST_SHOP_CATEGORIES: {
  id: QuestShopCategory;
  label: string;
  blurb: string;
}[] = [
  { id: "personagem", label: "Personagens", blurb: "Companheiros da trilha" },
  { id: "skin", label: "Skins", blurb: "Visual da jornada" },
  { id: "ajuda", label: "Ajudas", blurb: "Consumíveis no quiz" },
  { id: "vida", label: "Vidas", blurb: "Segunda chance ao errar" },
];
