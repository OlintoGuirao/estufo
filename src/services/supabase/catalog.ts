import { requireSupabase } from "@/lib/supabase";
import { isUuid } from "@/lib/utils";
import { localQuestionState } from "@/services/local-question-state";
import { ApiError } from "@/services/api";
import type {
  AnswerResult,
  Contest,
  ContestStatus,
  Difficulty,
  Paginated,
  Question,
  QuestionFilters,
  Subject,
} from "@/types";

type DbContest = {
  id: string;
  name: string;
  organ: string;
  role: string;
  board: string;
  status: ContestStatus;
  exam_date: string | null;
  vacancies: number;
  salary: number | string;
};

type DbSubject = { id: string; name: string };
type DbTopic = { id: string; name: string; subject_id: string };

type DbQuestionRow = {
  id: string;
  statement: string;
  board: string;
  year: number;
  contest_label: string | null;
  difficulty: Difficulty;
  source: string;
  correct_key: string;
  explanation: string;
  subjects: { name: string } | { name: string }[] | null;
  topics: { name: string } | { name: string }[] | null;
  question_alternatives: { key: string; text: string }[] | null;
};

function oneName(rel: { name: string } | { name: string }[] | null | undefined): string {
  if (!rel) return "";
  return Array.isArray(rel) ? (rel[0]?.name ?? "") : rel.name;
}

function mapQuestion(row: DbQuestionRow): Question {
  const st = localQuestionState.get(row.id);
  const alts = [...(row.question_alternatives ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  return {
    id: row.id,
    statement: row.statement,
    alternatives: alts.map((a) => ({ key: a.key.trim(), text: a.text })),
    board: row.board,
    year: row.year,
    contest: row.contest_label ?? "",
    subject: oneName(row.subjects),
    topic: oneName(row.topics),
    difficulty: row.difficulty,
    source: row.source,
    favorite: st.favorite,
    markedForReview: st.markedForReview,
    answered: st.answered,
  };
}

async function loadSubjectsTree(contestId: string): Promise<Subject[]> {
  const sb = requireSupabase();
  const { data: links, error: e1 } = await sb
    .from("contest_subjects")
    .select("subject_id, sort_order")
    .eq("contest_id", contestId)
    .order("sort_order");
  if (e1) throw new ApiError(e1.message, 502);
  const subjectIds = (links ?? []).map((l) => l.subject_id as string);
  if (!subjectIds.length) return [];

  const { data: subjects, error: e2 } = await sb.from("subjects").select("id, name").in("id", subjectIds);
  if (e2) throw new ApiError(e2.message, 502);
  const { data: topics, error: e3 } = await sb
    .from("topics")
    .select("id, name, subject_id")
    .in("subject_id", subjectIds);
  if (e3) throw new ApiError(e3.message, 502);

  const byId = new Map((subjects as DbSubject[] | null)?.map((s) => [s.id, s]) ?? []);
  const topicsBySub = new Map<string, { id: string; name: string }[]>();
  for (const t of (topics as DbTopic[] | null) ?? []) {
    const list = topicsBySub.get(t.subject_id) ?? [];
    list.push({ id: t.id, name: t.name });
    topicsBySub.set(t.subject_id, list);
  }

  return subjectIds
    .map((id) => byId.get(id))
    .filter((s): s is DbSubject => !!s)
    .map((s) => ({
      id: s.id,
      name: s.name,
      topics: topicsBySub.get(s.id) ?? [],
    }));
}

function mapContest(row: DbContest, subjects: Subject[]): Contest {
  return {
    id: row.id,
    name: row.name,
    organ: row.organ,
    role: row.role,
    board: row.board,
    status: row.status,
    examDate: row.exam_date ?? "",
    vacancies: Number(row.vacancies) || 0,
    salary: Number(row.salary) || 0,
    subjects,
  };
}

export async function listContestsFromSupabase(f: {
  search?: string;
  board?: string;
  status?: string;
}): Promise<Contest[]> {
  const sb = requireSupabase();
  let q = sb.from("contests").select("*").order("exam_date", { ascending: true });
  if (f.board) q = q.eq("board", f.board);
  if (f.status && f.status !== "todos") q = q.eq("status", f.status);

  const { data, error } = await q;
  if (error) throw new ApiError(error.message, 502);

  let rows = (data as DbContest[] | null) ?? [];
  const s = (f.search || "").toLowerCase().trim();
  if (s) {
    rows = rows.filter((x) =>
      [x.name, x.organ, x.role].some((v) => v.toLowerCase().includes(s)),
    );
  }

  const out: Contest[] = [];
  for (const row of rows) {
    out.push(mapContest(row, await loadSubjectsTree(row.id)));
  }
  return out;
}

export async function getContestFromSupabase(id: string): Promise<Contest> {
  // IDs de mock (ex.: "c3") não são UUID — o PostgREST responde 400.
  if (!isUuid(id)) {
    throw new ApiError("Concurso inválido. Escolha um concurso em /concursos.", 404);
  }
  const sb = requireSupabase();
  const { data, error } = await sb.from("contests").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiError(error.message, 502);
  if (!data) throw new ApiError("Concurso não encontrado.", 404);
  return mapContest(data as DbContest, await loadSubjectsTree(id));
}

const QUESTION_SELECT = `
  id, statement, board, year, contest_label, difficulty, source, correct_key, explanation,
  subjects ( name ),
  topics ( name ),
  question_alternatives ( key, text )
`;

export async function listQuestionsFromSupabase(
  f: QuestionFilters,
): Promise<Paginated<Question>> {
  const sb = requireSupabase();
  let q = sb.from("questions").select(QUESTION_SELECT, { count: "exact" });

  if (f.board) q = q.eq("board", f.board);
  if (f.year) q = q.eq("year", Number(f.year));
  if (f.difficulty) q = q.eq("difficulty", f.difficulty);
  if (f.contest) q = q.ilike("contest_label", `%${f.contest}%`);

  // Busca o conjunto filtrado no servidor; paginação/filtros de estado local no client.
  const { data, error } = await q.order("year", { ascending: false }).limit(500);
  if (error) throw new ApiError(error.message, 502);

  let items = ((data as DbQuestionRow[] | null) ?? []).map(mapQuestion);

  if (f.subject) items = items.filter((x) => x.subject === f.subject);
  if (f.status === "respondidas") items = items.filter((x) => !!x.answered);
  if (f.status === "nao-respondidas") items = items.filter((x) => !x.answered);
  if (f.status === "erradas") items = items.filter((x) => x.answered && !x.answered.correct);
  if (f.status === "favoritas") items = items.filter((x) => x.favorite);

  const page = Number(f.page || 1);
  const pageSize = 5;
  const total = items.length;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);

  return { items: slice, total, page, pageSize };
}

export async function getQuestionFromSupabase(id: string): Promise<Question> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("questions").select(QUESTION_SELECT).eq("id", id).maybeSingle();
  if (error) throw new ApiError(error.message, 502);
  if (!data) throw new ApiError("Questão não encontrada.", 404);
  return mapQuestion(data as DbQuestionRow);
}

export async function answerQuestionFromSupabase(
  id: string,
  choice: string,
): Promise<AnswerResult> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("questions")
    .select("correct_key, explanation")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 502);
  if (!data) throw new ApiError("Questão não encontrada.", 404);

  const correctKey = String((data as { correct_key: string }).correct_key).trim().toUpperCase();
  const explanation = String((data as { explanation: string }).explanation ?? "");
  const correct = choice.toUpperCase() === correctKey;
  localQuestionState.upsert(id, { answered: { choice: choice.toUpperCase(), correct } });
  return { correct, correctKey, explanation };
}

export async function toggleFavoriteFromSupabase(id: string): Promise<Question> {
  localQuestionState.toggleFavorite(id);
  return getQuestionFromSupabase(id);
}

export async function toggleReviewFromSupabase(id: string): Promise<Question> {
  localQuestionState.toggleReview(id);
  return getQuestionFromSupabase(id);
}
