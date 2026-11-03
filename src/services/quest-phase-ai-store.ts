import type { QuestPhaseAiPayload } from "@/lib/tjsp-quest/ai-phase-content";
import { studyUserDataDb, syncQuestPhaseAi } from "@/services/study-user-data-db";

const PREFIX = "estufoo.quest.ai.v1.";

type Cached = {
  phaseId: string;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
};

function key(phaseId: string) {
  return `${PREFIX}${phaseId}`;
}

let phaseAiHydrated = false;

export const questPhaseAiStore = {
  get(phaseId: string): Cached | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(key(phaseId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Cached;
      if (!parsed?.content?.questions?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  set(entry: Cached): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key(entry.phaseId), JSON.stringify(entry));
      syncQuestPhaseAi(entry);
    } catch (err) {
      console.warn("[quest-ai-store] falha ao salvar", err);
    }
  },

  clear(phaseId: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key(phaseId));
    void studyUserDataDb.removeQuestPhaseAi(phaseId).catch(() => {});
  },

  async hydrate(): Promise<void> {
    if (phaseAiHydrated || typeof window === "undefined") return;
    phaseAiHydrated = true;
    try {
      const remote = await studyUserDataDb.listQuestPhaseAi();
      for (const entry of remote) {
        if (!entry?.phaseId || !entry.content?.questions?.length) continue;
        const existing = questPhaseAiStore.get(entry.phaseId);
        if (existing) {
          syncQuestPhaseAi(existing);
          continue;
        }
        localStorage.setItem(key(entry.phaseId), JSON.stringify(entry));
      }
    } catch (err) {
      console.warn("[quest-ai-store] hydrate falhou", err);
    }
  },
};
