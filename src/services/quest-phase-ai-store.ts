import {
  QUEST_PHASE_AI_CONTENT_VERSION,
  type QuestPhaseAiPayload,
} from "@/lib/tjsp-quest/ai-phase-content";
import { studyUserDataDb } from "@/services/study-user-data-db";

const LOCAL_PREFIX = "estufoo.quest.ai.v3.";
const LEGACY_PREFIX = "estufoo.quest.ai.v2.";

export type QuestPhaseAiCached = {
  phaseId: string;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
};

/** Conteúdo jogável — não regenera só porque a versão do schema mudou. */
function isUsableContent(content: QuestPhaseAiPayload | undefined): boolean {
  return (content?.questions?.length ?? 0) >= 3;
}

function isCurrentContent(content: QuestPhaseAiPayload | undefined): boolean {
  if (!isUsableContent(content)) return false;
  return (content!.contentVersion ?? 0) >= QUEST_PHASE_AI_CONTENT_VERSION;
}

/** Cache de sessão. */
const memory = new Map<string, QuestPhaseAiCached>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function writeLocal(entry: QuestPhaseAiCached): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${entry.phaseId}`, JSON.stringify(entry));
  } catch {
    /* quota / privado */
  }
}

function readLocalKey(key: string): QuestPhaseAiCached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestPhaseAiCached;
    if (!parsed?.phaseId || !isUsableContent(parsed.content)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readLocal(phaseId: string): QuestPhaseAiCached | null {
  return (
    readLocalKey(`${LOCAL_PREFIX}${phaseId}`) ??
    readLocalKey(`${LEGACY_PREFIX}${phaseId}`)
  );
}

function clearLocal(phaseId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${LOCAL_PREFIX}${phaseId}`);
    localStorage.removeItem(`${LEGACY_PREFIX}${phaseId}`);
  } catch {
    /* ignore */
  }
}

function listLocalEntries(): QuestPhaseAiCached[] {
  if (typeof window === "undefined") return [];
  const out: QuestPhaseAiCached[] = [];
  const seen = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(LOCAL_PREFIX) && !k.startsWith(LEGACY_PREFIX)) continue;
      const entry = readLocalKey(k);
      if (!entry || seen.has(entry.phaseId)) continue;
      seen.add(entry.phaseId);
      out.push(entry);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function preferNewer(
  a: QuestPhaseAiCached | null,
  b: QuestPhaseAiCached | null,
): QuestPhaseAiCached | null {
  if (!a) return b;
  if (!b) return a;
  return a.savedAt >= b.savedAt ? a : b;
}

export const questPhaseAiStore = {
  get(phaseId: string): QuestPhaseAiCached | null {
    const hit = memory.get(phaseId);
    if (hit && isUsableContent(hit.content)) return hit;
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

  /**
   * Carrega fase salva (memória → Supabase → localStorage).
   * Aceita conteúdo jogável mesmo com contentVersion antiga — não força regenerar.
   */
  async loadPhase(phaseId: string): Promise<QuestPhaseAiCached | null> {
    await this.ensureHydrated();
    const mem = this.get(phaseId);
    if (mem) return mem;

    let remote: QuestPhaseAiCached | null = null;
    try {
      const row = await studyUserDataDb.getQuestPhaseAi(phaseId);
      if (row && isUsableContent(row.content)) remote = row;
    } catch (err) {
      console.warn("[quest-ai-store] loadPhase remoto falhou", err);
    }

    const local = readLocal(phaseId);
    const best = preferNewer(remote, local);
    if (!best) return null;

    memory.set(phaseId, best);
    writeLocal(best);
    // Reenvia ao Supabase se só existia no aparelho ou se a versão local é mais nova.
    if (!remote || local?.savedAt === best.savedAt) {
      try {
        await studyUserDataDb.upsertQuestPhaseAi(best);
      } catch (err) {
        console.warn("[quest-ai-store] rehydrate remoto falhou", err);
      }
    }
    return best;
  },

  /**
   * Persiste em memória + localStorage sempre; Supabase best-effort.
   * Falha remota NÃO apaga o banco local — evita regenerar a cada entrada.
   */
  async set(entry: QuestPhaseAiCached): Promise<void> {
    if (!isUsableContent(entry.content)) {
      console.warn("[quest-ai-store] conteúdo inválido — não salvou", entry.phaseId);
      return;
    }
    const saved: QuestPhaseAiCached = {
      ...entry,
      content: {
        ...entry.content,
        contentVersion:
          entry.content.contentVersion ?? QUEST_PHASE_AI_CONTENT_VERSION,
      },
      savedAt: entry.savedAt || new Date().toISOString(),
    };
    memory.set(saved.phaseId, saved);
    writeLocal(saved);
    try {
      await studyUserDataDb.upsertQuestPhaseAi(saved);
    } catch (err) {
      console.warn("[quest-ai-store] falha ao salvar no Supabase (local ok)", err);
    }
  },

  async clear(phaseId: string): Promise<void> {
    memory.delete(phaseId);
    clearLocal(phaseId);
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
        if (!entry?.phaseId || !isUsableContent(entry.content)) continue;
        const prev = memory.get(entry.phaseId);
        if (prev && prev.savedAt > entry.savedAt) continue;
        memory.set(entry.phaseId, entry);
        writeLocal(entry);
      }

      for (const local of listLocalEntries()) {
        const existing = memory.get(local.phaseId);
        if (existing && existing.savedAt >= local.savedAt) continue;
        memory.set(local.phaseId, local);
        try {
          await studyUserDataDb.upsertQuestPhaseAi(local);
        } catch (err) {
          console.warn("[quest-ai-store] sync local→remoto falhou", local.phaseId, err);
        }
      }
    } catch (err) {
      console.warn("[quest-ai-store] hydrate falhou — usando só local", err);
      for (const local of listLocalEntries()) {
        memory.set(local.phaseId, local);
      }
    } finally {
      hydrated = true;
    }
  },
};
