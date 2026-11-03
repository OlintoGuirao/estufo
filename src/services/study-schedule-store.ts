import type { StudySchedule, StudyWeekday } from "@/types/study-schedule";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";

const KEY = "estufoo.study-schedule.v1";

function empty(): StudySchedule {
  return {
    studyDays: [1, 2, 3, 4, 5],
    redacaoDays: [6],
    examDays: [6],
    updatedAt: new Date().toISOString(),
  };
}

function read(): StudySchedule {
  if (typeof window === "undefined") return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as StudySchedule | null;
    if (!raw || typeof raw !== "object") return empty();
    return {
      studyDays: Array.isArray(raw.studyDays) ? (raw.studyDays as StudyWeekday[]) : empty().studyDays,
      redacaoDays: Array.isArray(raw.redacaoDays)
        ? (raw.redacaoDays as StudyWeekday[])
        : empty().redacaoDays,
      examDays: Array.isArray(raw.examDays) ? (raw.examDays as StudyWeekday[]) : empty().examDays,
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    return empty();
  }
}

function write(schedule: StudySchedule) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(schedule));
  } catch {
    /* ignore */
  }
  syncRemote(schedule);
  syncRedacao(schedule.redacaoDays);
}

function syncRedacao(days: StudyWeekday[]) {
  void import("./redacao-store")
    .then(({ redacaoStore }) => {
      redacaoStore.setSchedule(days as import("@/types/redacao").RedacaoWeekday[]);
    })
    .catch(() => {});
}

function syncRemote(schedule: StudySchedule) {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const sb = requireSupabase();
      await sb.from("user_study_schedule").upsert(
        {
          device_id: getStudyOwnerId(),
          payload: schedule,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    } catch (err) {
      console.warn("[study-schedule] sync falhou", err);
    }
  })();
}

export const studyScheduleStore = {
  get(): StudySchedule {
    return read();
  },

  async hydrate(): Promise<StudySchedule> {
    const local = read();
    if (!isSupabaseConfigured) return local;
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("user_study_schedule")
        .select("payload")
        .in("device_id", studyOwnerQueryIds())
        .limit(1);
      if (error) throw error;
      const remote = data?.[0]?.payload as StudySchedule | undefined;
      if (remote && typeof remote === "object") {
        const next: StudySchedule = {
          studyDays: Array.isArray(remote.studyDays)
            ? (remote.studyDays as StudyWeekday[])
            : local.studyDays,
          redacaoDays: Array.isArray(remote.redacaoDays)
            ? (remote.redacaoDays as StudyWeekday[])
            : local.redacaoDays,
          examDays: Array.isArray(remote.examDays)
            ? (remote.examDays as StudyWeekday[])
            : local.examDays,
          updatedAt: remote.updatedAt || new Date().toISOString(),
        };
        write(next);
        return next;
      }
    } catch (err) {
      console.warn("[study-schedule] hydrate falhou", err);
    }
    return local;
  },

  set(partial: Partial<Pick<StudySchedule, "studyDays" | "redacaoDays" | "examDays">>): StudySchedule {
    const cur = read();
    const next: StudySchedule = {
      studyDays: partial.studyDays ?? cur.studyDays,
      redacaoDays: partial.redacaoDays ?? cur.redacaoDays,
      examDays: partial.examDays ?? cur.examDays,
      updatedAt: new Date().toISOString(),
    };
    write(next);
    return next;
  },

  isStudyDay(date = new Date()): boolean {
    return read().studyDays.includes(date.getDay() as StudyWeekday);
  },

  isRedacaoDay(date = new Date()): boolean {
    return read().redacaoDays.includes(date.getDay() as StudyWeekday);
  },

  isExamDay(date = new Date()): boolean {
    return read().examDays.includes(date.getDay() as StudyWeekday);
  },
};
