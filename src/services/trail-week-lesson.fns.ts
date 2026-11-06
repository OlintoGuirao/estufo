import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  trailId: z.string().min(1),
  week: z.number().int().min(1).max(366),
  contestName: z.string().max(240),
  board: z.string().max(120),
  role: z.string().max(200),
  weekFocus: z.string().min(1).max(400),
  subjectNames: z.array(z.string()).max(20),
  activities: z.array(z.string()).max(20),
  hoursSuggested: z.number().min(1).max(80),
  /** Assuntos do edital relacionados (nome + notas). */
  relatedTopics: z
    .array(
      z.object({
        subject: z.string(),
        topic: z.string(),
        notes: z.string().optional().default(""),
        weightHint: z.string().optional().default("media"),
      }),
    )
    .max(80),
});

export const generateTrailWeekLesson = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const { WEEK_LESSON_SYSTEM, buildWeekLessonFromAiText } = await import(
      "@/lib/approval-trail/parse-week-lesson"
    );
    const { tutorChat } = await import("@/server/tutor-llm");

    const topicsForMock =
      data.relatedTopics.length > 0
        ? data.relatedTopics
        : [
            {
              subject: data.subjectNames[0] || "Matéria",
              topic: data.weekFocus,
              notes: "",
              weightHint: "media",
            },
          ];

    const KEYS_ROTATE = ["A", "B", "C", "D"] as const;
    let qSeq = 0;
    const makeQ = (topicLabel: string, subject: string, kind: "mem" | "prat", n: number) => {
      const correct = KEYS_ROTATE[qSeq % 4]!;
      qSeq += 1;
      const texts: Record<(typeof KEYS_ROTATE)[number], string> = {
        A: `Leitura literal estreita de “${topicLabel.slice(0, 28)}”`,
        B: `Aplicação correta de “${topicLabel.slice(0, 28)}” na prova`,
        C: `Generalização além do edital sobre o tema`,
        D: `Troca por conceito vizinho de “${topicLabel.slice(0, 24)}”`,
      };
      // Equaliza tamanho aproximado
      texts.A = texts.A.padEnd(52, ".").slice(0, 52);
      texts.B = texts.B.padEnd(52, ".").slice(0, 52);
      texts.C = texts.C.padEnd(52, ".").slice(0, 52);
      texts.D = texts.D.padEnd(52, ".").slice(0, 52);
      texts[correct] =
        kind === "mem"
          ? `Conceito nuclear de “${topicLabel.slice(0, 30)}” bem aplicado`
          : `Uso correto de “${topicLabel.slice(0, 30)}” no enunciado`;
      texts[correct] = texts[correct].padEnd(52, ".").slice(0, 52);
      return {
        statement: `${kind === "mem" ? "Memorização" : "Prática"} ${n} — “${topicLabel.slice(0, 55)}”`,
        alternatives: KEYS_ROTATE.map((key) => ({ key, text: texts[key] })),
        correctKey: correct,
        explanation: `A correta é ${correct}: mantém o limite do conceito sem alongar a alternativa.`,
        legalBasis: subject,
      };
    };

    const topicModules = topicsForMock.flatMap((t) => {
      const label = t.topic.slice(0, 80);
      const subject = t.subject || data.subjectNames[0] || "Matéria";
      const fiveQs = [1, 2, 3, 4, 5].map((n) => makeQ(label, subject, "mem", n));
      return [
        {
          kind: "teoria" as const,
          title: `Definição — ${label.slice(0, 48)}`,
          minutesSuggested: 35,
          topicLabel: label,
          definition: `“${label}” em ${subject}: entenda o núcleo, o limite do conceito e o que a banca ${data.board || ""} costuma cobrar. Separe literal de inferência. Domine antes de decorar detalhes.`,
          body: `Estude a definição de “${label}” por ~35 min. Escreva com suas palavras, cite um contraste A versus B e uma pegadinha clássica.`,
        },
        {
          kind: "memorizacao" as const,
          title: `Macete — ${label.slice(0, 48)}`,
          minutesSuggested: 15,
          topicLabel: label,
          body: `Macete de fixação: associe “${label.slice(0, 32)}” a uma palavra-chave, recite 3 vezes e anote só o verbo nuclear. Revise sem olhar o texto.`,
        },
        {
          kind: "material" as const,
          title: `Exemplo — ${label.slice(0, 48)}`,
          minutesSuggested: 25,
          topicLabel: label,
          body: `Exemplo de uso na prova: leia um enunciado típico, marque o comando, aplique “${label.slice(0, 40)}” e elimine a alternativa que troca o conceito por um vizinho. Faça o passo a passo em voz alta.`,
        },
        {
          kind: "memorizacao" as const,
          title: `5 questões — ${label.slice(0, 48)}`,
          minutesSuggested: 25,
          topicLabel: label,
          body: `Cinco questões de memorização de “${label.slice(0, 50)}”. Responda sem consultar; meta 4/5.`,
          questions: fiveQs,
        },
      ];
    });

    const praticaCount = Math.max(5, topicsForMock.length * 5);
    const praticaQuestions = Array.from({ length: praticaCount }, (_, i) => {
      const t = topicsForMock[i % topicsForMock.length]!;
      return makeQ(t.topic.slice(0, 70), t.subject || data.weekFocus, "prat", i + 1);
    });

    const hoursDay = Math.max(2, data.hoursSuggested || topicsForMock.length * 2);
    const topicCount = Math.max(1, topicsForMock.length);
    const mockText = JSON.stringify({
      title: `Semana/sessão ${data.week}: ${data.weekFocus}`,
      objective: `Dominar ${topicCount} etapa(s) com ~2h cada (definição, macete, exemplo e questões).`,
      professorIntro: `Oi! Nesta sessão temos ${topicCount} etapa(s) do edital (~${hoursDay}h no total). Cada etapa aparece separada: Definição, Macete, Exemplo e 5 questões. No fim, a Prática com pelo menos 5 questões por etapa.`,
      modules: [
        {
          kind: "abertura",
          title: "Abertura da sessão",
          minutesSuggested: 5,
          body: `Etapas de hoje: ${topicsForMock.map((t) => t.topic.slice(0, 40)).join(" · ")}. Ritmo: por etapa, definição → macete → exemplo → 5 questões. Depois prática geral.`,
        },
        ...topicModules,
        {
          kind: "pratica",
          title: "Prática da semana",
          minutesSuggested: Math.max(40, topicCount * 15),
          body: `Prática final: ${praticaCount} questões (≥5 por etapa). Ritmo de prova. Gabaritos variam entre A–D.`,
          questions: praticaQuestions,
        },
        {
          kind: "fechamento",
          title: "Fechamento",
          minutesSuggested: 5,
          body: "1) Liste erros por etapa\n2) Releia só o que errou\n3) Pergunte ao professor\n4) Marque a sessão como concluída",
        },
      ],
      warnings: [
        "Aula demonstrativa (mock). Com GEMINI_API_KEY o professor gera módulos densos por etapa.",
      ],
    });

    const { getGeminiConfig } = await import("@/server/gemini/config");
    const { getOllamaConfig } = await import("@/server/ollama/config");
    const gem = getGeminiConfig();
    const useMock = gem.enabled ? gem.useMock : getOllamaConfig().useMock;

    if (useMock) {
      const result = await tutorChat(
        [
          { role: "system", content: WEEK_LESSON_SYSTEM },
          { role: "user", content: `Sessão ${data.week}: ${data.weekFocus}` },
        ],
        { task: "lesson", mockText },
      );
      return buildWeekLessonFromAiText(result.text, {
        trailId: data.trailId,
        week: data.week,
        mocked: !!result.mocked,
      });
    }

    // Uma chamada POR ETAPA (em paralelo, 3 por vez). Antes era tudo numa
    // resposta só — com várias etapas o modelo encurtava cada uma.
    const { retrieveLegalContext } = await import("@/server/legal/retrieve");
    const { pickVunespExamples, formatVunespExamples } = await import("@/server/vunesp-examples");
    const { verifyGeneratedQuestions } = await import("@/server/question-verify");
    const { parseLlmJson } = await import("@/server/llm-tasks");

    type AiModuleJson = { kind?: string; title?: string; questions?: VerifQ[] } & Record<string, unknown>;
    type VerifQ = {
      statement: string;
      alternatives: { key: string; text: string }[];
      correctKey: string;
    } & Record<string, unknown>;

    const verifyList = async (qs: unknown, subject: string, legalText: string) => {
      if (!Array.isArray(qs) || !qs.length) return [];
      const valid = (qs as VerifQ[]).filter(
        (q) => q && typeof q.statement === "string" && Array.isArray(q.alternatives) && q.correctKey,
      );
      const v = await verifyGeneratedQuestions(valid, {
        subject,
        ...(legalText ? { legalContext: legalText } : {}),
      });
      return v.kept;
    };

    const warnings: string[] = [];
    const genTopic = async (t: (typeof topicsForMock)[number], idx: number) => {
      const subject = t.subject || data.subjectNames[0] || "Matéria";
      const legal = await retrieveLegalContext(`${subject}\n${t.topic}\n${t.notes ?? ""}`, {
        limit: 5,
      });
      const examples = formatVunespExamples(pickVunespExamples(subject, t.topic, 2));
      const userPrompt = `Você é o PROFESSOR. Gere SOMENTE a etapa ${idx + 1} de ${topicCount} desta sessão.

Concurso: ${data.contestName}
Cargo: ${data.role}
Banca: ${data.board}
Sessão: ${data.week} — foco: ${data.weekFocus}
ETAPA: [${subject}] ${t.topic} (peso ${t.weightHint})${t.notes ? `\nNotas do edital: ${t.notes}` : ""}

Responda APENAS JSON:
{"modules":[ os 4 módulos desta etapa: "Definição — …", "Macete — …", "Exemplo — …", "5 questões — …" ],
 "practice":[ 5 questões EXTRAS (diferentes das 5 do módulo) para a prática final ]}
Cada questão: 5 alternativas A–E, uma correta, explanation e legalBasis.
Não gere abertura, prática geral nem fechamento — o app monta.
${examples ? `\nQUESTÕES REAIS DA BANCA (imite o estilo, não copie):\n${examples}` : ""}
${legal.text ? `\nFONTE LEGAL (texto oficial — fundamente e cite só artigos daqui):\n${legal.text}` : ""}`;

      const r = await tutorChat(
        [
          { role: "system", content: WEEK_LESSON_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        { task: "lesson" },
      );
      const parsed = parseLlmJson<{ modules?: AiModuleJson[]; practice?: unknown }>(r.text);
      const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
      for (const m of modules) {
        if (Array.isArray(m.questions)) m.questions = await verifyList(m.questions, subject, legal.text);
        m["topicLabel"] = m["topicLabel"] ?? t.topic;
      }
      const practice = await verifyList(parsed.practice, subject, legal.text);
      return { modules, practice };
    };

    const results: { modules: AiModuleJson[]; practice: VerifQ[] }[] = [];
    for (let i = 0; i < topicsForMock.length; i += 3) {
      const slice = topicsForMock.slice(i, i + 3);
      const settled = await Promise.allSettled(slice.map((t, j) => genTopic(t, i + j)));
      settled.forEach((res, j) => {
        const t = slice[j]!;
        if (res.status === "fulfilled" && res.value.modules.length) {
          results.push(res.value);
        } else {
          console.warn("[trilha] etapa falhou:", t.topic, res.status === "rejected" ? res.reason : "vazia");
          warnings.push(`A etapa "${t.topic.slice(0, 60)}" não pôde ser gerada agora — use Regenerar.`);
        }
      });
    }
    if (!results.length) {
      throw new Error("O professor não conseguiu gerar a aula agora. Tente Regenerar em instantes.");
    }

    const allPractice = results.flatMap((r) => r.practice);
    const merged = {
      title: `Sessão ${data.week}: ${data.weekFocus}`,
      objective: `Dominar ${topicCount} etapa(s) com ~2h cada (definição, macete, exemplo e questões).`,
      professorIntro: `Oi! Nesta sessão temos ${topicCount} etapa(s) do edital (~${hoursDay}h no total). Cada etapa vem separada: Definição, Macete, Exemplo e 5 questões. No fim, a Prática com as questões extras de cada etapa.`,
      modules: [
        {
          kind: "abertura",
          title: "Abertura da sessão",
          minutesSuggested: 5,
          body: `Etapas de hoje: ${topicsForMock.map((t) => t.topic.slice(0, 40)).join(" · ")}. Ritmo: por etapa, definição → macete → exemplo → 5 questões. Depois prática geral.`,
        },
        ...results.flatMap((r) => r.modules),
        ...(allPractice.length
          ? [
              {
                kind: "pratica",
                title: "Prática da semana",
                minutesSuggested: Math.max(40, topicCount * 15),
                body: `Prática final: ${allPractice.length} questões, ritmo de prova.`,
                questions: allPractice,
              },
            ]
          : []),
        {
          kind: "fechamento",
          title: "Fechamento",
          minutesSuggested: 5,
          body: "1) Liste erros por etapa\n2) Releia só o que errou\n3) Pergunte ao professor\n4) Marque a sessão como concluída",
        },
      ],
      warnings,
    };

    return buildWeekLessonFromAiText(JSON.stringify(merged), {
      trailId: data.trailId,
      week: data.week,
      mocked: false,
    });
  });

const askSchema = z.object({
  week: z.number().int().min(1).max(366),
  weekFocus: z.string().min(1).max(400),
  contestName: z.string().max(240),
  board: z.string().max(120),
  question: z.string().min(3).max(2000),
  moduleTitle: z.string().max(240).optional().default(""),
  lessonContext: z.string().max(8000).optional().default(""),
  /** Últimas mensagens do chat (o professor precisa lembrar da conversa). */
  history: z
    .array(z.object({ role: z.enum(["aluno", "professor"]), text: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
  studentProfile: z.string().max(1500).optional().default(""),
});

/** Dúvida ao vivo com o Professor IA (módulo da semana). */
export const askTrailProfessor = createServerFn({ method: "POST" })
  .validator(askSchema)
  .handler(async ({ data }) => {
    const { tutorChat } = await import("@/server/tutor-llm");
    const system = `Você é o professor particular do aluno na Trilha da aprovação.
Responda em português claro, didático, em 1ª pessoa.
PROIBIDO markdown (*, **, _, #, backticks). Use parágrafos curtos e aspas para termos.
Não invente leis/artigos; se não tiver certeza, diga para conferir o texto oficial.
Máximo ~220 palavras. Termine com 1 pergunta curta para checar se o aluno entendeu.`;

    const mockText = `Boa pergunta. Sobre "${data.weekFocus}", use o ciclo: conceito, base legal e como a banca ${data.board || ""} costuma cobrar. Relacione com o módulo "${data.moduleTitle || "atual"}".\n\nConsegue resumir isso em uma frase com as suas palavras?`;

    const { retrieveLegalContext } = await import("@/server/legal/retrieve");
    const legal = await retrieveLegalContext(
      `${data.weekFocus}\n${data.moduleTitle}\n${data.question}`,
      { limit: 4 },
    );

    const history = data.history.slice(-10).map((m) => ({
      role: m.role === "aluno" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    const contextBlock = [
      `Concurso: ${data.contestName}`,
      `Semana ${data.week}: ${data.weekFocus}`,
      `Módulo: ${data.moduleTitle || "geral"}`,
      data.studentProfile ? `Perfil do aluno: ${data.studentProfile}` : "",
      `Contexto da aula:\n${data.lessonContext || "(sem trecho)"}`,
      legal.text ? `FONTE LEGAL (texto oficial — use para fundamentar):\n${legal.text}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await tutorChat(
      [
        {
          role: "system",
          content: `${system}
Você recebe o histórico da conversa: se o aluno está respondendo à sua pergunta de checagem, avalie a resposta dele (certo/errado e por quê) antes de seguir.
Cite artigos apenas se aparecerem na FONTE LEGAL ou no contexto da aula.

${contextBlock}`,
        },
        ...history,
        { role: "user", content: data.question },
      ],
      { task: "chat", mockText },
    );

    return { answer: result.text.trim(), mocked: !!result.mocked };
  });
