import { request, qs } from "./api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/utils";
import { getContestFromSupabase } from "./supabase/catalog";
import { authService } from "./auth.service";
import type { DashboardData, Notification, PerformanceData } from "@/types";

export const dashboardService = {
  async get(): Promise<DashboardData> {
    const data = await request<DashboardData>("GET", "/dashboard");

    if (!isSupabaseConfigured) {
      return {
        ...data,
        dataNote: "Dados demonstrativos (mock). Configure o Supabase para usar o banco.",
      };
    }

    // Com Supabase: painel sem demo — preenche concurso ativo do banco e métricas locais.
    let contest = data.contest;
    try {
      const me = await authService.me();
      if (me.activeContestId && isUuid(me.activeContestId)) {
        const c = await getContestFromSupabase(me.activeContestId);
        contest = { name: c.name, examDate: c.examDate };
      } else {
        contest = null;
      }
    } catch {
      contest = null;
    }

    const states = Object.values(
      // localQuestionState não exporta all — lê via get em ids conhecidos é ruim;
      // usa storage direto
      (() => {
        try {
          return JSON.parse(localStorage.getItem("estufoo.local-question-state") || "{}") as Record<
            string,
            { answered: { correct: boolean } | null }
          >;
        } catch {
          return {};
        }
      })(),
    );
    const answered = states.filter((s) => s.answered).length;
    const correct = states.filter((s) => s.answered?.correct).length;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

    return {
      ...data,
      contest,
      answered,
      accuracy,
      // Limpa agregados que vinham do mock fictício
      weakest: [],
      strongest: [],
      progress: data.today.length ? data.progress : 0,
      dataNote:
        "Catálogo no Supabase. Plano/revisões/simulados começam vazios; respostas de questões ficam neste navegador.",
    };
  },

  performance: (period: "semanal" | "mensal") =>
    request<PerformanceData>("GET", `/performance${qs({ period })}`),

  notifications: () => request<Notification[]>("GET", "/notifications"),

  readNotification: (id: string) => request<Notification>("POST", `/notifications/${id}/read`),
};
