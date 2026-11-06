/**
 * Verificação de questões geradas pela IA.
 *
 * Questão com gabarito errado destrói a confiança do aluno. Aqui uma
 * segunda chamada RESOLVE as questões sem ver o gabarito; se a resposta
 * não bater com o gabarito gerado (ou o verificador apontar ambiguidade),
 * a questão é descartada.
 */
import type { OllamaChatMessage } from "@/server/ollama/client";

export type VerifiableQuestion = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
};

type VerifyAnswer = { i: number; key: string; ambiguous?: boolean; issue?: string };

export function buildVerifyMessages(
  questions: VerifiableQuestion[],
  ctx: { subject: string; legalContext?: string },
): OllamaChatMessage[] {
  const block = questions
    .map((q, i) => {
      const alts = q.alternatives.map((a) => `(${a.key}) ${a.text}`).join("\n");
      return `#${i}\n${q.statement}\n${alts}`;
    })
    .join("\n\n");
  return [
    {
      role: "system",
      content: [
        "Você é um examinador revisor de questões de concurso (VUNESP, TJSP Escrevente).",
        "Resolva CADA questão com rigor, como um candidato nota 10. Não há gabarito disponível.",
        "Marque ambiguous=true se houver mais de uma alternativa defensável, nenhuma correta, ou erro de fato/lei no enunciado.",
        ctx.legalContext ? "Use a FONTE LEGAL fornecida quando a questão depender de lei." : "",
        'Responda SOMENTE JSON: {"answers":[{"i":0,"key":"C","ambiguous":false,"issue":""}]}',
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: [
        `Matéria: ${ctx.subject}`,
        ctx.legalContext ? `FONTE LEGAL:\n${ctx.legalContext}` : "",
        `QUESTÕES:\n${block}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

/** Aplica o resultado do verificador. Exportado para testes. */
export function applyVerification<Q extends VerifiableQuestion>(
  questions: Q[],
  answers: VerifyAnswer[],
): { kept: Q[]; dropped: { question: Q; reason: string }[] } {
  const byIndex = new Map(answers.map((a) => [Number(a.i), a]));
  const kept: Q[] = [];
  const dropped: { question: Q; reason: string }[] = [];
  questions.forEach((q, i) => {
    const a = byIndex.get(i);
    if (!a) {
      kept.push(q); // verificador não respondeu sobre esta — mantém
      return;
    }
    if (a.ambiguous) {
      dropped.push({ question: q, reason: a.issue || "ambígua" });
      return;
    }
    if (String(a.key).trim().toUpperCase() !== q.correctKey.toUpperCase()) {
      dropped.push({
        question: q,
        reason: `verificador marcou ${a.key}, gabarito gerado ${q.correctKey}`,
      });
      return;
    }
    kept.push(q);
  });
  return { kept, dropped };
}

/**
 * Verifica em lotes. Se a verificação falhar (rede/cota), devolve todas
 * as questões — melhor ter conteúdo não verificado do que nenhum.
 * Desligue com QUESTION_VERIFY=off.
 */
export async function verifyGeneratedQuestions<Q extends VerifiableQuestion>(
  questions: Q[],
  ctx: { subject: string; legalContext?: string; batchSize?: number },
): Promise<{ kept: Q[]; dropped: number; verified: boolean }> {
  if (!questions.length) return { kept: [], dropped: 0, verified: true };
  if ((process.env["QUESTION_VERIFY"] ?? "on").toLowerCase() === "off") {
    return { kept: questions, dropped: 0, verified: false };
  }
  const { tutorChatJson } = await import("@/server/tutor-llm");
  const size = ctx.batchSize ?? 10;
  const kept: Q[] = [];
  let dropped = 0;
  let verified = true;
  for (let i = 0; i < questions.length; i += size) {
    const batch = questions.slice(i, i + size);
    try {
      const { data, result } = await tutorChatJson<{ answers?: VerifyAnswer[] }>(
        buildVerifyMessages(batch, ctx),
        {
          task: "verify",
          // Mock: concorda com o gabarito gerado.
          mockText: JSON.stringify({
            answers: batch.map((q, idx) => ({ i: idx, key: q.correctKey, ambiguous: false })),
          }),
          validate: (d) => (Array.isArray(d?.answers) ? null : "faltou o campo answers"),
        },
      );
      if (result.mocked) {
        kept.push(...batch);
        verified = false;
        continue;
      }
      const r = applyVerification(batch, data.answers ?? []);
      kept.push(...r.kept);
      dropped += r.dropped.length;
      if (r.dropped.length) {
        console.info(
          `[verify] ${r.dropped.length}/${batch.length} descartadas:`,
          r.dropped.map((d) => d.reason).join(" | "),
        );
      }
    } catch (e) {
      console.warn("[verify] falhou — mantendo lote sem verificação:", (e as Error).message);
      kept.push(...batch);
      verified = false;
    }
  }
  return { kept, dropped, verified };
}
