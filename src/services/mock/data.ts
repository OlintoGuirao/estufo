// @ts-nocheck -- camada de mock temporária
// Camada de MOCK temporária — remova a pasta src/services/mock quando a API estiver disponível.
import type { Contest, ErrorNote, MindMap, MockExam, Notification, Question, Review, StudySession, User } from "@/types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Com Supabase configurado, não geramos catálogo/plano/revisões fictícios. */
export const USE_SUPABASE_CATALOG = Boolean(
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim() &&
    (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)?.trim(),
);

export const db = {
  users: [] as (User & { password: string })[],
  contests: [] as Contest[],
  questions: [] as (Question & { correctKey: string; explanation: string })[],
  sessions: [] as StudySession[],
  exams: [] as MockExam[],
  examResults: {} as Record<string, import("@/types").MockExamResult>,
  mindMaps: [] as MindMap[],
  reviews: [] as Review[],
  errorNotes: [] as ErrorNote[],
  notifications: [] as Notification[],
};

function seedDemoCatalog() {
  db.contests = [
    {
      id: "c1",
      name: "INSS 2026 — Técnico do Seguro Social",
      organ: "Instituto Nacional do Seguro Social",
      role: "Técnico do Seguro Social",
      board: "Cebraspe",
      status: "aberto",
      examDate: day(68),
      vacancies: 1000,
      salary: 5905.79,
      subjects: [
        { id: "s1", name: "Direito Previdenciário", topics: [{ id: "t1", name: "Segurados" }, { id: "t2", name: "Benefícios" }, { id: "t3", name: "Custeio" }] },
        { id: "s2", name: "Língua Portuguesa", topics: [{ id: "t4", name: "Interpretação de texto" }, { id: "t5", name: "Concordância" }, { id: "t6", name: "Crase" }] },
        { id: "s3", name: "Direito Constitucional", topics: [{ id: "t7", name: "Direitos fundamentais" }, { id: "t8", name: "Seguridade social" }] },
        { id: "s4", name: "Raciocínio Lógico", topics: [{ id: "t9", name: "Proposições" }, { id: "t10", name: "Probabilidade" }] },
      ],
    },
    {
      id: "c2",
      name: "Receita Federal — Auditor Fiscal",
      organ: "Receita Federal do Brasil",
      role: "Auditor-Fiscal",
      board: "FGV",
      status: "previsto",
      examDate: day(140),
      vacancies: 230,
      salary: 22921.71,
      subjects: [
        { id: "s5", name: "Direito Tributário", topics: [{ id: "t11", name: "Competência tributária" }, { id: "t12", name: "Crédito tributário" }] },
        { id: "s6", name: "Contabilidade Geral", topics: [{ id: "t13", name: "Balanço patrimonial" }, { id: "t14", name: "DRE" }] },
        { id: "s2", name: "Língua Portuguesa", topics: [{ id: "t4", name: "Interpretação de texto" }] },
      ],
    },
    {
      id: "c3",
      name: "TJ-SP — Escrevente Técnico Judiciário",
      organ: "Tribunal de Justiça de São Paulo",
      role: "Escrevente",
      board: "Vunesp",
      status: "encerrado",
      examDate: day(-20),
      vacancies: 400,
      salary: 6043.34,
      subjects: [
        { id: "s7", name: "Direito Processual Civil", topics: [{ id: "t15", name: "Prazos" }] },
        { id: "s2", name: "Língua Portuguesa", topics: [{ id: "t5", name: "Concordância" }] },
      ],
    },
  ];

  const stems: [string, string, string, string[], string, string][] = [
    ["Direito Previdenciário", "Segurados", "É segurado obrigatório do RGPS na qualidade de contribuinte individual:", ["O empregado doméstico", "O síndico de condomínio remunerado", "O trabalhador avulso", "O segurado especial", "O estagiário"], "B", "O síndico remunerado é contribuinte individual (art. 11, V, f, Lei 8.213/91)."],
    ["Direito Previdenciário", "Benefícios", "A carência para concessão do auxílio por incapacidade temporária, em regra, é de:", ["Nenhuma", "6 contribuições", "10 contribuições", "12 contribuições", "24 contribuições"], "D", "A regra geral exige 12 contribuições mensais (art. 25, I)."],
    ["Língua Portuguesa", "Crase", "Assinale a frase em que o uso do acento grave está correto:", ["Fui à pé ao trabalho.", "Entreguei o relatório à ela.", "Chegamos à cidade cedo.", "Começou à chover.", "Refiro-me à esse caso."], "C", "Há crase antes de palavra feminina regida pela preposição 'a' (chegar a + a cidade)."],
    ["Língua Portuguesa", "Concordância", "Está correta a concordância em:", ["Fazem dois anos que estudo.", "Houveram muitos candidatos.", "Haviam provas difíceis.", "Faz dois anos que estudo.", "Existe muitas vagas."], "D", "O verbo 'fazer' indicando tempo é impessoal e fica no singular."],
    ["Direito Constitucional", "Direitos fundamentais", "O habeas data é a ação constitucional adequada para:", ["Proteger a liberdade de locomoção", "Assegurar o conhecimento de informações pessoais", "Anular ato lesivo ao patrimônio público", "Suprir omissão legislativa", "Proteger direito líquido e certo genérico"], "B", "Art. 5º, LXXII, CF: garante acesso e retificação de informações relativas ao impetrante."],
    ["Direito Constitucional", "Seguridade social", "A seguridade social compreende:", ["Saúde, previdência e assistência social", "Saúde, educação e previdência", "Previdência e trabalho", "Assistência, educação e lazer", "Saúde e moradia"], "A", "Art. 194 da CF define o tripé: saúde, previdência e assistência social."],
    ["Raciocínio Lógico", "Proposições", "A negação de 'Todo servidor é pontual' é:", ["Nenhum servidor é pontual", "Algum servidor não é pontual", "Todo servidor não é pontual", "Algum servidor é pontual", "Nenhum servidor é impontual"], "B", "A negação de 'todo A é B' é 'algum A não é B'."],
    ["Raciocínio Lógico", "Probabilidade", "Ao lançar um dado honesto, a probabilidade de sair número par é:", ["1/6", "1/3", "1/2", "2/3", "5/6"], "C", "Há 3 pares em 6 faces: 3/6 = 1/2."],
    ["Direito Tributário", "Competência tributária", "Compete aos Municípios instituir imposto sobre:", ["Propriedade de veículos", "Serviços de qualquer natureza", "Renda", "Grandes fortunas", "Transmissão causa mortis"], "B", "O ISS é de competência municipal (art. 156, III, CF)."],
    ["Contabilidade Geral", "Balanço patrimonial", "No balanço patrimonial, o grupo 'Patrimônio Líquido' representa:", ["Obrigações com terceiros", "Recursos próprios da entidade", "Bens de uso", "Receitas do período", "Despesas antecipadas"], "B", "PL = Ativo − Passivo, ou seja, recursos próprios."],
  ];

  const boards = ["Cebraspe", "FGV", "Vunesp", "FCC"];
  for (let i = 0; i < 36; i++) {
    const s = stems[i % stems.length];
    db.questions.push({
      id: `q${i + 1}`,
      subject: s[0],
      topic: s[1],
      statement: s[2],
      alternatives: s[3].map((text, k) => ({ key: "ABCDE"[k], text })),
      correctKey: s[4],
      explanation: s[5],
      board: boards[i % boards.length],
      year: 2019 + (i % 7),
      contest: db.contests[i % 3].name.split(" — ")[0],
      difficulty: (["facil", "media", "dificil"] as const)[i % 3],
      source: `Prova ${boards[i % boards.length]} ${2019 + (i % 7)}`,
      favorite: false,
      markedForReview: false,
      answered: null,
    });
  }

  const subjectsRot = ["Direito Previdenciário", "Língua Portuguesa", "Direito Constitucional", "Raciocínio Lógico"];
  const topicsRot = ["Benefícios", "Crase", "Direitos fundamentais", "Proposições"];
  const acts = ["teoria", "questoes", "revisao", "teoria"] as const;
  for (let d = -10; d <= 24; d++) {
    for (let k = 0; k < 2; k++) {
      const idx = (d + 20 + k) % 4;
      db.sessions.push({
        id: `ss${d}_${k}`,
        date: day(d),
        subject: subjectsRot[idx],
        topic: topicsRot[idx],
        activity: acts[(idx + k) % 4],
        durationMin: k === 0 ? 60 : 45,
        priority: (["alta", "media", "baixa"] as const)[(idx + k) % 3],
        status: d < 0 ? (d % 3 === 0 ? "atrasada" : "concluida") : "planejada",
      });
    }
  }

  db.reviews = [
    { id: "r1", subject: "Direito Previdenciário", topic: "Segurados", dueDate: day(0), mastery: "intermediario" },
    { id: "r2", subject: "Língua Portuguesa", topic: "Crase", dueDate: day(0), mastery: "baixo" },
    { id: "r3", subject: "Raciocínio Lógico", topic: "Proposições", dueDate: day(0), mastery: "bom" },
    { id: "r4", subject: "Direito Constitucional", topic: "Seguridade social", dueDate: day(-2), mastery: "baixo" },
    { id: "r5", subject: "Direito Previdenciário", topic: "Custeio", dueDate: day(-1), mastery: "nao-estudado" },
    { id: "r6", subject: "Língua Portuguesa", topic: "Concordância", dueDate: day(2), mastery: "intermediario" },
    { id: "r7", subject: "Raciocínio Lógico", topic: "Probabilidade", dueDate: day(5), mastery: "bom" },
  ];

  db.exams = [
    {
      id: "e1",
      title: "Simulado INSS #1",
      contestId: "c1",
      subjects: ["Direito Previdenciário", "Língua Portuguesa"],
      questionCount: 10,
      timeLimitMin: 30,
      correctionMode: "ao-final",
      createdAt: new Date(Date.now() - 5 * 864e5).toISOString(),
      status: "concluido",
      score: 7,
    },
  ];
  db.examResults.e1 = {
    examId: "e1",
    score: 7,
    total: 10,
    correctPct: 70,
    timeUsedSec: 1420,
    bySubject: [
      { subject: "Direito Previdenciário", pct: 80, correct: 4, wrong: 1, total: 5 },
      { subject: "Língua Portuguesa", pct: 60, correct: 3, wrong: 2, total: 5 },
    ],
    byTopic: [
      { topic: "Benefícios", pct: 100, correct: 2, wrong: 0, total: 2 },
      { topic: "Segurados", pct: 60, correct: 3, wrong: 2, total: 5 },
      { topic: "Crase", pct: 50, correct: 1, wrong: 1, total: 2 },
      { topic: "Concordância", pct: 70, correct: 1, wrong: 0, total: 1 },
    ],
    wrong: [
      { id: "q3", statement: stems[2][2], yourKey: "A", correctKey: "C" },
      { id: "q1", statement: stems[0][2], yourKey: "C", correctKey: "B" },
    ],
    review: [],
    recommendations: ["Revise o tópico Crase em Língua Portuguesa.", "Resolva 20 questões de Segurados do RGPS."],
  };

  db.mindMaps = [
    {
      id: "m1",
      title: "Direito Previdenciário — Visão geral",
      subject: "Direito Previdenciário",
      updatedAt: new Date().toISOString(),
      nodeCount: 6,
      nodes: [
        { id: "n1", position: { x: 0, y: 0 }, data: { title: "Direito Previdenciário", mastery: "intermediario", root: true, description: "Regime Geral de Previdência Social" } },
        { id: "n2", position: { x: -320, y: -140 }, data: { title: "Segurados", mastery: "bom", tags: ["RGPS"], summary: "Obrigatórios e facultativos." } },
        { id: "n3", position: { x: 320, y: -140 }, data: { title: "Benefícios", mastery: "baixo", tags: ["carência"] } },
        { id: "n4", position: { x: -320, y: 160 }, data: { title: "Custeio", mastery: "nao-estudado" } },
        { id: "n5", position: { x: 320, y: 160 }, data: { title: "Carência", mastery: "revisado", lastReview: day(-1) } },
        { id: "n6", position: { x: 620, y: -220 }, data: { title: "Aposentadorias", mastery: "intermediario" } },
      ],
      links: [
        { id: "l1", source: "n1", target: "n2" },
        { id: "l2", source: "n1", target: "n3" },
        { id: "l3", source: "n1", target: "n4" },
        { id: "l4", source: "n3", target: "n5" },
        { id: "l5", source: "n3", target: "n6" },
      ],
    },
  ];

  db.notifications = [
    { id: "n1", title: "Revisão pendente", body: "Você tem 3 revisões para hoje.", read: false, createdAt: new Date().toISOString() },
    { id: "n2", title: "Novo edital", body: "Edital do INSS 2026 foi atualizado.", read: false, createdAt: new Date(Date.now() - 864e5).toISOString() },
    { id: "n3", title: "Meta batida!", body: "Você completou 7 dias seguidos de estudo.", read: true, createdAt: new Date(Date.now() - 3 * 864e5).toISOString() },
  ];
}

if (!USE_SUPABASE_CATALOG) {
  seedDemoCatalog();
}

export const today = () => day(0);
export const offsetDay = day;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Remove catálogo/demo persistido no localStorage quando Supabase está ativo. */
export function scrubPersistedDemoCatalog(saved: Record<string, unknown>) {
  if (!USE_SUPABASE_CATALOG) return saved;
  const users = Array.isArray(saved.users)
    ? (saved.users as Array<Record<string, unknown>>).map((u) => {
        const active = u.activeContestId;
        // "c3" e outros IDs mock quebram o PostgREST (contests.id é UUID).
        if (typeof active === "string" && active && !UUID_RE.test(active)) {
          return { ...u, activeContestId: null };
        }
        return u;
      })
    : saved.users;
  return {
    ...saved,
    users,
    contests: [],
    questions: [],
    sessions: Array.isArray(saved.sessions)
      ? (saved.sessions as StudySession[]).filter((s) => !String(s.id).startsWith("ss"))
      : [],
    reviews: Array.isArray(saved.reviews)
      ? (saved.reviews as Review[]).filter((r) => !/^r\d+$/.test(String(r.id)))
      : [],
    exams: [],
    examResults: {},
    mindMaps: Array.isArray(saved.mindMaps)
      ? (saved.mindMaps as MindMap[]).filter((m) => m.id !== "m1")
      : [],
    notifications: [],
  };
}
