import {
  QUEST_PHASE_AI_CONTENT_VERSION,
  type QuestPhaseAiPayload,
} from "@/lib/tjsp-quest/ai-phase-content";
import { studyUserDataDb } from "@/services/study-user-data-db";

const LEGACY_PREFIX = "estufoo.quest.ai.v2.";

export type QuestPhaseAiCached = {
  phaseId: string;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
};

function isCurrentContent(content: QuestPhaseAiPayload | undefined): boolean {
  if (!content?.questions?.length) return false;
  return (content.contentVersion ?? 0) >= QUEST_PHASE_AI_CONTENT_VERSION;
}

/** Cache só em memória nesta sessão — a fonte da verdade é o Supabase. */
const memory = new Map<string, QuestPhaseAiCached>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function readLegacyLocal(phaseId: string): QuestPhaseAiCached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${LEGACY_PREFIX}${phaseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestPhaseAiCached;
    if (!parsed?.phaseId || !isCurrentContent(parsed.content)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearLegacyLocal(phaseId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${LEGACY_PREFIX}${phaseId}`);
  } catch {
    /* ignore */
  }
}

function listLegacyLocal(): QuestPhaseAiCached[] {
  if (typeof window === "undefined") return [];
  const out: QuestPhaseAiCached[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(LEGACY_PREFIX)) continue;
      const phaseId = k.slice(LEGACY_PREFIX.length);
      const entry = readLegacyLocal(phaseId);
      if (entry) out.push(entry);
    }
  } catch {
    /* ignore */
  }
  return out;
}

export const questPhaseAiStore = {
  /** Leitura síncrona (memória). Prefira `ensureHydrated` + get ou `loadPhase`. */
  get(phaseId: string): QuestPhaseAiCached | null {
    const hit = memory.get(phaseId);
    if (hit && isCurrentContent(hit.content)) return hit;
    return null;
  },

  async ensureHydrated(): Promise<void> {
    if (hydrated) return;
    if (hydratePromise) return hydratePromise;
    hydratePromise = this.hydrate();
    try {
      await hydratePromise;
    } finally {
      hydratePromise = null;
    }
  },

  /** Carrega uma fase do banco (e atualiza a memória). */
  async loadPhase(phaseId: string): Promise<QuestPhaseAiCached | null> {
    await this.ensureHydrated();
    const mem = this.get(phaseId);
    if (mem) return mem;

    try {
      const remote = await studyUserDataDb.getQuestPhaseAi(phaseId);
      if (remote && isCurrentContent(remote.content)) {
        memory.set(phaseId, remote);
        return remote;
      }
    } catch (err) {
      console.warn("[quest-ai-store] loadPhase falhou", err);
    }

    const legacy = readLegacyLocal(phaseId);
    if (legacy) {
      await this.set(legacy);
      clearLegacyLocal(phaseId);
      return this.get(phaseId);
    }
    return null;
  },

  /**
   * Persiste no Supabase (obrigatório) e atualiza a memória.
   * Não depende de localStorage para multi-dispositivo.
   */
  async set(entry: QuestPhaseAiCached): Promise<void> {
    if (!isCurrentContent(entry.content)) {
      console.warn("[quest-ai-store] conteúdo inválido/versão antiga — não salvou", entry.phaseId);
      return;
    }
    const saved: QuestPhaseAiCached = {
      ...entry,
      savedAt: entry.savedAt || new Date().toISOString(),
    };
    memory.set(saved.phaseId, saved);
    try {
      await studyUserDataDb.upsertQuestPhaseAi(saved);
      clearLegacyLocal(saved.phaseId);
    } catch (err) {
      console.warn("[quest-ai-store] falha ao salvar no banco", err);
      throw err;
    }
  },

  async clear(phaseId: string): Promise<void> {
    memory.delete(phaseId);
    clearLegacyLocal(phaseId);
    try {
      await studyUserDataDb.removeQuestPhaseAi(phaseId);
    } catch (err) {
      console.warn("[quest-ai-store] clear remoto falhou", err);
    }
  },

  async hydrate(): Promise<void> {
    if (typeof window === "undefined") {
      hydrated = true;
      return;
    }
    try {
      const remote = await studyUserDataDb.listQuestPhaseAi();
      for (const entry of remote) {
        if (!entry?.phaseId || !isCurrentContent(entry.content)) continue;
        const prev = memory.get(entry.phaseId);
        if (prev && prev.savedAt > entry.savedAt) continue;
        memory.set(entry.phaseId, entry);
      }

      // Migra cache antigo do aparelho → banco (uma vez).
      for (const legacy of listLegacyLocal()) {
        const existing = memory.get(legacy.phaseId);
        if (existing && existing.savedAt >= legacy.savedAt) {
          clearLegacyLocal(legacy.phaseId);
          continue;
        }
        try {
          await studyUserDataDb.upsertQuestPhaseAi(legacy);
          memory.set(legacy.phaseId, legacy);
          clearLegacyLocal(legacy.phaseId);
        } catch (err) {
          console.warn("[quest-ai-store] migração legacy falhou", legacy.phaseId, err);
        }
      }
    } catch (err) {
      console.warn("[quest-ai-store] hydrate do banco falhou", err);
    } finally {
      hydrated = true;
    }
  },
};
