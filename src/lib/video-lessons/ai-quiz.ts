import type { OllamaChatMessage } from "@/server/ollama/client";

export type VideoQuizAltKey = "A" | "B" | "C" | "D" | "E";

export type VideoQuizQuestion = {
  id: string;
  statement: string;
  alternatives: { key: VideoQuizAltKey; text: string }[];
  correctKey: VideoQuizAltKey;
  /** Explicação interna (não mostrar no erro — só no acerto ou gabarito final). */
  explanation: string;
  topic: string;
};

export type VideoQuizPayload = {
  lessonId: string;
  questions: VideoQuizQuestion[];
};

const KEYS: VideoQuizAltKey[] = ["A", "B", "C", "D", "E"];

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  return (m?.[1] ?? t).trim();
}

export function buildVideoLessonQuizMessages(input: {
  subjectName: string;
  lessonTitle: string;
  count: number;
}): OllamaChatMessage[] {
  return [
    {
      role: "system",
      content: `Você gera questões objetivas estilo concurso (VUNESP A–E) sobre o tema de uma videoaula.
Responda SOMENTE JSON válido:
{"questions":[{"id":"q1","statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"A","explanation":"...","topic":"..."}]}
Regras: exatamente ${input.count} questões; alternativas plausíveis; correctKey válido; explanation curta (para uso interno após acerto).`,
    },
    {
      role: "user",
      content: `Matéria: ${input.subjectName}
Aula: ${input.lessonTitle}
Gere ${input.count} questões cobrindo o conteúdo típico dessa aula.`,
    },
  ];
}

export function mockVideoLessonQuiz(input: {
  lessonId: string;
  subjectName: string;
  lessonTitle: string;
  count: number;
}): VideoQuizPayload {
  const questions: VideoQuizQuestion[] = Array.from({ length: input.count }, (_, i) => {
    const n = i + 1;
    return {
      id: `${input.lessonId}-q${n}`,
      statement: `(Treino) Sobre "${input.lessonTitle}" em ${input.subjectName}, assinale a alternativa correta — item ${n}:`,
      alternatives: KEYS.map((key, ki) => ({
        key,
        text:
          ki === 1
            ? `Aplicação correta do conceito central da aula (item ${n}).`
            : `Afirmação incorreta ou incompleta sobre o tema (distrator ${key}).`,
      })),
      correctKey: "B",
      explanation: `A alternativa B descreve a regra típica do tópico da aula "${input.lessonTitle}".`,
      topic: input.lessonTitle.slice(0, 80),
    };
  });
  return { lessonId: input.lessonId, questions };
}

export function parseVideoLessonQuizJson(
  text: string,
  input: { lessonId: string; subjectName: string; lessonTitle: string; count: number },
): VideoQuizPayload {
  const raw = JSON.parse(stripJsonFence(text)) as unknown;
  const root = asObj(raw);
  const arr = Array.isArray(root?.["questions"]) ? (root!["questions"] as unknown[]) : [];
  const questions: VideoQuizQuestion[] = [];
  for (let i = 0; i < arr.length; i++) {
    const q = asObj(arr[i]);
    if (!q) continue;
    const statement = String(q["statement"] ?? "").trim();
    const correctKey = String(q["correctKey"] ?? "").toUpperCase() as VideoQuizAltKey;
    const altsRaw = Array.isArray(q["alternatives"]) ? (q["alternatives"] as unknown[]) : [];
    const alternatives = KEYS.map((key) => {
      const found = altsRaw
        .map((a) => asObj(a))
        .find((a) => String(a?.["key"] ?? "").toUpperCase() === key);
      return { key, text: String(found?.["text"] ?? `Alternativa ${key}`).trim().slice(0, 400) };
    });
    if (statement.length < 12 || !KEYS.includes(correctKey)) continue;
    questions.push({
      id: String(q["id"] ?? `${input.lessonId}-q${i + 1}`).slice(0, 80),
      statement: statement.slice(0, 900),
      alternatives,
      correctKey,
      explanation: String(q["explanation"] ?? "").trim().slice(0, 1200),
      topic: String(q["topic"] ?? input.lessonTitle).trim().slice(0, 120),
    });
  }
  if (questions.length < 8) {
    return mockVideoLessonQuiz(input);
  }
  return { lessonId: input.lessonId, questions: questions.slice(0, Math.max(8, input.count)) };
}

export function buildWrongApproachMessages(input: {
  subjectName: string;
  lessonTitle: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  choice: string;
}): OllamaChatMessage[] {
  return [
    {
      role: "system",
      content: `Você é um professor de concurso. O aluno errou uma questão.
Explique COMO resolver / raciocinar (método, o que observar, armadilhas comuns).
PROIBIDO: revelar a letra correta, dizer "a resposta é", apontar qual alternativa está certa, ou parafrasear o gabarito de forma óbvia.
Responda em português, 4–8 frases, tom didático.`,
    },
    {
      role: "user",
      content: `Matéria: ${input.subjectName}
Aula: ${input.lessonTitle}
Enunciado: ${input.statement}
Alternativas:
${input.alternatives.map((a) => `${a.key}) ${a.text}`).join("\n")}
O aluno marcou: ${input.choice}
Explique como atacar a questão sem entregar a resposta.`,
    },
  ];
}

export function mockWrongApproach(choice: string): string {
  return `Revise o enunciado com calma e isole o comando (certo/errado, exceção, regra geral). Elimine alternativas que misturam conceitos de outro tópico ou absolutizam demais. Sua marcação (${choice}) sugere um atalho — volte ao núcleo da aula e compare cada opção com a definição/regra central antes de decidir de novo.`;
}
