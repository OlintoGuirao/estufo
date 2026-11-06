/** Carrega (no cliente) o resumo do aluno enviado ao Professor IA. */
import { buildStudentProfileText } from "@/lib/tutor/student-profile";
import { tutorDifficultyStore } from "./tutor-difficulty-store";

let cache: { at: number; notes: { subject: string; topic: string }[] } | null = null;

async function loadErrorNotes(): Promise<{ subject: string; topic: string }[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.notes;
  try {
    const { errorNotesService } = await import("./index");
    const list = await Promise.race([
      errorNotesService.list(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2_000)),
    ]);
    const notes = (list ?? []).map((n) => ({ subject: n.subject ?? "", topic: n.topic ?? "" }));
    cache = { at: Date.now(), notes };
    return notes;
  } catch {
    return cache?.notes ?? [];
  }
}

/** Nunca lança: sem dados, devolve string vazia. */
export async function getStudentProfileText(subject?: string): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const [errorNotes, difficulties] = await Promise.all([
      loadErrorNotes(),
      Promise.resolve(tutorDifficultyStore.list()),
    ]);
    return buildStudentProfileText({
      errorNotes,
      difficulties,
      ...(subject ? { currentSubject: subject } : {}),
    });
  } catch {
    return "";
  }
}
