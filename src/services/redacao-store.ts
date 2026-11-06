import type {
  RedacaoEssay,
  RedacaoImprovementPoint,
  RedacaoSchedule,
  RedacaoState,
  RedacaoTheme,
  RedacaoWeekday,
} from "@/types/redacao";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";

const KEY = "estufoo.redacao.v1";

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}_${crypto.randomUUID()}`
    : `${prefix}_${Date.now().toString(36)}`;
}

function emptyState(): RedacaoState {
  return {
    schedule: { weekdays: [6], updatedAt: new Date().toISOString() },
    themes: [],
    essays: [],
    openImprovements: [],
  };
}

function read(): RedacaoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as RedacaoState | null;
    if (!raw || typeof raw !== "object") return emptyState();
    return {
      schedule: raw.schedule ?? emptyState().schedule,
      themes: Array.isArray(raw.themes) ? raw.themes : [],
      essays: Array.isArray(raw.essays) ? raw.essays : [],
      openImprovements: Array.isArray(raw.openImprovements) ? raw.openImprovements : [],
    };
  } catch {
    return emptyState();
  }
}

function writeLocal(state: RedacaoState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function richness(s: RedacaoState): number {
  return s.themes.length * 100 + s.essays.length * 10 + s.openImprovements.length;
}

function latestThemeAt(s: RedacaoState): string {
  let max = "";
  for (const t of s.themes) {
    if (t.createdAt && t.createdAt > max) max = t.createdAt;
  }
  for (const e of s.essays) {
    if (e.updatedAt && e.updatedAt > max) max = e.updatedAt;
  }
  if (s.schedule?.updatedAt && s.schedule.updatedAt > max) max = s.schedule.updatedAt;
  return max;
}

/** Une local + remoto sem apagar temas/redações do outro lado. */
function mergeStates(a: RedacaoState, b: RedacaoState): RedacaoState {
  const themeMap = new Map<string, RedacaoTheme>();
  for (const t of [...a.themes, ...b.themes]) {
    const prev = themeMap.get(t.id);
    if (!prev || (t.createdAt ?? "") >= (prev.createdAt ?? "")) themeMap.set(t.id, t);
  }
  const essayMap = new Map<string, RedacaoEssay>();
  for (const e of [...a.essays, ...b.essays]) {
    const prev = essayMap.get(e.id);
    if (!prev || e.updatedAt >= prev.updatedAt) essayMap.set(e.id, e);
  }
  const impMap = new Map<string, RedacaoImprovementPoint>();
  for (const p of [...a.openImprovements, ...b.openImprovements]) {
    const prev = impMap.get(p.id);
    if (!prev) impMap.set(p.id, p);
    else if (p.status === "aberto" && prev.status !== "aberto") impMap.set(p.id, p);
  }
  const schedule =
    (a.schedule?.updatedAt ?? "") >= (b.schedule?.updatedAt ?? "")
      ? a.schedule
      : b.schedule;

  return {
    schedule: schedule ?? emptyState().schedule,
    themes: [...themeMap.values()]
      .sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""))
      .slice(0, 40),
    essays: [...essayMap.values()]
      .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
      .slice(0, 80),
    openImprovements: [...impMap.values()].slice(0, 30),
  };
}

async function fetchRemote(): Promise<RedacaoState | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_redacao_state")
      .select("payload, updated_at")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const remote = data?.[0]?.payload as RedacaoState | undefined;
    if (!remote || typeof remote !== "object") return null;
    return {
      schedule: remote.schedule ?? emptyState().schedule,
      themes: Array.isArray(remote.themes) ? remote.themes : [],
      essays: Array.isArray(remote.essays) ? remote.essays : [],
      openImprovements: Array.isArray(remote.openImprovements)
        ? remote.openImprovements
        : [],
    };
  } catch (err) {
    console.warn("[redacao] fetch remoto falhou", err);
    return null;
  }
}

async function upsertRemote(state: RedacaoState): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const sb = requireSupabase();
    await sb.from("user_redacao_state").upsert(
      {
        device_id: getStudyOwnerId(),
        payload: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
  } catch (err) {
    console.warn("[redacao] sync falhou", err);
  }
}

/**
 * Grava local sempre; no remoto faz merge com o que já existe
 * para nunca apagar temas só porque a agenda foi atualizada.
 */
async function persist(state: RedacaoState, opts?: { replaceThemes?: boolean }): Promise<void> {
  writeLocal(state);
  if (!isSupabaseConfigured) return;
  const remote = await fetchRemote();
  if (!remote) {
    await upsertRemote(state);
    return;
  }
  // Evita wipe: local sem temas + remoto com temas → mantém os remotos (salvo replace explícito).
  if (
    !opts?.replaceThemes &&
    state.themes.length === 0 &&
    remote.themes.length > 0
  ) {
    const merged = mergeStates({ ...state, themes: remote.themes }, remote);
    writeLocal(merged);
    await upsertRemote(merged);
    return;
  }
  const merged = mergeStates(state, remote);
  // Se o botão Gerar pediu troca, os temas de `state` (mais novos) já estão no merge pelo createdAt.
  writeLocal(merged);
  await upsertRemote(merged);
}

let hydratePromise: Promise<RedacaoState> | null = null;

export const redacaoStore = {
  get(): RedacaoState {
    return read();
  },

  async hydrate(): Promise<RedacaoState> {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      const local = read();
      const remote = await fetchRemote();
      if (!remote) {
        writeLocal(local);
        return local;
      }
      const merged = mergeStates(local, remote);
      // Se o remoto é bem mais rico e o local está vazio de conteúdo, sobe o merge.
      if (richness(remote) > richness(local) || latestThemeAt(remote) > latestThemeAt(local)) {
        writeLocal(merged);
        // Garante cópia na chave do owner atual (claim/conta).
        await upsertRemote(merged);
        return merged;
      }
      writeLocal(merged);
      if (richness(local) > 0 && richness(remote) < richness(local)) {
        await upsertRemote(merged);
      }
      return merged;
    })();
    try {
      return await hydratePromise;
    } finally {
      hydratePromise = null;
    }
  },

  setSchedule(weekdays: RedacaoWeekday[]): RedacaoSchedule {
    const state = read();
    const unique = [...new Set(weekdays)].sort((a, b) => a - b) as RedacaoWeekday[];
    state.schedule = { weekdays: unique, updatedAt: new Date().toISOString() };
    // Só agenda — persist assíncrono com merge (não apaga temas).
    writeLocal(state);
    void persist(state);
    return state.schedule;
  },

  /**
   * Salva temas gerados pela IA (prepend). Persistência no Supabase com merge.
   * `replace` = true troca o lote atual pelos novos (botão Gerar temas).
   */
  async saveThemes(themes: RedacaoTheme[], opts?: { replace?: boolean }): Promise<RedacaoTheme[]> {
    const state = read();
    if (opts?.replace) {
      // Mantém temas já usados em redações; troca o restante pelo lote novo.
      const usedIds = new Set(state.essays.map((e) => e.themeId));
      const kept = state.themes.filter((t) => usedIds.has(t.id));
      state.themes = [...themes, ...kept]
        .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
        .slice(0, 40);
    } else {
      state.themes = [...themes, ...state.themes]
        .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
        .slice(0, 40);
    }
    await persist(state, { replaceThemes: true });
    return themes;
  },

  /** @deprecated use saveThemes */
  addThemes(themes: RedacaoTheme[]): RedacaoTheme[] {
    const state = read();
    state.themes = [...themes, ...state.themes].slice(0, 40);
    writeLocal(state);
    void persist(state, { replaceThemes: true });
    return themes;
  },

  listThemes(): RedacaoTheme[] {
    return [...read().themes];
  },

  getTheme(id: string): RedacaoTheme | undefined {
    return read().themes.find((t) => t.id === id);
  },

  listEssays(): RedacaoEssay[] {
    return [...read().essays].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  getEssay(id: string): RedacaoEssay | undefined {
    return read().essays.find((e) => e.id === id);
  },

  startEssay(theme: RedacaoTheme): RedacaoEssay {
    const state = read();
    const now = new Date().toISOString();
    const focus = state.openImprovements
      .filter((p) => p.status === "aberto")
      .slice(0, 5)
      .map((p) => ({ ...p }));
    const essay: RedacaoEssay = {
      id: uid("essay"),
      themeId: theme.id,
      themeTitle: theme.title,
      themePrompt: theme.prompt,
      themeContext: theme.context,
      body: "",
      status: "rascunho",
      focusPoints: focus,
      createdAt: now,
      updatedAt: now,
    };
    state.essays = [essay, ...state.essays].slice(0, 80);
    writeLocal(state);
    void persist(state);
    return essay;
  },

  saveDraft(id: string, body: string): RedacaoEssay {
    const state = read();
    const idx = state.essays.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("Redação não encontrada.");
    const essay = state.essays[idx]!;
    if (essay.status === "corrigida") throw new Error("Redação já corrigida.");
    essay.body = body;
    essay.updatedAt = new Date().toISOString();
    state.essays[idx] = essay;
    writeLocal(state);
    void persist(state);
    return essay;
  },

  applyCorrection(
    id: string,
    correction: NonNullable<RedacaoEssay["correction"]>,
    resolvedFocusAreas: string[],
  ): RedacaoEssay {
    const state = read();
    const idx = state.essays.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("Redação não encontrada.");
    const essay = state.essays[idx]!;
    const now = new Date().toISOString();

    const resolvedSet = new Set(resolvedFocusAreas.map((a) => a.toLowerCase()));
    essay.focusPoints = essay.focusPoints.map((p) => {
      if (resolvedSet.has(p.area.toLowerCase()) || resolvedSet.has(p.tip.toLowerCase())) {
        return { ...p, status: "melhorou" as const };
      }
      return p;
    });

    state.openImprovements = state.openImprovements.map((p) => {
      if (resolvedSet.has(p.area.toLowerCase())) {
        return { ...p, status: "melhorou" as const };
      }
      return p;
    });

    const existingKeys = new Set(
      state.openImprovements
        .filter((p) => p.status === "aberto")
        .map((p) => `${p.area.toLowerCase()}::${p.tip.toLowerCase()}`),
    );
    const fresh: RedacaoImprovementPoint[] = [];
    for (const imp of correction.improvements) {
      const key = `${imp.area.toLowerCase()}::${imp.tip.toLowerCase()}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      fresh.push({ ...imp, fromEssayId: id, status: "aberto" });
    }
    state.openImprovements = [...fresh, ...state.openImprovements]
      .filter((p) => p.status === "aberto" || p.status === "melhorou")
      .slice(0, 30);

    essay.correction = correction;
    essay.status = "corrigida";
    essay.submittedAt = now;
    essay.updatedAt = now;
    state.essays[idx] = essay;
    writeLocal(state);
    void persist(state);
    return essay;
  },

  openImprovements(): RedacaoImprovementPoint[] {
    return read().openImprovements.filter((p) => p.status === "aberto");
  },

  isEssayDay(date = new Date()): boolean {
    const days = read().schedule.weekdays;
    if (!days.length) return false;
    return days.includes(date.getDay() as RedacaoWeekday);
  },
};
