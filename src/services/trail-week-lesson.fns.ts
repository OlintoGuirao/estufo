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

    const topicsBlock = data.relatedTopics.length
      ? data.relatedTopics
          .map(
            (t) =>
              `- [${t.subject}] ${t.topic} (peso ${t.weightHint})${t.notes ? `: ${t.notes}` : ""}`,
          )
          .join("\n")
      : "(sem lista detalhada — use só o foco da semana e as matérias)";

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

    const userPrompt = `Você é o PROFESSOR. Monte a AULA em MÓDULOS SEPARADOS (JSON).

Concurso: ${data.contestName}
Cargo: ${data.role}
Banca: ${data.board}
Sessão: ${data.week}
Foco: ${data.weekFocus}
Horas totais: ${hoursDay} (~2h por etapa)
Matérias: ${data.subjectNames.join(", ") || "—"}
Atividades: ${data.activities.join(" · ") || "—"}

ETAPAS (${topicCount}) — cada uma vira 4 módulos separados (Definição, Macete, Exemplo, 5 questões):
${topicsBlock}

OBRIGATÓRIO:
- Para CADA etapa: módulos separados com titles "Definição — …", "Macete — …", "Exemplo — …", "5 questões — …"
- Prática final com ≥${topicCount * 5} questions
- correctKey equilibrado A/B/C/D; alternativas com tamanho parecido (não deixe a correta ser a mais longa)
- Em questões: se falar em "termo destacado", marque com «termo» no trecho. Não misture "Assinale a opção em que…" com alternativas do tipo "Muda para concessão".
Gere professorIntro + modules completos.`;

    const result = await tutorChat(
      [
        { role: "system", content: WEEK_LESSON_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { mockText },
    );

    return buildWeekLessonFromAiText(result.text, {
      trailId: data.trailId,
      week: data.week,
      mocked: !!result.mocked,
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

    const result = await tutorChat(
      [
        { role: "system", content: system },
        {
          role: "user",
          content: `Concurso: ${data.contestName}\nSemana ${data.week}: ${data.weekFocus}\nMódulo: ${data.moduleTitle || "geral"}\nContexto:\n${data.lessonContext || "(sem trecho)"}\n\nDúvida:\n${data.question}`,
        },
      ],
      { mockText },
    );

    return { answer: result.text.trim(), mocked: !!result.mocked };
  });
