import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, PenLine, Swords } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/common";
import { approvalTrailService } from "@/services/approval-trail.service";
import { trailProgressService } from "@/services/trail-progress.service";
import { studyScheduleStore } from "@/services/study-schedule-store";
import {
  buildMonthDayInfos,
  buildTodayTasks,
  dateKey,
  type CalendarDayInfo,
  type DayTone,
} from "@/lib/painel/study-calendar";
import { cn } from "@/lib/utils";
import type { TrailWeekProgress } from "@/types/trail-progress";
import { ptBR } from "react-day-picker/locale/pt-BR";

const TONE_CLASS: Record<DayTone, string> = {
  overdue: "bg-red-500/20 text-red-800 hover:bg-red-500/30 dark:text-red-200",
  today: "bg-amber-500/25 text-amber-950 hover:bg-amber-500/35 dark:text-amber-100",
  done: "bg-emerald-500/20 text-emerald-900 hover:bg-emerald-500/30 dark:text-emerald-200",
  upcoming: "bg-primary/10 text-primary hover:bg-primary/15",
  idle: "",
};

const TASK_BORDER: Record<TodayTaskTone, string> = {
  overdue: "border-red-500/40 bg-red-500/5",
  today: "border-amber-500/40 bg-amber-500/5",
  done: "border-emerald-500/40 bg-emerald-500/5",
};

type TodayTaskTone = "overdue" | "today" | "done";

function infosToModifierDates(infos: CalendarDayInfo[], tone: DayTone): Date[] {
  return infos.filter((i) => i.tone === tone).map((i) => i.date);
}

export function StudyDayCalendar() {
  const [month, setMonth] = useState(() => new Date());

  const scheduleQ = useQuery({
    queryKey: ["study-schedule"],
    queryFn: () => studyScheduleStore.hydrate(),
  });
  const trailQ = useQuery({
    queryKey: ["approval-trail"],
    queryFn: () => approvalTrailService.hydrate(),
  });
  const progressQ = useQuery({
    queryKey: ["trail-progress-all", trailQ.data?.id],
    queryFn: () => trailProgressService.hydrateAll(trailQ.data!.id),
    enabled: !!trailQ.data?.id,
  });

  const schedule = scheduleQ.data ?? studyScheduleStore.get();
  const progressByWeek = useMemo(() => {
    const map = new Map<number, TrailWeekProgress>();
    for (const p of progressQ.data ?? []) map.set(p.week, p);
    return map;
  }, [progressQ.data]);

  const dayInfos = useMemo(
    () =>
      buildMonthDayInfos({
        month,
        trail: trailQ.data ?? null,
        schedule,
        progressByWeek,
      }),
    [month, trailQ.data, schedule, progressByWeek],
  );

  const byKey = useMemo(() => {
    const map = new Map<string, CalendarDayInfo>();
    for (const i of dayInfos) map.set(i.dateKey, i);
    return map;
  }, [dayInfos]);

  const todayTasks = useMemo(
    () =>
      buildTodayTasks({
        trail: trailQ.data ?? null,
        schedule,
        progressByWeek,
      }),
    [trailQ.data, schedule, progressByWeek],
  );

  const overdueDates = infosToModifierDates(dayInfos, "overdue");
  const todayDates = infosToModifierDates(dayInfos, "today");
  const doneDates = infosToModifierDates(dayInfos, "done");
  const upcomingDates = infosToModifierDates(dayInfos, "upcoming");
  const redacaoDates = dayInfos.filter((i) => i.isRedacao).map((i) => i.date);
  const examDates = dayInfos.filter((i) => i.isExam).map((i) => i.date);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Panel title="Calendário de estudos">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          locale={ptBR}
          className="w-full [--cell-size:2.4rem]"
          classNames={{ today: "rounded-md" }}
          modifiers={{
            overdue: overdueDates,
            dueToday: todayDates,
            done: doneDates,
            upcoming: upcomingDates,
            redacao: redacaoDates,
            exam: examDates,
          }}
          components={{
            DayButton: ({ day, className, ...props }) => {
              const info = byKey.get(dateKey(day.date));
              const tone = info?.tone ?? "idle";
              return (
                <button
                  type="button"
                  {...props}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center justify-center rounded-md text-sm",
                    TONE_CLASS[tone],
                    className,
                  )}
                >
                  <span>{day.date.getDate()}</span>
                  {(info?.isRedacao || info?.isExam) && (
                    <span className="mt-0.5 flex gap-0.5">
                      {info.isRedacao && (
                        <span className="h-1 w-1 rounded-full bg-violet-500" title="Redação" />
                      )}
                      {info.isExam && (
                        <span className="h-1 w-1 rounded-full bg-sky-500" title="Prova" />
                      )}
                    </span>
                  )}
                </button>
              );
            },
          }}
        />
        <ul className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500/50" /> Atrasado
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/60" /> Hoje
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/50" /> Concluído
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Redação
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Prova
          </li>
        </ul>
      </Panel>

      <Panel
        title="O que tenho que fazer hoje"
        action={
          <Link to="/configuracoes" className="text-sm text-primary">
            Agenda
          </Link>
        }
      >
        {!todayTasks.length ? (
          <p className="text-sm text-muted-foreground">
            Nada pendente para hoje. Se a segunda ficou atrasada, ela aparece em vermelho no
            calendário e na lista quando houver trilha.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => {
              const Icon =
                task.kind === "redacao" ? PenLine : task.kind === "exam" ? Swords : FileText;
              const body = (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-sm transition hover:border-primary/40",
                    TASK_BORDER[task.tone],
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      {task.tone === "overdue" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Atrasado
                        </Badge>
                      )}
                      {task.tone === "today" && task.kind !== "trail" && (
                        <Badge variant="secondary" className="text-[10px]">
                          Agenda
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{task.detail}</p>
                  </div>
                </div>
              );

              if (task.to === "/trilha/semana/$week" && task.params) {
                return (
                  <li key={task.id}>
                    <Link to="/trilha/semana/$week" params={task.params}>
                      {body}
                    </Link>
                  </li>
                );
              }
              if (task.to === "/redacao") {
                return (
                  <li key={task.id}>
                    <Link to="/redacao">{body}</Link>
                  </li>
                );
              }
              if (task.to === "/simulados") {
                return (
                  <li key={task.id}>
                    <Link to="/simulados">{body}</Link>
                  </li>
                );
              }
              return (
                <li key={task.id}>
                  <Link to="/trilha">{body}</Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
