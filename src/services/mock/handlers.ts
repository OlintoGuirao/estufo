// Camada de MOCK temporária. Simula a API REST em memória (persistida no navegador).
import { ApiError } from "../api";
import { db, today } from "./data";
import type { MindMap, Review, User } from "@/types";

const STORAGE = "aprovamind.mockdb";
const delay = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
const uid = () => Math.random().toString(36).slice(2, 10);

let loaded = false;
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (saved) Object.assign(db, saved);
  } catch {
    /* ignore */
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function currentUser(token: string | null) {
  const u = db.users.find((x) => `mock-${x.id}` === token);
  if (!u) throw new ApiError("Sessão expirada. Entre novamente.", 401);
  return u;
}
const publicUser = ({ password: _p, ...u }: User & { password: string }): User => u;

export async function mockRequest(method: string, fullPath: string, body: any, token: string | null): Promise<unknown> {
  load();
  await delay();
  const [path, query = ""] = fullPath.split("?");
  const q = Object.fromEntries(new URLSearchParams(query));
  const seg = path.split("/").filter(Boolean);
  const r = `${method} /${seg.map((s, i) => (i > 0 && /^[a-z]*\d|^[a-z0-9]{8}$|^ss|^n\d|^l\d/.test(s) && !["answers", "favorite", "review"].includes(s) ? ":id" : s)).join("/")}`;
  const res = route(method, seg, q, body, token, r);
  persist();
  return res;
}

function route(method: string, seg: string[], q: Record<string, string>, body: any, token: string | null, _r: string): unknown {
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
    if (method === "GET") return db.sessions.filter((s) => s.date >= q.from && s.date <= q.to).sort((x, y) => x.date.localeCompare(y.date));
    if (method === "POST") {
      const s = { ...body, id: uid() };
      db.sessions.push(s);
      return s;
    }
    if (method === "PATCH") return Object.assign(find(db.sessions, c), body);
    if (method === "DELETE") {
      db.sessions = db.sessions.filter((s) => s.id !== c);
      return undefined;
    }
  }

  if (a === "mock-exams") {
    if (!b && method === "GET") return [...db.exams].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    if (!b && method === "POST") {
      const e = { ...body, id: uid(), createdAt: new Date().toISOString(), status: "pendente" };
      db.exams.push(e);
      return e;
    }
    const exam = find(db.exams, b);
    const pool = db.questions.filter((x) => exam.subjects.includes(x.subject));
    const questions = (pool.length ? pool : db.questions).slice(0, exam.questionCount);
    if (c === "result") {
      const r = db.examResults[b];
      if (!r) throw new ApiError("Resultado ainda não disponível.", 404);
      return r;
    }
    if (c === "submit") {
      const wrong: any[] = [];
      const subj: Record<string, [number, number]> = {};
      const top: Record<string, [number, number]> = {};
      let ok = 0;
      questions.forEach((x) => {
        const yours = body.answers[x.id];
        const hit = yours === x.correctKey;
        if (hit) ok++;
        else wrong.push({ id: x.id, statement: x.statement, yourKey: yours ?? "—", correctKey: x.correctKey });
        subj[x.subject] = [(subj[x.subject]?.[0] ?? 0) + (hit ? 1 : 0), (subj[x.subject]?.[1] ?? 0) + 1];
        top[x.topic] = [(top[x.topic]?.[0] ?? 0) + (hit ? 1 : 0), (top[x.topic]?.[1] ?? 0) + 1];
      });
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
        wrong,
        recommendations: byTopic
          .filter((t) => t.pct < 70)
          .map((t) => `Revise o tópico "${t.topic}" e resolva mais questões sobre ele.`)
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
    if (!b && method === "GET") return db.mindMaps.map(({ nodes, links: _l, ...m }) => ({ ...m, nodeCount: nodes.length }));
    if (!b && method === "POST") {
      const rootId = uid();
      const nodes: MindMap["nodes"] = [{ id: rootId, position: { x: 0, y: 0 }, data: { title: body.title, mastery: "nao-estudado", root: true } }];
      const links: MindMap["links"] = [];
      if (body.fromNotice || body.ai) {
        const contest = db.contests.find((x) => x.id === user.activeContestId) ?? db.contests[0];
        const subject = contest.subjects.find((s) => s.name === body.subject) ?? contest.subjects[0];
        subject.topics.forEach((t, i) => {
          const id = uid();
          const ang = (i / subject.topics.length) * Math.PI * 2;
          nodes.push({ id, position: { x: Math.cos(ang) * 320, y: Math.sin(ang) * 200 }, data: { title: t.name, mastery: "nao-estudado", summary: body.ai ? `Resumo gerado sobre ${t.name}.` : undefined } });
          links.push({ id: uid(), source: rootId, target: id });
        });
      }
      const m = { id: uid(), title: body.title, subject: body.subject, updatedAt: new Date().toISOString(), nodeCount: nodes.length, nodes, links };
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
      rv.lastConfidence = body.confidence;
      rv.mastery = body.confidence >= 4 ? "bom" : body.confidence >= 3 ? "intermediario" : "baixo";
      const next = new Date();
      next.setDate(next.getDate() + [1, 1, 3, 7, 15][body.confidence - 1]);
      rv.dueDate = next.toISOString().slice(0, 10);
      return rv;
    }
    return [...db.reviews].sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  }

  if (a === "dashboard") {
    const contest = db.contests.find((x) => x.id === user.activeContestId) ?? null;
    const answered = db.questions.filter((x) => x.answered);
    const acc = answered.length ? Math.round((answered.filter((x) => x.answered!.correct).length / answered.length) * 100) : 68;
    const done = db.sessions.filter((s) => s.status === "concluida").length;
    return {
      contest: contest && { name: contest.name, examDate: contest.examDate },
      progress: Math.round((done / db.sessions.length) * 100),
      weekHours: 14.5,
      answered: 412 + answered.length,
      accuracy: acc,
      streak: 7,
      upcomingReviews: db.reviews.filter((r) => r.dueDate <= today()).slice(0, 4),
      weakest: [
        { subject: "Raciocínio Lógico", pct: 48 },
        { subject: "Língua Portuguesa", pct: 57 },
      ],
      strongest: [
        { subject: "Direito Constitucional", pct: 84 },
        { subject: "Direito Previdenciário", pct: 76 },
      ],
      today: db.sessions.filter((s) => s.date === today()),
      weekly: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dd, i) => ({ day: dd, horas: [2, 2.5, 1.5, 3, 2, 3.5, 0][i], acertos: [62, 65, 60, 70, 68, 74, 0][i] })),
      distribution: [
        { name: "Teoria", value: 40 },
        { name: "Questões", value: 35 },
        { name: "Revisão", value: 25 },
      ],
    };
  }

  if (a === "performance") {
    const mensal = q.period === "mensal";
    return {
      accuracyEvolution: (mensal ? ["Mai", "Jun", "Jul", "Ago", "Set", "Out"] : ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]).map((label, i) => ({ label, acertos: 52 + i * 3 + (i % 2 ? 2 : -1) })),
      bySubject: [
        { subject: "Dir. Constitucional", pct: 84, answered: 120 },
        { subject: "Dir. Previdenciário", pct: 76, answered: 160 },
        { subject: "Português", pct: 57, answered: 90 },
        { subject: "Rac. Lógico", pct: 48, answered: 42 },
      ],
      byTopic: [
        { topic: "Probabilidade", subject: "Raciocínio Lógico", pct: 38 },
        { topic: "Crase", subject: "Língua Portuguesa", pct: 45 },
        { topic: "Custeio", subject: "Direito Previdenciário", pct: 52 },
        { topic: "Concordância", subject: "Língua Portuguesa", pct: 61 },
        { topic: "Benefícios", subject: "Direito Previdenciário", pct: 79 },
        { topic: "Direitos fundamentais", subject: "Direito Constitucional", pct: 88 },
      ],
      avgTimeSec: 94,
      answered: 412,
      reviewRate: 81,
      hours: mensal ? 312 : 58,
      monthly: (mensal ? ["Mai", "Jun", "Jul", "Ago", "Set", "Out"] : ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]).map((label, i) => ({ label, horas: (mensal ? 40 : 10) + i * 2, questoes: (mensal ? 200 : 45) + i * 12 })),
    };
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
