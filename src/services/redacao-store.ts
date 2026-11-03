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

function write(state: RedacaoState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  syncRemote(state);
}

function syncRemote(state: RedacaoState) {
  if (!isSupabaseConfigured) return;
  void (async () => {
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
  })();
}

export const redacaoStore = {
  get(): RedacaoState {
    return read();
  },

  async hydrate(): Promise<RedacaoState> {
    const local = read();
    const hasData =
      local.themes.length > 0 ||
      local.essays.length > 0 ||
      local.openImprovements.length > 0 ||
      (local.schedule.weekdays.length > 0 && local.schedule.updatedAt);
    if ((hasData && local.essays.length + local.themes.length > 0) || !isSupabaseConfigured) {
      return local;
    }
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("user_redacao_state")
        .select("payload")
        .in("device_id", studyOwnerQueryIds())
        .limit(1);
      if (error) throw error;
      const remote = data?.[0]?.payload as RedacaoState | undefined;
      if (remote && typeof remote === "object") {
        const next: RedacaoState = {
          schedule: remote.schedule ?? emptyState().schedule,
          themes: Array.isArray(remote.themes) ? remote.themes : [],
          essays: Array.isArray(remote.essays) ? remote.essays : [],
          openImprovements: Array.isArray(remote.openImprovements)
            ? remote.openImprovements
            : [],
        };
        write(next);
        return next;
      }
    } catch (err) {
      console.warn("[redacao] hydrate falhou", err);
    }
    return local;
  },

  setSchedule(weekdays: RedacaoWeekday[]): RedacaoSchedule {
    const state = read();
    const unique = [...new Set(weekdays)].sort((a, b) => a - b) as RedacaoWeekday[];
    state.schedule = { weekdays: unique, updatedAt: new Date().toISOString() };
    write(state);
    return state.schedule;
  },

  addThemes(themes: RedacaoTheme[]): RedacaoTheme[] {
    const state = read();
    state.themes = [...themes, ...state.themes].slice(0, 40);
    write(state);
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
    write(state);
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
    write(state);
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

    // Marca no pool aberto
    state.openImprovements = state.openImprovements.map((p) => {
      if (resolvedSet.has(p.area.toLowerCase())) {
        return { ...p, status: "melhorou" as const };
      }
      return p;
    });

    // Novos pontos abertos (evita duplicar área+tip)
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
    write(state);
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
