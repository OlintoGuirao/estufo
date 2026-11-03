import type { ApprovalTrail, TrailSubject, TrailWeek } from "@/types/approval-trail";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou JSON válido do plano.");
  return JSON.parse(raw.slice(start, end + 1));
}

type AiShape = {
  contestName?: string;
  organ?: string;
  role?: string;
  board?: string;
  examDate?: string | null;
  summary?: string;
  subjects?: {
    name?: string;
    questionCountHint?: number | null;
    topics?: { name?: string; weightHint?: string; notes?: string }[];
  }[];
  weeks?: {
    week?: number;
    focus?: string;
    subjectNames?: string[];
    hoursSuggested?: number;
    activities?: string[];
  }[];
  warnings?: string[];
};

const WEIGHTS = new Set(["alta", "media", "baixa"]);

export function buildTrailFromAiText(
  aiText: string,
  meta: { fileName: string; sourceTextChars: number; mocked: boolean },
): ApprovalTrail {
  const data = extractJson(aiText) as AiShape;
  const now = new Date().toISOString();

  const subjects: TrailSubject[] = (data.subjects ?? [])
    .filter((s) => (s.name ?? "").trim())
    .map((s, i) => ({
      id: uid("sub"),
      name: String(s.name).trim(),
      questionCountHint:
        typeof s.questionCountHint === "number" && Number.isFinite(s.questionCountHint)
          ? s.questionCountHint
          : null,
      order: i + 1,
      topics: (s.topics ?? [])
        .filter((t) => (t.name ?? "").trim())
        .map((t) => ({
          id: uid("top"),
          name: String(t.name).trim(),
          weightHint: WEIGHTS.has(String(t.weightHint))
            ? (t.weightHint as "alta" | "media" | "baixa")
            : "media",
          notes: String(t.notes ?? "").trim(),
          status: "pendente" as const,
        })),
    }));

  const weeks: TrailWeek[] = (data.weeks ?? [])
    .filter((w) => Number.isFinite(w.week))
    .map((w) => ({
      week: Number(w.week),
      focus: String(w.focus ?? "").trim() || `Semana ${w.week}`,
      subjectNames: Array.isArray(w.subjectNames)
        ? w.subjectNames.map((x) => String(x)).filter(Boolean)
        : [],
      hoursSuggested:
        typeof w.hoursSuggested === "number" && w.hoursSuggested > 0 ? w.hoursSuggested : 10,
      activities: Array.isArray(w.activities)
        ? w.activities.map((x) => String(x)).filter(Boolean)
        : [],
    }))
    .sort((a, b) => a.week - b.week);

  if (!subjects.length) {
    throw new Error("Não foi possível extrair matérias do edital. Tente outro PDF ou revise o texto.");
  }

  return {
    id: uid("trail"),
    createdAt: now,
    updatedAt: now,
    fileName: meta.fileName,
    contestName: String(data.contestName ?? "").trim() || meta.fileName.replace(/\.pdf$/i, ""),
    organ: String(data.organ ?? "").trim() || "Não identificado",
    role: String(data.role ?? "").trim() || "Não identificado",
    board: String(data.board ?? "").trim() || "Não identificada",
    examDate: data.examDate ? String(data.examDate).slice(0, 10) : null,
    summary: String(data.summary ?? "").trim() || "Plano gerado a partir do conteúdo programático do edital.",
    subjects,
    weeks: weeks.length
      ? weeks
      : subjects.slice(0, 4).map((s, i) => ({
          week: i + 1,
          focus: s.name,
          subjectNames: [s.name],
          hoursSuggested: 12,
          activities: ["Teoria", "Questões", "Revisão"],
        })),
    warnings: Array.isArray(data.warnings)
      ? data.warnings.map((w) => String(w)).filter(Boolean)
      : [],
    sourceTextChars: meta.sourceTextChars,
    mocked: meta.mocked,
  };
}

export const EDITAL_PLAN_SYSTEM = `Você extrai APENAS metadados de um edital de concurso brasileiro.
As matérias e etapas de estudo JÁ FORAM extraídas do conteúdo programático (artigos, itens numerados).
NÃO invente matérias, NÃO resuma o conteúdo programático, NÃO devolva subjects.

Responda APENAS com JSON válido:
{
  "contestName": "string",
  "organ": "string",
  "role": "string",
  "board": "string",
  "examDate": "YYYY-MM-DD ou null",
  "summary": "2-4 frases: como estudar em cima do que o edital cobra (etapas/artigos), sem inventar tema",
  "warnings": ["avisos se o texto estiver incompleto"]
}`;

/** Metadados curtos quando a IA falha — matérias vêm do extrator. */
export function buildTrailMetaFromAiText(
  aiText: string,
  fallback: { fileName: string },
): {
  contestName: string;
  organ: string;
  role: string;
  board: string;
  examDate: string | null;
  summary: string;
  warnings: string[];
} {
  try {
    const data = extractJson(aiText) as AiShape;
    return {
      contestName:
        String(data.contestName ?? "").trim() || fallback.fileName.replace(/\.pdf$/i, ""),
      organ: String(data.organ ?? "").trim() || "Não identificado",
      role: String(data.role ?? "").trim() || "Não identificado",
      board: String(data.board ?? "").trim() || "Não identificada",
      examDate: data.examDate ? String(data.examDate).slice(0, 10) : null,
      summary:
        String(data.summary ?? "").trim() ||
        "Trilha montada a partir do conteúdo programático do edital, etapa por etapa.",
      warnings: Array.isArray(data.warnings)
        ? data.warnings.map((w) => String(w)).filter(Boolean)
        : [],
    };
  } catch {
    return {
      contestName: fallback.fileName.replace(/\.pdf$/i, ""),
      organ: "Não identificado",
      role: "Não identificado",
      board: "Não identificada",
      examDate: null,
      summary: "Trilha montada a partir do conteúdo programático do edital, etapa por etapa.",
      warnings: ["Metadados do edital incompletos; etapas vieram do conteúdo programático."],
    };
  }
}