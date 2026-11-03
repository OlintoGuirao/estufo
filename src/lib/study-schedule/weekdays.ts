import type { StudyWeekday } from "@/types/study-schedule";

/** Segunda a sábado (pedido do aluno). Domingo opcional. */
export const STUDY_WEEKDAYS: { value: StudyWeekday; label: string; short: string }[] = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export function formatStudyWeekdays(days: StudyWeekday[]): string {
  if (!days.length) return "Nenhum dia";
  return days
    .map((d) => STUDY_WEEKDAYS.find((w) => w.value === d)?.label ?? String(d))
    .join(", ");
}

export function toggleDay(days: StudyWeekday[], day: StudyWeekday, on: boolean): StudyWeekday[] {
  const set = new Set(days);
  if (on) set.add(day);
  else set.delete(day);
  return [...set].sort((a, b) => a - b) as StudyWeekday[];
}
