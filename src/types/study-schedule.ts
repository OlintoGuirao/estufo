/** Dias da agenda semanal (0 = domingo … 6 = sábado). */
export type StudyWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StudySchedule = {
  /** Dias de estudo (conteúdo da trilha / matérias). */
  studyDays: StudyWeekday[];
  /** Dias de redação. */
  redacaoDays: StudyWeekday[];
  /** Dias de prova/simulado com base na trilha. */
  examDays: StudyWeekday[];
  updatedAt: string;
};
