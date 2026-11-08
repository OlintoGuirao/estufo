/** TJSP Quest — plataforma gamificada de estudos. */

export type QuestLessonBlockKind =
  | "contexto"
  | "explicacao"
  | "base-legal"
  | "texto-legal"
  | "traducao"
  | "exemplo"
  | "prova"
  | "memorizar"
  | "mini-revisao";

export type QuestLessonBlock = {
  id: string;
  kind: QuestLessonBlockKind;
  title: string;
  body: string;
  /** Obrigatório para liberar o desafio (exceto mini-revisão). */
  required: boolean;
};

export type QuestAltKey = "A" | "B" | "C" | "D" | "E";

export type QuestQuestion = {
  id: string;
  statement: string;
  /** Padrão VUNESP: 5 alternativas (A–E). */
  alternatives: { key: QuestAltKey; text: string }[];
  correctKey: QuestAltKey;
  legalBasis: string;
  whyCorrect: string;
  whyWrong: Partial<Record<QuestAltKey, string>>;
  memoryTip?: string;
  difficulty: "facil" | "media" | "dificil";
  /** false = conteúdo didático de treino (não é questão oficial de banca). */
  /** true = questão real de prova (desafio do dia); false = treino gerado. */
  official: boolean;
  /** Estilo da banca usado na geração (treino). */
  boardStyle?: "VUNESP";
};

export type QuestPhase = {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  objective: string;
  estimatedMinutes: number;
  conceptsCount: number;
  lessonBlocks: QuestLessonBlock[];
  questions: QuestQuestion[];
  bossQuestions: QuestQuestion[];
  sources: { label: string; url?: string }[];
  contentVerifiedAt: string;
  unlockRequiresPhaseIds: string[];
  bossPassPct: number;
};

export type QuestSubject = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: "scale" | "monitor" | "calculator" | "book" | "gavel" | "landmark" | "pen" | "globe";
  description: string;
  phaseIds: string[];
};

export type QuestCatalog = {
  version: number;
  subjects: QuestSubject[];
  phases: QuestPhase[];
};

export type QuestAttempt = {
  questionId: string;
  phaseId: string;
  mode: "desafio" | "chefao" | "revisao";
  choice: string;
  correct: boolean;
  at: string;
  xpAwarded: number;
};

export type QuestReviewItem = {
  questionId: string;
  phaseId: string;
  subjectId: string;
  dueDate: string;
  intervalDays: number;
  wrongCount: number;
};

export type QuestPhaseProgress = {
  phaseId: string;
  lessonCompletedBlockIds: string[];
  lessonDone: boolean;
  desafioBestPct: number;
  chefaoBestPct: number;
  unlocked: boolean;
  completed: boolean;
  lastPlayedAt?: string;
  /** Quantas etapas da trilha interna (0–10) já foram concluídas. */
  trailCompletedCount?: number;
  /** Melhor % por índice de etapa (0–9). */
  trailStageBestPct?: number[];
};

export type QuestShopHelpKind = "eliminate" | "tip" | "fifty";

export type QuestShopInventory = {
  ownedCharacterIds: string[];
  ownedSkinIds: string[];
  equippedCharacterId: string;
  equippedSkinId: string;
  helps: Record<QuestShopHelpKind, number>;
  lives: number;
};

/** Desafio do dia (roleta). */
export type QuestDailyChallenge = {
  date: string;
  subjectId: string;
  correct: number;
  total: number;
  /** Já jogou hoje (recompensa entregue). */
  done: boolean;
  coinsAwarded: number;
};

export type QuestPlayerState = {
  /** XP define o NÍVEL e nunca diminui. */
  xp: number;
  /** Moedas: gastas na Loja (antes a loja gastava XP e o nível caía). */
  coins?: number;
  daily?: QuestDailyChallenge;
  level: number;
  streakDays: number;
  lastStudyDate: string | null;
  dailyXp: number;
  dailyXpDate: string | null;
  phases: Record<string, QuestPhaseProgress>;
  attempts: QuestAttempt[];
  reviews: QuestReviewItem[];
  achievements: string[];
  shop: QuestShopInventory;
  updatedAt: string;
};

export const QUEST_XP = {
  correctEasy: 80,
  correctMedium: 100,
  correctHard: 130,
  streakBonus: 25,
  phaseClear: 200,
  bossClear: 350,
  reviewCorrect: 60,
  dailyCap: 2500,
} as const;

export const QUEST_SRS_INTERVALS = [1, 3, 7, 14, 30] as const;
