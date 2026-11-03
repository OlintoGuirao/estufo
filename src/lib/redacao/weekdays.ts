import type { RedacaoWeekday } from "@/types/redacao";

export const REDACAO_WEEKDAYS: { value: RedacaoWeekday; label: string; short: string }[] = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export function formatWeekdays(days: RedacaoWeekday[]): string {
  if (!days.length) return "Nenhum dia escolhido";
  return days
    .map((d) => REDACAO_WEEKDAYS.find((w) => w.value === d)?.label ?? String(d))
    .join(", ");
}
