import { describe, expect, it } from "vitest";
import {
  groupErrorNotesBySubject,
  groupErrorNotesByWeek,
  isoWeekKey,
} from "./study-errors";
import type { ErrorNote } from "@/types";

const note = (partial: Partial<ErrorNote> & Pick<ErrorNote, "id" | "createdAt">): ErrorNote => ({
  questionId: partial.questionId ?? partial.id,
  subject: partial.subject ?? "Penal",
  topic: partial.topic ?? "Peculato",
  statement: partial.statement ?? "Enunciado",
  yourKey: partial.yourKey ?? "B",
  correctKey: partial.correctKey ?? "A",
  explanation: partial.explanation ?? "",
  reasonCode: partial.reasonCode ?? "nao-sabia",
  origin: partial.origin ?? "simulado",
  ...partial,
});

describe("isoWeekKey", () => {
  it("gera chave estável", () => {
    expect(isoWeekKey("2026-10-28T12:00:00.000Z")).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("groupErrorNotes", () => {
  it("agrupa por matéria e semana", () => {
    const notes = [
      note({ id: "1", createdAt: "2026-10-27T12:00:00.000Z", subject: "Penal" }),
      note({ id: "2", createdAt: "2026-10-28T12:00:00.000Z", subject: "Português" }),
      note({ id: "3", createdAt: "2026-10-28T15:00:00.000Z", subject: "Penal" }),
    ];
    expect(groupErrorNotesBySubject(notes).map((g) => g.subject)).toEqual([
      "Penal",
      "Português",
    ]);
    expect(groupErrorNotesByWeek(notes).length).toBeGreaterThanOrEqual(1);
  });
});
