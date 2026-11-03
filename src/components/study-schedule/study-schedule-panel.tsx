import { useEffect, useState } from "react";
import { CalendarDays, FileText, PenLine, Swords } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { STUDY_WEEKDAYS, toggleDay } from "@/lib/study-schedule/weekdays";
import { studyScheduleStore } from "@/services/study-schedule-store";
import type { StudySchedule, StudyWeekday } from "@/types/study-schedule";

type Kind = "studyDays" | "redacaoDays" | "examDays";

const ROWS: {
  kind: Kind;
  title: string;
  hint: string;
  icon: typeof CalendarDays;
}[] = [
  {
    kind: "studyDays",
    title: "Dias de estudo",
    hint: "Conteúdo da trilha e matérias cadastradas.",
    icon: CalendarDays,
  },
  {
    kind: "redacaoDays",
    title: "Dias de redação",
    hint: "Quando você vai escrever e corrigir redação.",
    icon: PenLine,
  },
  {
    kind: "examDays",
    title: "Dias de prova",
    hint: "Simulado / prova com base nos conteúdos da trilha.",
    icon: Swords,
  },
];

export function StudySchedulePanel() {
  const [schedule, setSchedule] = useState<StudySchedule>(() => studyScheduleStore.get());

  useEffect(() => {
    void studyScheduleStore.hydrate().then(setSchedule);
  }, []);

  const toggle = (kind: Kind, day: StudyWeekday, on: boolean) => {
    const nextDays = toggleDay(schedule[kind], day, on);
    const next = studyScheduleStore.set({ [kind]: nextDays });
    setSchedule(next);
    toast.success("Agenda atualizada.");
  };

  return (
    <div className="space-y-5 text-sm">
      <p className="text-muted-foreground">
        Escolha de <strong>segunda a sábado</strong> quando estudar, fazer redação e fazer prova
        (conteúdo da trilha).
      </p>

      {ROWS.map((row) => {
        const Icon = row.icon;
        const selected = schedule[row.kind];
        return (
          <div key={row.kind} className="rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              <p className="font-medium">{row.title}</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{row.hint}</p>
            <div className="flex flex-wrap gap-2">
              {STUDY_WEEKDAYS.map((d) => {
                const checked = selected.includes(d.value);
                return (
                  <label
                    key={`${row.kind}-${d.value}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(row.kind, d.value, v === true)}
                    />
                    <span>{d.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        A agenda de redação também alimenta o menu Redação. A prova usa as etapas da Trilha da
        aprovação.
      </p>
    </div>
  );
}
