// @ts-nocheck -- camada de mock temporária
/* eslint-disable @typescript-eslint/no-explicit-any */
// Camada de MOCK temporária. Simula a API REST em memória (persistida no navegador).
import { ApiError } from "../api";
import { db, scrubPersistedDemoCatalog, today, USE_SUPABASE_CATALOG } from "./data";
import type { ErrorNote, MindMap, Review, StudySession, User } from "@/types";
import {
  accuracyBySubject,
  addDaysIso,
  aggregateWrongByTopic,
  buildRecommendation,
  daysBetween,
  explainSrsInterval,
  intervalForConfidence,
  masteryFromConfidence,
  splitDuration,
} from "@/lib/study-cycle";
import { layoutOutline, layoutStudyPack } from "@/lib/mind-map/layout";
import { buildPerformanceData } from "@/lib/unified-performance";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  mergeRemoteIntoMockDb,
  studyUserDataDb,
  syncStudyMockSlice,
} from "@/services/study-user-data-db";
import { tjspBancoCatalog } from "@/services/tjsp-banco.catalog";
import { DEMO_AUTH } from "./demo-auth";

const STORAGE = "estufoo.mockdb";
const delay = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
const uid = () => Math.random().toString(36).slice(2, 10);

let loaded = false;
let remoteHydrated = false;
let remoteHydratePromise: Promise<void> | null = null;

function ensureDemoUser() {
  if (!Array.isArray(db.users)) db.users = [];
  const exists = db.users.some((u) => u.email === DEMO_AUTH.email);
  if (exists) return;
  db.users.push({
    id: "demo",
    name: DEMO_AUTH.name,
    email: DEMO_AUTH.email,
    password: DEMO_AUTH.password,
    onboarded: true,
    activeContestId: null,
  });
}

function mergeLegacyUsersIntoDb() {
  try {
    const legacy = JSON.parse(localStorage.getItem("aprovamind.mockdb") || "null") as {
      users?: Array<User & { password: string }>;
    } | null;
    const legacyUsers = Array.isArray(legacy?.users) ? legacy!.users! : [];
    if (!legacyUsers.length) return;
    if (!Array.isArray(db.users)) db.users = [];
    const emails = new Set(db.users.map((u) => u.email.toLowerCase()));
    for (const u of legacyUsers) {
      const email = String(u.email ?? "").toLowerCase();
      if (!email || emails.has(email)) continue;
      db.users.push(u);
      emails.add(email);
    }
  } catch {
    /* ignore */
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (saved) {
      const cleaned = scrubPersistedDemoCatalog(saved);
      Object.assign(db, cleaned);
      // Regrava limpo para não ressuscitar demo no próximo reload
      if (USE_SUPABASE_CATALOG) {
        try {
          localStorage.setItem(STORAGE, JSON.stringify(db));
        } catch {
          /* ignore */
        }
      }
    }
    if (!Array.isArray(db.users)) db.users = [];
    if (!Array.isArray(db.errorNotes)) db.errorNotes = [];
    if (!Array.isArray(db.reviews)) db.reviews = [];
    if (!Array.isArray(db.sessions)) db.sessions = [];
    if (!Array.isArray(db.exams)) db.exams = [];
    if (!db.examResults || typeof db.examResults !== "object") db.examResults = {};
    if (USE_SUPABASE_CATALOG) {
      db.contests = [];
      db.questions = [];
      db.notifications = [];
      // Simulados do aluno voltam do Supabase no hydrate (não ficam só no local).
      db.exams = [];
      db.examResults = {};
    }
  } catch {
    /* ignore */
  }
  // Contas criadas no AprovaMind (mesmo browser) voltam a funcionar.
  mergeLegacyUsersIntoDb();
  ensureDemoUser();
  persistLocal();
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function persist() {
  persistLocal();
  syncStudyMockSlice({
    errorNotes: db.errorNotes,
    exams: db.exams,
    examResults: db.examResults,
    reviews: db.reviews,
    sessions: db.sessions,
  });
}

async function ensureRemoteHydrated() {
  if (remoteHydrated || !isSupabaseConfigured || typeof window === "undefined") return;
  if (remoteHydratePromise) {
    await remoteHydratePromise;
    return;
  }
  remoteHydratePromise = (async () => {
    try {
      const remote = await studyUserDataDb.loadAll();
      const hadLocalNotes = (db.errorNotes?.length ?? 0) > 0;
      const hadLocalSessions = (db.sessions?.length ?? 0) > 0;
      mergeRemoteIntoMockDb(db, remote, {
        preferRemoteExams: USE_SUPABASE_CATALOG || !(db.exams?.length),
      });
      // Se o local estava vazio e o remoto trouxe dados, grava local sem re-push imediato desnecessário.
      if (
        (!hadLocalNotes && remote.errorNotes.length) ||
        (!hadLocalSessions && remote.sessions.length) ||
        remote.exams.length ||
        remote.reviews.length
      ) {
        persistLocal();
      }
    } catch (err) {
      console.warn("[mock] hydrate study user data falhou", err);
    } finally {
      remoteHydrated = true;
    }
  })();
  await remoteHydratePromise;
}

function currentUser(token: string | null) {
  const u = db.users.find((x) => `mock-${x.id}` === token);
  if (!u) throw new ApiError("Sessão expirada. Entre novamente.", 401);
  return u;
}
const publicUser = ({ password: _p, ...u }: User & { password: string }): User => u;

function isPublicAuthPath(method: string, fullPath: string): boolean {
  if (method !== "POST") return false;
  const path = fullPath.split("?")[0] ?? "";
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/forgot-password"
  );
}

export async function mockRequest(method: string, fullPath: string, body: any, token: string | null): Promise<unknown> {
  load();
  // Login/cadastro não podem depender do hydrate do Supabase (senão trava o "Entrar").
  if (isPublicAuthPath(method, fullPath)) {
    void ensureRemoteHydrated();
  } else {
    await Promise.race([
      ensureRemoteHydrated(),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  }
  await delay();
  const [path, query = ""] = fullPath.split("?");
  const q = Object.fromEntries(new URLSearchParams(query));
  const seg = path.split("/").filter(Boolean);
  const res = route(method, seg, q, body, token);
  persist();
  return res;
}

function route(method: string, seg: string[], q: Record<string, string>, body: any, token: string | null): unknown {
  const [a, b, c, d] = seg;
  // AUTH
  if (a === "auth") {
    if (b === "register" && method === "POST") {
      if (db.users.some((u) => u.email === body.email)) throw new ApiError("Este e-mail já está cadastrado.", 409);
      const u = { id: uid(), name: body.name, email: body.email, password: body.password, onboarded: false, activeContestId: null };
      db.users.push(u);
      return { token: `mock-${u.id}`, user: publicUser(u) };
    }
    if (b === "login") {
      const u = db.users.find((x) => x.email === body.email && x.password === body.password);
      if (!u) throw new ApiError("E-mail ou senha inválidos.", 400);
      return { token: `mock-${u.id}`, user: publicUser(u) };
    }
    if (b === "forgot-password") return { ok: true };
    if (b === "me") {
      const u = currentUser(token);
      if (method === "PATCH") Object.assign(u, body);
      return publicUser(u);
    }
  }
  const user = currentUser(token);

  if (a === "onboarding") {
    Object.assign(user, { onboarded: true, activeContestId: body.contestId });
    return publicUser(user);
  }

  if (a === "contests") {
    if (b === "import") {
      const c = { ...db.contests[0], id: uid(), name: `Edital importado — ${body.fileName}`, status: "previsto" as const };
      db.contests.push(c);
      return c;
    }
    if (b && c === "activate") {
      user.activeContestId = b;
      return publicUser(user);
    }
    if (b) return find(db.contests, b);
    const s = (q.search || "").toLowerCase();
    return db.contests.filter(
      (x) =>
        (!s || [x.name, x.organ, x.role].some((v) => v.toLowerCase().includes(s))) &&
        (!q.board || x.board === q.board) &&
        (!q.status || x.status === q.status),
    );
  }

  if (a === "questions") {
    if (b && c === "answers") {
      const qq = find(db.questions, b);
      const correct = body.choice === qq.correctKey;
      qq.answered = { choice: body.choice, correct };
      return { correct, correctKey: qq.correctKey, explanation: qq.explanation };
    }
    if (b && c === "favorite") {
      const qq = find(db.questions, b);
      qq.favorite = !qq.favorite;
      return strip(qq);
    }
    if (b && c === "review") {
      const qq = find(db.questions, b);
      qq.markedForReview = !qq.markedForReview;
      if (qq.markedForReview)
        db.reviews.push({ id: uid(), subject: qq.subject, topic: qq.topic, dueDate: today(), mastery: "baixo" });
      return strip(qq);
    }
    if (b) return strip(find(db.questions, b));
    let list = db.questions.filter(
      (x) =>
        (!q.contest || x.contest === q.contest) &&
        (!q.board || x.board === q.board) &&
        (!q.subject || x.subject === q.subject) &&
        (!q.year || String(x.year) === q.year) &&
        (!q.difficulty || x.difficulty === q.difficulty),
    );
    if (q.status === "respondidas") list = list.filter((x) => x.answered);
    if (q.status === "nao-respondidas") list = list.filter((x) => !x.answered);
    if (q.status === "erradas") list = list.filter((x) => x.answered && !x.answered.correct);
    if (q.status === "favoritas") list = list.filter((x) => x.favorite);
    const page = Number(q.page || 1);
    const pageSize = 5;
    return { items: list.slice((page - 1) * pageSize, page * pageSize).map(strip), total: list.length, page, pageSize };
  }

  if (a === "study-plan") {
    if (b === "sessions" && c && d === "reschedule" && method === "POST") {
      const s = find(db.sessions, c) as StudySession;
      const prev = s.date;
      s.date = body.date;
      s.status = "planejada";
      s.history = [...(s.history ?? []), { at: new Date().toISOString(), action: "rescheduled", detail: `${prev} → ${body.date}` }];
      return s;
    }
    if (b === "sessions" && c && d === "split" && method === "POST") {
      const s = find(db.sessions, c) as StudySession;
      const parts = splitDuration(s.durationMin, Number(body.parts || 2));
      if (parts.length < 2) throw new ApiError("Duração insuficiente para dividir (mín. 20 min em 2 blocos).", 400);
      const created: StudySession[] = [];
      parts.forEach((durationMin, i) => {
        const child: StudySession = {
          id: uid(),
          date: body.dates?.[i] || s.date,
          subject: s.subject,
          topic: s.topic,
          activity: s.activity,
          durationMin,
          priority: s.priority,
          status: "planejada",
          parentId: s.id,
          history: [{ at: new Date().toISOString(), action: "created", detail: `Dividida de ${s.id} (${s.durationMin} min)` }],
        };
        db.sessions.push(child);
        created.push(child);
      });
      s.status = "concluida";
      s.history = [...(s.history ?? []), { at: new Date().toISOString(), action: "split", detail: `${parts.length} blocos: ${created.map((x) => x.id).join(", ")}` }];
      return { original: s, sessions: created };
    }
    if (method === "GET") return db.sessions.filter((s) => s.date >= q.from && s.date <= q.to).sort((x, y) => x.date.localeCompare(y.date));
    if (method === "POST") {
      const s: StudySession = {
        ...body,
        id: uid(),
        history: [{ at: new Date().toISOString(), action: "created" }],
      };
      db.sessions.push(s);
      return s;
    }
    if (method === "PATCH") {
      const s = find(db.sessions, c) as StudySession;
      const prevStatus = s.status;
      Object.assign(s, body);
      if (body.status && body.status !== prevStatus) {
        s.history = [...(s.history ?? []), { at: new Date().toISOString(), action: "status", detail: `${prevStatus} → ${body.status}` }];
      }
      return s;
    }
    if (method === "DELETE") {
      db.sessions = db.sessions.filter((s) => s.id !== c);
      void studyUserDataDb.removeSession(c).catch(() => {});
      return undefined;
    }
  }

  if (a === "error-notes") {
    if (b && c === "schedule-review" && method === "POST") {
      const note = find(db.errorNotes, b) as ErrorNote;
      let rv = db.reviews.find((r) => r.subject === note.subject && r.topic === note.topic);
      if (!rv) {
        rv = { id: uid(), subject: note.subject, topic: note.topic, dueDate: today(), mastery: "baixo" };
        db.reviews.push(rv);
      } else {
        rv.dueDate = today();
        rv.mastery = "baixo";
      }
      note.reviewId = rv.id;
      return { note, review: rv };
    }
    if (b && method === "DELETE") {
      db.errorNotes = db.errorNotes.filter((n) => n.id !== b);
      void studyUserDataDb.removeErrorNote(b).catch(() => {});
      return undefined;
    }
    if (method === "POST") {
      // Snapshot de qualquer fonte (simulado, quest, plano…) com enunciado.
      if (body.snapshot || body.origin === "simulado" || body.origin === "quest" || body.origin === "plano" || body.origin === "diagnostico" || body.origin === "revisao" || body.origin === "video-aula") {
        const qid = String(body.questionId);
        const existing = db.errorNotes.find((n) => n.questionId === qid);
        const payload: ErrorNote = {
          id: existing?.id ?? uid(),
          questionId: qid,
          subject: String(body.subject || "Geral"),
          topic: String(body.topic || "Geral"),
          statement: String(body.statement || "").slice(0, 2000),
          yourKey: String(body.yourKey || ""),
          correctKey: String(body.correctKey || ""),
          explanation: String(body.explanation || "").slice(0, 2000),
          reasonCode: body.reasonCode || "nao-sabia",
          reasonCustom: body.reasonCode === "outro" ? body.reasonCustom || null : null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          reviewId: existing?.reviewId ?? null,
          origin: body.origin || "local",
          externalId: null,
          sourceLabel: body.sourceLabel ? String(body.sourceLabel).slice(0, 120) : null,
        };
        if (existing) Object.assign(existing, payload);
        else db.errorNotes.push(payload);
        return payload;
      }
      // Questões do provedor: só ID externo + desempenho; sem enunciado/explicação persistidos.
      if (String(body.questionId).startsWith("ext:") || body.origin === "provider") {
        const qid = String(body.questionId);
        const existing = db.errorNotes.find((n) => n.questionId === qid);
        const payload: ErrorNote = {
          id: existing?.id ?? uid(),
          questionId: qid,
          subject: body.subject || "",
          topic: body.topic || "",
          statement: "",
          yourKey: body.yourKey || "",
          correctKey: body.correctKey || "",
          explanation: "",
          reasonCode: body.reasonCode,
          reasonCustom: body.reasonCode === "outro" ? body.reasonCustom || null : null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          reviewId: existing?.reviewId ?? null,
          origin: "provider",
          externalId: qid.startsWith("ext:") ? qid.slice(4) : qid,
          sourceLabel: "Provedor",
        };
        if (existing) Object.assign(existing, payload);
        else db.errorNotes.push(payload);
        return payload;
      }
      const qq = find(db.questions, body.questionId);
      if (!qq.answered || qq.answered.correct) throw new ApiError("Só é possível salvar erros de questões respondidas incorretamente.", 400);
      const existing = db.errorNotes.find((n) => n.questionId === qq.id);
      const payload: ErrorNote = {
        id: existing?.id ?? uid(),
        questionId: qq.id,
        subject: qq.subject,
        topic: qq.topic,
        statement: qq.statement,
        yourKey: qq.answered.choice,
        correctKey: qq.correctKey,
        explanation: qq.explanation,
        reasonCode: body.reasonCode,
        reasonCustom: body.reasonCode === "outro" ? body.reasonCustom || null : null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        reviewId: existing?.reviewId ?? null,
        origin: "local",
        externalId: null,
        sourceLabel: "Questões",
      };
      if (existing) Object.assign(existing, payload);
      else db.errorNotes.push(payload);
      return payload;
    }
    let list = [...db.errorNotes];
    if (q.subject) list = list.filter((n) => n.subject === q.subject);
    if (q.topic) list = list.filter((n) => n.topic === q.topic);
    if (q.origin) list = list.filter((n) => n.origin === q.origin);
    return list.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  if (a === "mock-exams") {
    if (!b && method === "GET") return [...db.exams].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    if (!b && method === "POST") {
      const count = Math.max(1, Math.min(80, Number(body.questionCount) || 10));
      const subjects = Array.isArray(body.subjects) ? body.subjects.map(String) : [];
      const picked = tjspBancoCatalog.pickForSimulado({ count, subjects });
      const e = {
        ...body,
        id: uid(),
        createdAt: new Date().toISOString(),
        status: "pendente" as const,
        questionCount: picked.length,
        questionIds: picked.map((x) => x.id),
        questionSource: "tjsp-banco" as const,
      };
      db.exams.push(e);
      return e;
    }
    const exam = find(db.exams, b) as typeof db.exams[number] & {
      questionIds?: string[];
      questionSource?: string;
    };
    const resolveExamQuestions = () => {
      if (exam.questionIds?.length) {
        return exam.questionIds
          .map((id) => {
            try {
              return tjspBancoCatalog.getQuestion(id);
            } catch {
              return null;
            }
          })
          .filter(Boolean) as ReturnType<typeof tjspBancoCatalog.getQuestion>[];
      }
      const pool = db.questions.filter((x) => exam.subjects.includes(x.subject));
      return (pool.length ? pool : db.questions).slice(0, exam.questionCount);
    };
    const questions = resolveExamQuestions();
    if (c === "result") {
      const r = db.examResults[b];
      if (!r) throw new ApiError("Resultado ainda não disponível.", 404);
      return r;
    }
    if (c === "submit") {
      const wrong: {
        id: string;
        statement: string;
        yourKey: string;
        correctKey: string;
        subject?: string;
        topic?: string;
        explanation?: string;
      }[] = [];
      const subj: Record<string, [number, number]> = {};
      const top: Record<string, [number, number]> = {};
      let ok = 0;
      questions.forEach((x) => {
        let correctKey = "";
        let explanation = "";
        if (tjspBancoCatalog.isBancoId(x.id)) {
          const raw = tjspBancoCatalog.getRaw(x.id);
          correctKey = (raw?.correctKey ?? "").toUpperCase();
          explanation = raw?.explanation ?? "";
        } else {
          correctKey = String((x as { correctKey?: string }).correctKey ?? "").toUpperCase();
          explanation = String((x as { explanation?: string }).explanation ?? "");
        }
        const yours = String(body.answers[x.id] ?? "").toUpperCase();
        const hit = !!yours && yours === correctKey;
        if (hit) ok++;
        else {
          wrong.push({
            id: x.id,
            statement: x.statement,
            yourKey: yours || "—",
            correctKey: correctKey || "—",
            subject: x.subject,
            topic: x.topic,
            explanation,
          });
        }
        if (tjspBancoCatalog.isBancoId(x.id) && yours) {
          try {
            tjspBancoCatalog.answer(x.id, yours);
          } catch {
            /* ignore */
          }
        }
        subj[x.subject] = [(subj[x.subject]?.[0] ?? 0) + (hit ? 1 : 0), (subj[x.subject]?.[1] ?? 0) + 1];
        top[x.topic] = [(top[x.topic]?.[0] ?? 0) + (hit ? 1 : 0), (top[x.topic]?.[1] ?? 0) + 1];
      });
      // Auto caderno de erros
      for (const w of wrong) {
        const existing = db.errorNotes.find((n) => n.questionId === w.id);
        const payload: ErrorNote = {
          id: existing?.id ?? uid(),
          questionId: w.id,
          subject: w.subject || "Geral",
          topic: w.topic || "Geral",
          statement: w.statement,
          yourKey: w.yourKey,
          correctKey: w.correctKey,
          explanation: w.explanation || "",
          reasonCode: "nao-sabia",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          reviewId: existing?.reviewId ?? null,
          origin: "simulado",
          externalId: null,
          sourceLabel: exam.title || "Simulado",
        };
        if (existing) Object.assign(existing, payload);
        else db.errorNotes.push(payload);
      }
      const pct = Math.round((ok / Math.max(questions.length, 1)) * 100);
      const bySubject = Object.entries(subj).map(([subject, [h, t]]) => ({ subject, pct: Math.round((h / t) * 100) }));
      const byTopic = Object.entries(top).map(([topic, [h, t]]) => ({ topic, pct: Math.round((h / t) * 100) }));
      const result = {
        examId: b,
        score: ok,
        correctPct: pct,
        timeUsedSec: body.timeUsedSec,
        bySubject,
        byTopic,
        wrong: wrong.map(({ id, statement, yourKey, correctKey }) => ({
          id,
          statement,
          yourKey,
          correctKey,
        })),
        recommendations: byTopic
          .filter((t) => t.pct < 70)
          .map((t) => `Revise o tópico "${t.topic}" e resolva mais questões sobre ele.`)
          .concat(
            wrong.length
              ? [`${wrong.length} erro(s) foram para o Caderno de erros.`]
              : [],
          )
          .concat(pct >= 70 ? ["Ótimo desempenho! Mantenha o ritmo com um novo simulado."] : []),
      };
      db.examResults[b] = result;
      exam.status = "concluido";
      exam.score = ok;
      return result;
    }
    return { ...exam, questions: questions.map(strip) };
  }

  if (a === "mind-maps") {
    if (!b && method === "GET")
      return db.mindMaps.map(({ nodes, links: _l, flashcards, ...m }) => ({
        ...m,
        nodeCount: nodes.length,
        flashcardCount: Array.isArray(flashcards) ? flashcards.length : 0,
      }));
    if (!b && method === "POST") {
      let nodes: MindMap["nodes"] = [];
      let links: MindMap["links"] = [];
      let idMap: Record<string, string> = {};

      type OutlineTopic = {
        title: string;
        summary: string;
        children?: { title: string; summary: string }[];
      };
      const outline = Array.isArray(body.outline) ? (body.outline as OutlineTopic[]) : null;
      const studyPack = body.studyPack as
        | {
            centralTitle: string;
            nodes: {
              tempId: string;
              title: string;
              kind: import("@/types").MindNodeKind;
              summary: string;
              keywords: string[];
              parentTempId: string | null;
            }[];
            links: { sourceTempId: string; targetTempId: string; label?: string }[];
          }
        | undefined;

      if (studyPack?.nodes?.length) {
        const built = layoutStudyPack({
          centralTitle: studyPack.centralTitle || body.title,
          nodes: studyPack.nodes,
          links: studyPack.links ?? [],
        });
        nodes = built.nodes;
        links = built.links;
        idMap = built.idMap;
      } else if (outline?.length) {
        const built = layoutOutline({ rootTitle: body.title, topics: outline });
        nodes = built.nodes;
        links = built.links;
      } else {
        const rootId = uid();
        nodes = [
          {
            id: rootId,
            position: { x: 0, y: 0 },
            data: {
              title: body.title,
              mastery: "nao-estudado",
              root: true,
              kind: "hub",
            },
          },
        ];
        links = [];
        if (body.fromNotice || body.ai) {
          const contest = db.contests.find((x) => x.id === user.activeContestId) ?? db.contests[0];
          const subject =
            contest.subjects.find((s) => s.name === body.subject) ?? contest.subjects[0];
          subject.topics.forEach((t, i) => {
            const id = uid();
            const ang = (i / subject.topics.length) * Math.PI * 2 - Math.PI / 2;
            nodes.push({
              id,
              position: { x: Math.cos(ang) * 320, y: Math.sin(ang) * 200 },
              data: {
                title: t.name,
                mastery: "nao-estudado",
                kind: "topico",
                ...(body.ai ? { summary: `Resumo gerado sobre ${t.name}.` } : {}),
              },
            });
            links.push({ id: uid(), source: rootId, target: id });
          });
        }
      }

      const rawCards = Array.isArray(body.flashcards) ? body.flashcards : [];
      const flashcards = rawCards.map((c: Record<string, unknown>) => {
        const tempNode = String(c.nodeId ?? "");
        const mapped = tempNode && idMap[tempNode] ? idMap[tempNode] : tempNode || null;
        return {
          id: String(c.id ?? uid()),
          front: String(c.front ?? ""),
          back: String(c.back ?? ""),
          topic: String(c.topic ?? body.title),
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          nodeId: mapped,
          status: (c.status as string) || "novo",
        };
      });

      const rawQs = Array.isArray(body.practiceQuestions) ? body.practiceQuestions : [];
      const practiceQuestions = rawQs.map((c: Record<string, unknown>) => {
        const tempNode = String(c.nodeId ?? "");
        const mapped = tempNode && idMap[tempNode] ? idMap[tempNode] : tempNode || null;
        const alts = Array.isArray(c.alternatives)
          ? c.alternatives
              .map((raw) => {
                const a = raw as Record<string, unknown>;
                return {
                  key: String(a.key ?? "")
                    .toUpperCase()
                    .slice(0, 1),
                  text: String(a.text ?? "").slice(0, 400),
                };
              })
              .filter((a) => a.key && a.text)
          : [];
        return {
          id: String(c.id ?? uid()),
          statement: String(c.statement ?? "").slice(0, 900),
          alternatives: alts,
          correctKey: String(c.correctKey ?? "").toUpperCase().slice(0, 1),
          explanation: String(c.explanation ?? "").slice(0, 1200),
          topic: String(c.topic ?? body.title),
          nodeId: mapped,
        };
      });

      const m = {
        id: uid(),
        title: body.title,
        subject: body.subject,
        updatedAt: new Date().toISOString(),
        nodeCount: nodes.length,
        flashcardCount: flashcards.length,
        nodes,
        links,
        flashcards,
        practiceQuestions,
        ...(body.material ? { material: String(body.material).slice(0, 90_000) } : {}),
        ...(body.summary ? { summary: String(body.summary) } : {}),
        ...(Array.isArray(body.warnings) ? { warnings: body.warnings.map(String) } : {}),
        aiGenerated: !!body.ai || !!studyPack,
        mocked: !!body.mocked,
      };
      db.mindMaps.push(m);
      return m;
    }
    const m = find(db.mindMaps, b);
    if (!c) {
      if (method === "GET") return m;
      if (method === "PATCH") {
        Object.assign(m, body, { updatedAt: new Date().toISOString() });
        m.nodeCount = m.nodes.length;
        return m;
      }
      if (method === "DELETE") {
        db.mindMaps = db.mindMaps.filter((x) => x.id !== b);
        return undefined;
      }
    }
    if (c === "nodes") {
      if (method === "POST") m.nodes.push(body);
      if (method === "PATCH") Object.assign(find(m.nodes, d), body);
      if (method === "DELETE") m.nodes = m.nodes.filter((n) => n.id !== d);
      return body;
    }
    if (c === "links") {
      if (method === "POST") m.links.push(body);
      if (method === "DELETE") m.links = m.links.filter((l) => l.id !== d);
      return body;
    }
  }

  if (a === "reviews") {
    if (b && c === "complete") {
      const rv = find(db.reviews, b) as Review;
      const confidence = Number(body.confidence);
      if (!Number.isFinite(confidence) || confidence < 1 || confidence > 5) throw new ApiError("Informe confiança de 1 a 5.", 400);
      const intervalDays = intervalForConfidence(confidence);
      rv.lastConfidence = confidence;
      rv.mastery = masteryFromConfidence(confidence);
      rv.lastIntervalDays = intervalDays;
      rv.scheduleNote = explainSrsInterval(confidence, intervalDays);
      rv.confidenceHistory = [...(rv.confidenceHistory ?? []), confidence];
      rv.dueDate = addDaysIso(today(), intervalDays);
      return rv;
    }
    if (method === "POST" && !b) {
      const existing = db.reviews.find((r) => r.subject === body.subject && r.topic === body.topic);
      if (existing) {
        existing.dueDate = body.dueDate || today();
        existing.mastery = body.mastery || existing.mastery || "baixo";
        return existing;
      }
      const rv: Review = {
        id: uid(),
        subject: body.subject,
        topic: body.topic,
        dueDate: body.dueDate || today(),
        mastery: body.mastery || "baixo",
      };
      db.reviews.push(rv);
      return rv;
    }
    return [...db.reviews].sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  }

  if (a === "dashboard") {
    const contest = db.contests.find((x) => x.id === user.activeContestId) ?? null;
    const answered = db.questions.filter((x) => x.answered);
    const acc = answered.length ? Math.round((answered.filter((x) => x.answered!.correct).length / answered.length) * 100) : 0;
    const done = db.sessions.filter((s) => s.status === "concluida").length;
    const bySubj = accuracyBySubject(db.questions);
    const weakest = bySubj.filter((s) => s.answered >= 1).slice(0, 3).map(({ subject, pct }) => ({ subject, pct }));
    const strongest = [...bySubj].filter((s) => s.answered >= 1).reverse().slice(0, 3).map(({ subject, pct }) => ({ subject, pct }));

    const weekStart = (() => {
      const d = new Date(`${today()}T12:00:00`);
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return d.toISOString().slice(0, 10);
    })();
    const weekSessions = db.sessions.filter((s) => s.date >= weekStart && s.date <= today() && s.status === "concluida");
    const weekHours = Math.round((weekSessions.reduce((sum, s) => sum + s.durationMin, 0) / 60) * 10) / 10;

    const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const weekly = dayNames.map((label, i) => {
      const d = new Date(`${weekStart}T12:00:00`);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const daySessions = db.sessions.filter((s) => s.date === iso && s.status === "concluida");
      const horas = Math.round((daySessions.reduce((sum, s) => sum + s.durationMin, 0) / 60) * 10) / 10;
      // Sem timestamp por resposta no mock — não inventamos % de acerto diário.
      return { day: label, horas, acertos: 0 };
    });

    const distMap: Record<string, number> = { Teoria: 0, Questões: 0, Revisão: 0, Simulado: 0 };
    weekSessions.forEach((s) => {
      const key = s.activity === "teoria" ? "Teoria" : s.activity === "questoes" ? "Questões" : s.activity === "revisao" ? "Revisão" : "Simulado";
      distMap[key] = (distMap[key] ?? 0) + s.durationMin;
    });
    const distribution = Object.entries(distMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    const t = today();
    const reviewDue = db.reviews.map((r) => ({
      id: r.id,
      subject: r.subject,
      topic: r.topic,
      dueDate: r.dueDate,
      daysUntil: daysBetween(t, r.dueDate),
    }));
    const recommendation = buildRecommendation({
      today: t,
      examDate: contest?.examDate ?? null,
      overdueReviews: reviewDue.filter((r) => r.daysUntil < 0),
      upcomingReviews: reviewDue.filter((r) => r.daysUntil >= 0),
      recentWrongByTopic: aggregateWrongByTopic(db.questions),
      hasActiveContest: !!user.activeContestId,
      unansweredCount: db.questions.filter((x) => !x.answered).length,
      lateSessionsCount: db.sessions.filter((s) => s.status === "atrasada" || (s.status === "planejada" && s.date < t)).length,
    });

    return {
      contest: contest && { name: contest.name, examDate: contest.examDate },
      progress: db.sessions.length ? Math.round((done / db.sessions.length) * 100) : 0,
      weekHours,
      answered: answered.length,
      accuracy: acc,
      streak: computeStreak(db.sessions, t),
      upcomingReviews: db.reviews.filter((r) => r.dueDate <= t).slice(0, 4),
      weakest,
      strongest,
      today: db.sessions.filter((s) => s.date === t),
      weekly,
      distribution: distribution.length ? distribution : [{ name: "Sem dados", value: 1 }],
      recommendation,
      dataNote: "Dados locais do navegador (mock). Horas e acertos semanais usam apenas sessões/questões registradas aqui.",
    };
  }

  if (a === "performance") {
    let questAttempts: import("@/types/tjsp-quest").QuestAttempt[] = [];
    let localQ: Record<string, { answered: { correct: boolean } | null }> = {};
    let videoAnswers: { correct: boolean }[] = [];
    try {
      if (typeof window !== "undefined") {
        const questRaw = localStorage.getItem("estufoo.tjsp-quest.v1");
        if (questRaw) {
          const parsed = JSON.parse(questRaw) as { attempts?: import("@/types/tjsp-quest").QuestAttempt[] };
          questAttempts = parsed.attempts ?? [];
        }
        const lq = localStorage.getItem("estufoo.local-question-state");
        if (lq) localQ = JSON.parse(lq) as typeof localQ;
        const va = localStorage.getItem("estufoo.video-lesson-answers.v1");
        if (va) {
          const parsed = JSON.parse(va) as { correct: boolean }[];
          if (Array.isArray(parsed)) videoAnswers = parsed;
        }
      }
    } catch {
      /* ignore */
    }
    const due = today();
    const reviewsDue = db.reviews.filter((r) => r.dueDate <= due).length;
    return buildPerformanceData({
      period: q.period === "mensal" ? "mensal" : "semanal",
      errorNotes: db.errorNotes ?? [],
      examResults: Object.values(db.examResults ?? {}),
      sessions: db.sessions ?? [],
      reviewsDue,
      reviewsTotal: db.reviews.length,
      localQuestionState: localQ,
      questAttempts,
      videoAnswers,
    });
  }

  if (a === "notifications") {
    if (b && c === "read") {
      const n = find(db.notifications, b);
      n.read = true;
      return n;
    }
    return db.notifications;
  }

  throw new ApiError(`Rota simulada não encontrada: ${method} /${seg.join("/")}`, 404);
}

function find<T extends { id: string }>(list: T[], id?: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError("Registro não encontrado.", 404);
  return item;
}
function strip<T extends { correctKey?: string; explanation?: string }>({ correctKey: _c, explanation: _e, ...rest }: T) {
  return rest;
}

/** Sequência de dias consecutivos (até hoje) com ao menos uma sessão concluída. */
function computeStreak(sessions: StudySession[], todayIso: string): number {
  const done = new Set(sessions.filter((s) => s.status === "concluida").map((s) => s.date));
  let streak = 0;
  let cursor = todayIso;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
