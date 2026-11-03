import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Loader2, PenLine, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/common";
import { formatWeekdays } from "@/lib/redacao/weekdays";
import { STUDY_WEEKDAYS } from "@/lib/study-schedule/weekdays";
import { approvalTrailService } from "@/services/approval-trail.service";
import { generateRedacaoThemesFn } from "@/services/redacao.fns";
import { redacaoStore } from "@/services/redacao-store";
import { studyScheduleStore } from "@/services/study-schedule-store";
import type { RedacaoWeekday } from "@/types/redacao";
import type { StudyWeekday } from "@/types/study-schedule";

const QK = ["redacao"] as const;

export const Route = createFileRoute("/_area/redacao/")({
  head: () => ({
    meta: [
      { title: "Redação — Estufoo" },
      {
        name: "description",
        content: "Temas prováveis pelo edital, correção com IA e agenda semanal.",
      },
    ],
  }),
  component: RedacaoIndexPage,
});

function RedacaoIndexPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);
  void tick;

  useQuery({
    queryKey: [...QK, "hydrate"],
    queryFn: async () => {
      await approvalTrailService.hydrate();
      await studyScheduleStore.hydrate();
      const sched = studyScheduleStore.get();
      // Espelha Configurações → Redação
      redacaoStore.setSchedule(sched.redacaoDays as RedacaoWeekday[]);
      return redacaoStore.hydrate();
    },
  });

  const state = redacaoStore.get();
  const trail = approvalTrailService.get();
  const isDay = studyScheduleStore.isRedacaoDay() || redacaoStore.isEssayDay();
  const openImps = redacaoStore.openImprovements();

  const saveDays = (day: StudyWeekday, checked: boolean) => {
    const cur = new Set(studyScheduleStore.get().redacaoDays);
    if (checked) cur.add(day);
    else cur.delete(day);
    const days = [...cur].sort((a, b) => a - b) as StudyWeekday[];
    studyScheduleStore.set({ redacaoDays: days });
    redacaoStore.setSchedule(days as RedacaoWeekday[]);
    setTick((t) => t + 1);
    toast.success("Agenda de redação atualizada.");
  };

  const gen = useMutation({
    mutationFn: async () => {
      const open = redacaoStore.openImprovements().map((p) => `${p.area}: ${p.tip}`);
      return generateRedacaoThemesFn({
        data: {
          contestName: trail?.contestName,
          organ: trail?.organ,
          role: trail?.role,
          board: trail?.board,
          summary: trail?.summary,
          subjects: trail?.subjects?.map((s) => s.name) ?? [],
          openImprovements: open,
          count: 5,
        },
      });
    },
    onSuccess: (res) => {
      redacaoStore.addThemes(res.themes);
      setTick((t) => t + 1);
      qc.invalidateQueries({ queryKey: QK });
      toast.success(
        res.mocked
          ? "Temas de demonstração gerados (configure a IA para temas sob medida)."
          : `${res.themes.length} temas gerados com base no edital.`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar temas.");
    },
  });

  const start = (themeId: string) => {
    const theme = redacaoStore.getTheme(themeId);
    if (!theme) return;
    const essay = redacaoStore.startEssay(theme);
    void navigate({ to: "/redacao/$essayId", params: { essayId: essay.id } });
  };

  const essays = redacaoStore.listEssays();
  const themes = redacaoStore.listThemes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redação"
        description="Temas atuais e prováveis com base no edital. Ao concluir, a IA corrige e leva os pontos a melhorar para a próxima."
      />

      {isDay && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Hoje é dia de redação</p>
          <p className="mt-0.5 text-muted-foreground">
            Conforme sua agenda ({formatWeekdays(state.schedule.weekdays)}). Escolha um tema e
            escreva.
          </p>
        </div>
      )}

      <Panel
        title="Dias da redação"
        action={
          <span className="text-xs text-muted-foreground">
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            Ex.: só sábado
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Segunda a sábado. Também pode ajustar em Configurações (junto com estudo e prova).
        </p>
        <div className="flex flex-wrap gap-3">
          {STUDY_WEEKDAYS.map((d) => {
            const checked = studyScheduleStore.get().redacaoDays.includes(d.value);
            return (
              <label
                key={d.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => saveDays(d.value, v === true)}
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </Panel>

      {openImps.length > 0 && (
        <Panel title="Levar para a próxima">
          <p className="mb-3 text-sm text-muted-foreground">
            Pontos abertos das correções anteriores — entram automaticamente no foco da próxima
            redação.
          </p>
          <ul className="space-y-2">
            {openImps.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="flex gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
              >
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{p.area}</p>
                  <p className="text-muted-foreground">{p.tip}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Temas prováveis"
        action={
          <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar temas
          </Button>
        }
      >
        {!trail && (
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
            Sem trilha do edital ainda — os temas usam um perfil genérico. Analise o edital em{" "}
            <Link to="/trilha" className="underline">
              Trilha da aprovação
            </Link>{" "}
            para temas mais aderentes.
          </p>
        )}
        {trail && (
          <p className="mb-3 text-sm text-muted-foreground">
            Base: {trail.contestName}
            {trail.board ? ` · banca ${trail.board}` : ""}
            {trail.role ? ` · ${trail.role}` : ""}
          </p>
        )}

        {!themes.length && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <PenLine className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Ainda sem temas. Clique em <strong>Gerar temas</strong> para a IA propor assuntos
            atuais e prováveis.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {themes.map((t) => (
            <article key={t.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={t.likelihood === "alta" ? "default" : "secondary"}>
                  {t.likelihood === "alta" ? "Alta chance" : "Média chance"}
                </Badge>
              </div>
              <h3 className="font-semibold leading-snug">{t.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.context}</p>
              <Button className="mt-4" size="sm" onClick={() => start(t.id)}>
                Escrever esta redação
              </Button>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Suas redações">
        {!essays.length && (
          <p className="text-sm text-muted-foreground">Nenhuma redação ainda.</p>
        )}
        <ul className="divide-y">
          {essays.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{e.themeTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {e.status === "corrigida" ? "Corrigida" : "Rascunho"} ·{" "}
                  {new Date(e.updatedAt).toLocaleDateString("pt-BR")}
                  {e.correction
                    ? ` · ${e.correction.score}/${e.correction.maxScore}`
                    : ""}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/redacao/$essayId" params={{ essayId: e.id }}>
                  Abrir
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
