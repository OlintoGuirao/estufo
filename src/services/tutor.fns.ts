/**
 * Server functions do tutor — importáveis pelo cliente.
 * LLM (Gemini / fallback Ollama) só é chamado dentro dos handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const altSchema = z.object({ key: z.string().min(1).max(1), text: z.string().min(1).max(800) });

const tipSchema = z.object({
  statement: z.string().min(1).max(4000),
  alternatives: z.array(altSchema).min(2).max(5),
  studentChoice: z.string().min(1).max(1),
  subject: z.string().max(200).optional(),
  topic: z.string().max(200).optional(),
  tipLevel: z.number().int().min(1).max(3).optional(),
  previousTips: z.array(z.string().max(800)).max(5).optional(),
  /** Nunca usar no prompt — só para validar vazamento na resposta. */
  correctKeyForValidationOnly: z.string().max(1).optional(),
  studentProfile: z.string().max(1500).optional(),
});

export const getTutorStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { checkTutorLlmStatus } = await import("@/server/tutor-llm");
  return checkTutorLlmStatus();
});

export const requestTutorTip = createServerFn({ method: "POST" })
  .validator(tipSchema)
  .handler(async ({ data }) => {
    try {
      const { assertTipPayloadSafe, buildTipMessages, collectTipForbiddenTokens } =
        await import("@/lib/tutor/prompts");
      const { tipLooksLikeAnswerReveal, sanitizeTipText } = await import("@/lib/tutor/validate");
      const { tutorChat, assertNoSecretsInTutorMessages } = await import("@/server/tutor-llm");
      const { OllamaError } = await import("@/server/ollama/errors");

      const tipInput = {
        statement: data.statement,
        alternatives: data.alternatives,
        studentChoice: data.studentChoice,
        ...(data.subject ? { subject: data.subject } : {}),
        ...(data.topic ? { topic: data.topic } : {}),
        ...(data.tipLevel != null ? { tipLevel: data.tipLevel } : {}),
        ...(data.previousTips ? { previousTips: data.previousTips } : {}),
        ...(data.studentProfile ? { studentProfile: data.studentProfile } : {}),
      };

      // Gabarito NÃO entra no prompt — só usamos para validar a saída.
      assertTipPayloadSafe(tipInput, {
        correctKey: data.correctKeyForValidationOnly ?? null,
        explanation: null,
      });

      const messages = buildTipMessages(tipInput);
      // Não enviamos correctKey ao modelo; forbidden = nada do gabarito textual.
      await assertNoSecretsInTutorMessages(messages, collectTipForbiddenTokens({ explanation: null }));

      // Garantia explícita: objeto enviado ao chat não contém correctKey
      const serialized = JSON.stringify(messages);
      if (
        data.correctKeyForValidationOnly &&
        /correctKey|gabarito|resposta correta/i.test(serialized) &&
        serialized.includes(`"correctKey"`)
      ) {
        throw new OllamaError(
          "rejected",
          "Bloqueado: tentativa de enviar gabarito ao modelo.",
          400,
        );
      }

      const result = await tutorChat(messages, {
        task: "tip", mockText:
          "Pense no conceito central do tópico antes de eliminar alternativas extremos. Relia o enunciado procurando a palavra-chave da regra — sem chutar pela opção mais longa. (resposta mockada · GEMINI_USE_MOCK)",
      });

      let tip = sanitizeTipText(result.text);
      if (tipLooksLikeAnswerReveal(tip, data.correctKeyForValidationOnly)) {
        tip =
          "Vamos com calma: releia o enunciado e elimine o que contradiz a regra principal do tópico. Peça outra dica se quiser um empurrão diferente — sem revelar a letra.";
      }

      return {
        tip,
        tipLevel: data.tipLevel ?? 1,
        model: result.model,
        mocked: result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

export const requestTutorExplain = createServerFn({ method: "POST" })
  .validator(
    z.object({
      statement: z.string().min(1).max(4000),
      alternatives: z.array(altSchema).min(2).max(5),
      correctKey: z.string().min(1).max(1),
      studentChoice: z.string().min(1).max(1),
      subject: z.string().max(200).optional(),
      topic: z.string().max(200).optional(),
      studentProfile: z.string().max(1500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { buildExplainMessages } = await import("@/lib/tutor/prompts");
      const { tutorChat } = await import("@/server/tutor-llm");
      const { retrieveLegalContext } = await import("@/server/legal/retrieve");
      const legal = await retrieveLegalContext(
        [data.subject, data.topic, data.statement, ...data.alternatives.map((a) => a.text)]
          .filter(Boolean)
          .join("\n"),
        { limit: 4 },
      );
      const messages = buildExplainMessages({
        ...(data.studentProfile ? { studentProfile: data.studentProfile } : {}),
        ...(legal.text ? { legalContext: legal.text } : {}),
        statement: data.statement,
        alternatives: data.alternatives,
        correctKey: data.correctKey,
        studentChoice: data.studentChoice,
        ...(data.subject ? { subject: data.subject } : {}),
        ...(data.topic ? { topic: data.topic } : {}),
      });
      const result = await tutorChat(messages, {
        task: "explain", mockText:
          "Você acertou. A alternativa correta aplica a regra do tópico de forma direta; as demais costumam exagerar ou inverter a condição. (explicação mockada · GEMINI_USE_MOCK)",
      });
      return {
        explanation: result.text.trim().slice(0, 2400),
        model: result.model,
        mocked: result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

export const generatePracticeQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subject: z.string().min(1).max(200),
      topic: z.string().min(1).max(200),
      conceptHint: z.string().min(1).max(1000),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { buildPracticeMessages } = await import("@/lib/tutor/prompts");
      const { parsePracticeQuestionJson, hidePracticeAnswer } =
        await import("@/lib/tutor/validate");
      const { tutorChat } = await import("@/server/tutor-llm");
      const { pickVunespExamples, formatVunespExamples } = await import("@/server/vunesp-examples");
      const { verifyGeneratedQuestions } = await import("@/server/question-verify");
      const { retrieveLegalContext } = await import("@/server/legal/retrieve");
      const { sealAnswer } = await import("@/server/answer-token");

      const legal = await retrieveLegalContext(
        `${data.subject}\n${data.topic}\n${data.conceptHint}`,
        { limit: 4 },
      );
      const messages = buildPracticeMessages({
        ...data,
        examples: formatVunespExamples(pickVunespExamples(data.subject, data.topic, 2)),
        ...(legal.text ? { legalContext: legal.text } : {}),
      });
      const mockText = JSON.stringify({
        statement:
          "Para treinar o conceito, assinale a alternativa correta sobre a regra principal do tópico estudado:",
        alternatives: [
          { key: "A", text: "Afirmação genérica demais" },
          { key: "B", text: "Regra aplicada no caso típico" },
          { key: "C", text: "Exceção tratada como regra" },
          { key: "D", text: "Inversão da condição" },
          { key: "E", text: "Conceito de outro ramo" },
        ],
        correctKey: "B",
        explanation: "A alternativa B reflete a regra típica do tópico sem misturar exceções.",
      });

      // Até 2 tentativas: a questão só sai se o verificador chegar ao mesmo gabarito.
      let result = await tutorChat(messages, { task: "practice", mockText });
      let full = parsePracticeQuestionJson(result.text, { subject: data.subject, topic: data.topic });
      let verified = false;
      for (let attempt = 0; attempt < 2 && !result.mocked; attempt++) {
        const v = await verifyGeneratedQuestions([full], {
          subject: data.subject,
          ...(legal.text ? { legalContext: legal.text } : {}),
        });
        if (v.kept.length) {
          verified = v.verified;
          break;
        }
        if (attempt === 1) break;
        result = await tutorChat(messages, { task: "practice", mockText });
        full = parsePracticeQuestionJson(result.text, { subject: data.subject, topic: data.topic });
      }

      const token = sealAnswer(full);
      return {
        publicQuestion: hidePracticeAnswer(full),
        /** Token cifrado — correção só via gradePracticeQuestion; não é questão oficial. */
        answerToken: token,
        verified,
        model: result.model,
        mocked: result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

export const gradePracticeQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({ answerToken: z.string().min(1).max(20_000), choice: z.string().min(1).max(1) }),
  )
  .handler(async ({ data }) => {
    try {
      const { openAnswer } = await import("@/server/answer-token");
      const q = openAnswer<{
        correctKey: string;
        explanation: string;
        aiGenerated?: boolean;
      }>(data.answerToken);
      if (!q.correctKey) throw new Error("Token inválido.");
      const correct = q.correctKey.toUpperCase() === data.choice.toUpperCase();
      return {
        correct,
        correctKey: q.correctKey,
        explanation: String(q.explanation ?? "").slice(0, 1200),
        aiGenerated: true as const,
      };
    } catch (err) {
      const { OllamaError } = await import("@/server/ollama/errors");
      if (err instanceof OllamaError) throw err;
      throw new OllamaError(
        "invalid_response",
        "Não foi possível corrigir a questão de treino.",
        400,
      );
    }
  });

export const buildTutorRecommendations = createServerFn({ method: "POST" })
  .validator(
    z.object({
      wrongByTopic: z
        .array(
          z.object({ subject: z.string(), topic: z.string(), wrongCount: z.number().int().min(0) }),
        )
        .max(50),
      difficultyEvents: z
        .array(
          z.object({
            subject: z.string(),
            topic: z.string(),
            code: z.enum([
              "desconhecia",
              "confundiu",
              "enunciado",
              "desatencao",
              "falta-tempo",
              "outro",
            ]),
            at: z.string(),
          }),
        )
        .max(200),
      overdueReviews: z
        .array(z.object({ subject: z.string(), topic: z.string(), dueDate: z.string() }))
        .max(50),
      lateSessionsCount: z.number().int().min(0),
      hoursPerDay: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { buildTutorAdvice } = await import("@/lib/tutor/recommendations");
    const items = buildTutorAdvice({
      wrongByTopic: data.wrongByTopic,
      difficultyEvents: data.difficultyEvents,
      overdueReviews: data.overdueReviews,
      lateSessionsCount: data.lateSessionsCount,
      hoursPerDay: data.hoursPerDay ?? null,
    });
    return {
      items,
      source: "rules" as const,
      note: "Priorização por regras com base nos seus dados locais. Horas estudadas não medem aprendizado.",
    };
  });

/** Gera um “mastigado” jurídico estruturado a partir da fonte e/ou do gabarito. */
export const requestTutorMastigado = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        fonteUrl: z.string().url().max(2000).optional(),
        statement: z.string().min(1).max(4000),
        subject: z.string().max(200).optional(),
        topic: z.string().max(200).optional(),
        /** Trecho do gabarito / fundamento. */
        explanationHint: z.string().max(4000).optional(),
        alternatives: z
          .array(z.object({ key: z.string().min(1).max(1), text: z.string().min(1).max(800) }))
          .min(2)
          .max(5)
          .optional(),
        /** Id da questão do banco — o servidor busca o gabarito sozinho. */
        questionId: z.string().max(200).optional(),
        /** Gabarito (quando a questão não está no banco local). */
        correctKey: z.string().max(1).optional(),
        /** Letra marcada pelo aluno ⇒ modo correção. */
        studentChoice: z.string().max(1).optional(),
        studentProfile: z.string().max(1500).optional(),
      })
      .refine((d) => Boolean(d.fonteUrl?.trim() || d.explanationHint?.trim()), {
        message: "Informe fonte ou trecho do gabarito.",
      }),
  )
  .handler(async ({ data }) => {
    try {
      const { stripHtmlToText, fetchOfficialSource, pickRelevantExcerpt } = await import(
        "@/lib/tutor/fonte"
      );
      const { buildMastigadoMessages } = await import("@/lib/tutor/prompts");
      const { tutorChat } = await import("@/server/tutor-llm");
      const { OllamaError } = await import("@/server/ollama/errors");
      const { retrieveLegalContext } = await import("@/server/legal/retrieve");

      let correctKey = data.correctKey?.toUpperCase();
      if (!correctKey && data.questionId) {
        const { tjspBancoCatalog } = await import("@/services/tjsp-banco.catalog");
        correctKey = tjspBancoCatalog.getRaw(data.questionId)?.correctKey?.toUpperCase();
      }

      const query = [
        data.subject,
        data.topic,
        data.statement,
        data.explanationHint,
        ...(data.alternatives ?? []).map((a) => a.text),
      ]
        .filter(Boolean)
        .join("\n");

      let pageText = "";
      let fetchedPage = false;
      if (data.fonteUrl) {
        const extraHosts = (process.env["TUTOR_FONTE_ALLOWED_HOSTS"] ?? "")
          .split(",")
          .filter(Boolean);
        const html = await fetchOfficialSource(data.fonteUrl, { extraHosts });
        if (html) {
          const full = stripHtmlToText(html, 3_000_000);
          pageText = pickRelevantExcerpt(full, query, 12_000);
          fetchedPage = pageText.length >= 80;
        }
      }

      if (!pageText || pageText.length < 80) {
        pageText =
          data.explanationHint?.trim() ||
          "Material insuficiente. Declare a limitação em Fundamentação; não invente norma.";
      } else if (data.explanationHint?.trim()) {
        pageText = `${data.explanationHint.trim()}\n\n---\nConteúdo da fonte (trechos relevantes):\n${pageText}`;
      }

      const legal = await retrieveLegalContext(query, { limit: 6 });

      const messages = buildMastigadoMessages({
        statement: data.statement,
        foundationText: pageText,
        ...(data.subject ? { subject: data.subject } : {}),
        ...(data.topic ? { topic: data.topic } : {}),
        ...(data.fonteUrl ? { fonteUrl: data.fonteUrl } : {}),
        ...(data.alternatives ? { alternatives: data.alternatives } : {}),
        ...(correctKey ? { correctKey } : {}),
        ...(data.studentChoice ? { studentChoice: data.studentChoice.toUpperCase() } : {}),
        ...(data.studentProfile ? { studentProfile: data.studentProfile } : {}),
        ...(legal.text ? { legalContext: legal.text } : {}),
      });

      const result = await tutorChat(messages, {
        task: "mastigado", mockText: `1. Contextualização
Você está diante de um tema típico de concurso — vamos do zero.

2. Conceitos fundamentais
Antes de marcar qualquer alternativa, fixe o conceito central cobrado no enunciado.

3. Resumo didático
Regra principal + quando ela se aplica + o que costuma ser confundido.

4. Resolução passo a passo
Exemplo inventado: imagine um caso simples análogo. 1) Identifique a regra. 2) Aplique ao exemplo. 3) Chegue ao resultado do exemplo (não da questão original).

5. Memorização
Frase-âncora: “regra no texto; exceção só se a norma disser”.

6. Pegadinhas de concurso
A banca troca termos parecidos ou trata exceção como regra.

7. Teste ativo
\`\`\`json
{"statement":"Sobre o conceito estudado, assinale a alternativa correta:","alternatives":[{"key":"A","text":"Afirmação genérica demais"},{"key":"B","text":"Aplicação correta da regra no caso típico"},{"key":"C","text":"Exceção tratada como se fosse a regra"},{"key":"D","text":"Inversão da condição prevista"},{"key":"E","text":"Conceito de outro instituto"}],"correctKey":"B","explanation":"B aplica a regra sem misturar exceções."}
\`\`\`

8. Fundamentação
Modo mock — confirme lei/artigo/fonte no material real; não invente.`,
      });

      let text = result.text.trim();
      if (!text) {
        throw new OllamaError("empty", "O tutor não gerou texto. Tente de novo.", 502);
      }

      const { extractActiveTestFromMastigado, tipLooksLikeAnswerReveal } = await import(
        "@/lib/tutor/validate"
      );
      let parsed = extractActiveTestFromMastigado(text);

      // Modo aula: o gabarito foi ao modelo só como referência — não pode vazar.
      if (!data.studentChoice && correctKey && tipLooksLikeAnswerReveal(parsed.text, correctKey)) {
        const retry = await tutorChat(
          [
            ...messages,
            { role: "assistant", content: text.slice(0, 6_000) },
            {
              role: "user",
              content:
                "Você revelou a letra correta da questão do aluno, o que é proibido no MODO AULA. Reescreva a aula inteira no mesmo formato SEM indicar qual alternativa da questão original está certa.",
            },
          ],
          { task: "mastigado" },
        );
        text = retry.text.trim() || text;
        parsed = extractActiveTestFromMastigado(text);
      }

      const { findUnsupportedArticles } = await import("@/server/legal/citations");
      const unsupported = findUnsupportedArticles(parsed.text, [
        pageText,
        legal.text,
        data.explanationHint ?? "",
      ]);

      return {
        mastigado: parsed.text,
        activeTest: parsed.activeTest,
        fonteUrl: data.fonteUrl ?? null,
        model: result.model,
        mocked: result.mocked,
        fetchedPage,
        mode: data.studentChoice ? ("correcao" as const) : ("aula" as const),
        legalSources: legal.sources,
        /** Artigos citados pela IA que não aparecem em nenhuma fonte enviada. */
        unverifiedCitations: unsupported,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

/** Gera estrutura de mapa mental (tópicos + resumos) via Gemini. */
export const generateMindMapOutline = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1).max(200),
      subject: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { buildMindMapOutlineMessages, parseMindMapOutlineJson } =
        await import("@/lib/tutor/mind-map");
      const { tutorChat } = await import("@/server/tutor-llm");
      const messages = buildMindMapOutlineMessages(data);
      const result = await tutorChat(messages, {
        task: "mind-map", mockText: JSON.stringify({
          topics: [
            {
              title: "Conceito central",
              summary:
                "Ideia-base da matéria cobrada em provas: o que é, para que serve e quando aparece no edital.",
              children: [
                {
                  title: "Definição",
                  summary: "Fixe o significado técnico e a diferença do senso comum.",
                },
              ],
            },
            {
              title: "Regras principais",
              summary:
                "Liste as regras que mais caem: condições de aplicação, prazos e efeitos práticos.",
            },
            {
              title: "Exceções e pegadinhas",
              summary:
                "Pontos em que a banca costuma inverter a regra ou misturar institutos parecidos.",
            },
            {
              title: "Revisão rápida",
              summary:
                "Checklist de 1 minuto antes da prova: conceitos, exceções e palavras-chave do enunciado.",
            },
          ],
        }),
      });
      const topics = parseMindMapOutlineJson(result.text);
      return {
        topics,
        model: result.model,
        mocked: result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

/** Pacote completo: resumo + mapa (estilo caderno) + flashcards a partir do material. */
export const generateStudyPack = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1).max(200),
      subject: z.string().min(1).max(200),
      material: z.string().min(40).max(90_000),
      detail: z.enum(["resumo", "padrao", "detalhado"]).optional().default("padrao"),
      flashcardCount: z.number().int().min(4).max(24).optional().default(10),
      pdfBase64: z.string().optional(),
      fileName: z.string().max(240).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      let material = data.material.trim();

      if (data.pdfBase64?.trim()) {
        const { validatePdfUpload, decodeBase64ToBytes, looksLikePdf } = await import(
          "@/lib/exam-import/validate"
        );
        const { extractPdfPages } = await import("@/server/exam-import/extract-pdf");
        const bytes = decodeBase64ToBytes(data.pdfBase64);
        const check = validatePdfUpload({
          fileName: data.fileName || "material.pdf",
          mimeType: "application/pdf",
          sizeBytes: bytes.byteLength,
        });
        if (!check.ok) {
          throw new Error(JSON.stringify({ message: check.message, status: 400 }));
        }
        if (!looksLikePdf(bytes)) {
          throw new Error(JSON.stringify({ message: "Arquivo não parece PDF.", status: 400 }));
        }
        const extracted = await extractPdfPages(bytes);
        if (extracted.needsOcr || !extracted.textExtractable) {
          throw new Error(
            JSON.stringify({
              message:
                "PDF sem texto selecionável (possível escaneado). Cole o texto ou use PDF pesquisável.",
              status: 422,
            }),
          );
        }
        const fromPdf = extracted.pages.map((p) => p.text).join("\n\n").trim();
        material = [material, fromPdf].filter(Boolean).join("\n\n").slice(0, 90_000);
      }

      if (material.length < 40) {
        throw new Error(
          JSON.stringify({
            message: "Material insuficiente. Cole texto ou envie um PDF com texto.",
            status: 400,
          }),
        );
      }

      const { buildStudyPackMessages, parseStudyPackJson, mockStudyPack } = await import(
        "@/lib/tutor/study-pack"
      );
      const { expandStudyPackArticles } = await import("@/lib/mind-map/expand-articles");
      const {
        applyStubEnrichment,
        buildStubEnrichmentMessages,
        listStubNodes,
        scrubRemainingStubs,
      } = await import("@/lib/mind-map/enrich-stubs");
      const { tutorChat } = await import("@/server/tutor-llm");
      const mock = mockStudyPack({ title: data.title, subject: data.subject });
      const result = await tutorChat(buildStudyPackMessages({ ...data, material }), {
        task: "study-pack", mockText: JSON.stringify(mock),
      });
      const parsed = parseStudyPackJson(result.text);
      let pack = expandStudyPackArticles(parsed, material);

      // 2ª passagem: stubs ainda genéricos → IA completa com o material
      const stubs = listStubNodes(pack);
      if (stubs.length) {
        try {
          const enrich = await tutorChat(
            buildStubEnrichmentMessages({ material, stubs }),
            {
              task: "study-pack", mockText: JSON.stringify({
                items: stubs.map((s) => ({
                  tempId: s.tempId,
                  title: `Tipificacao ${s.artHint}`,
                  summary: `${s.artHint}: tipificacao conforme o material de estudo (demo).`,
                })),
              }),
            },
          );
          pack = applyStubEnrichment(pack, enrich.text);
        } catch (enrichErr) {
          console.warn("[tutor] enrich stubs falhou", enrichErr);
        }
      }

      pack = scrubRemainingStubs(pack);

      // 3ª passagem: questões objetivas de treino pela IA
      const {
        applyAiQuestions,
        buildAiQuestionsMessages,
        mockAiQuestions,
        parseAiQuestionsJson,
      } = await import("@/lib/mind-map/ai-questions");
      const qCount = Math.min(16, Math.max(4, data.flashcardCount ?? 10));
      try {
        const qResult = await tutorChat(
          buildAiQuestionsMessages({
            subject: data.subject,
            title: data.title,
            material,
            count: qCount,
            nodes: pack.nodes.map((n) => ({
              tempId: n.tempId,
              title: n.title,
              kind: n.kind,
              summary: n.summary,
            })),
          }),
          { task: "questions", mockText: JSON.stringify({ questions: mockAiQuestions(pack) }) },
        );
        let questions = parseAiQuestionsJson(qResult.text);
        if (!qResult.mocked && questions.length) {
          // Material do aluno é a fonte: o verificador resolve com ele em mãos.
          const { verifyGeneratedQuestions } = await import("@/server/question-verify");
          const v = await verifyGeneratedQuestions(questions, {
            subject: data.subject,
            legalContext: material.slice(0, 12_000),
          });
          questions = v.kept;
        }
        pack = applyAiQuestions(
          pack,
          questions.length >= 2 ? questions : mockAiQuestions(pack),
        );
      } catch (qErr) {
        console.warn("[tutor] questões IA falharam — usando fallback", qErr);
        pack = applyAiQuestions(pack, mockAiQuestions(pack));
      }

      return {
        pack,
        model: result.model,
        mocked: !!result.mocked,
        materialChars: material.length,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

/** Flashcards a partir de nós selecionados do mapa. */
export const generateFlashcardsFromNodes = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subject: z.string().max(200),
      mapTitle: z.string().max(200),
      count: z.number().int().min(2).max(16).optional().default(6),
      nodes: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            summary: z.string().optional().default(""),
            keywords: z.array(z.string()).optional().default([]),
          }),
        )
        .min(1)
        .max(20),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { tutorChat } = await import("@/server/tutor-llm");
      const block = data.nodes
        .map(
          (n) =>
            `- [${n.id}] ${n.title}${n.summary ? `: ${n.summary}` : ""}${
              n.keywords?.length ? ` (kw: ${n.keywords.join(", ")})` : ""
            }`,
        )
        .join("\n");
      const mockText = JSON.stringify({
        flashcards: data.nodes.slice(0, data.count).map((n) => ({
          front: `O que você lembra sobre “${n.title}”?`,
          back: n.summary || `Revise o tópico ${n.title} no mapa.`,
          topic: n.title,
          tags: n.keywords?.slice(0, 3) ?? [],
          nodeId: n.id,
        })),
      });
      const result = await tutorChat(
        [
          {
            role: "system",
            content: `Gere flashcards de revisão ativa a partir dos tópicos do mapa mental.
Responda SOMENTE JSON: {"flashcards":[{"front":"...","back":"...","topic":"...","tags":[],"nodeId":"id do nó"}]}
Regras: português claro; sem markdown; verso objetivo; use só o conteúdo dos nós; cerca de ${data.count} cartões.
Se o nó citar artigo, inclua o número (ex.: Art. 144). Se citar lei, inclua número e data/ano (ex.: Lei 8.112/1990). Não omita a referência legal.`,
          },
          {
            role: "user",
            content: `Mapa: ${data.mapTitle}\nMatéria: ${data.subject}\nNós:\n${block}`,
          },
        ],
        { task: "flashcards", mockText },
      );
      const cleaned = result.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");
      const parsed = JSON.parse(cleaned) as {
        flashcards?: {
          front?: string;
          back?: string;
          topic?: string;
          tags?: string[];
          nodeId?: string;
        }[];
      };
      const ids = new Set(data.nodes.map((n) => n.id));
      const flashcards = (parsed.flashcards ?? [])
        .map((c) => ({
          front: String(c.front ?? "").trim().slice(0, 280),
          back: String(c.back ?? "").trim().slice(0, 600),
          topic: String(c.topic ?? "").trim().slice(0, 80) || data.mapTitle,
          tags: Array.isArray(c.tags)
            ? c.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
            : [],
          nodeId: c.nodeId && ids.has(c.nodeId) ? c.nodeId : null,
        }))
        .filter((c) => c.front.length >= 3 && c.back.length >= 3)
        .slice(0, data.count);
      if (flashcards.length < 2) {
        throw new Error("Flashcards insuficientes. Tente de novo.");
      }
      return { flashcards, mocked: !!result.mocked, model: result.model };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

/** Reforço semanal: material mental + ideias de questões a partir dos erros. */
export const generateWeeklyReinforce = createServerFn({ method: "POST" })
  .validator(
    z.object({
      weekKey: z.string().min(4).max(16),
      summaryText: z.string().min(20).max(12_000),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { tutorChat } = await import("@/server/tutor-llm");
      const result = await tutorChat(
        [
          {
            role: "system",
            content: [
              "Voce e professor de concursos. Com base nos ERROS e no que o aluno estudou na semana,",
              "monte um REFORCO MENTAL curto (portugues claro) e 5 perguntas de autoavaliacao (sem gabarito longo).",
              "Nao invente lei fora do que os erros sugerem. Formato:",
              "1) Diagnostico da semana (5–8 linhas)",
              "2) Mapa mental em texto (hierarquia com tracos)",
              "3) Pontos a memorizar (bullets)",
              "4) 5 questoes de reforco (enunciado curto + 5 alternativas A–E estilo VUNESP, so a letra correta entre parenteses no fim de cada item)",
            ].join("\n"),
          },
          {
            role: "user",
            content: `Semana ${data.weekKey}\n\n${data.summaryText}`,
          },
        ],
        {
          task: "weekly", mockText: `1) Diagnostico da semana\nVoce acumulou erros nos temas listados. Foque nos verbos nucleares e nas distinguicoes tipicas de banca.\n\n2) Mapa mental\n- Temas da semana\n  - Erros recorrentes\n  - Revisao ativa\n\n3) Pontos a memorizar\n- Revise cada enunciado errado\n- Refaca 5 questoes parecidas no banco\n\n4) Questoes de reforco\n1. Conceito X — Assinale a correta. A) ... B) ... C) ... D) ... E) ... (A)\n2. ... (B)\n3. ... (C)\n4. ... (D)\n5. ... (E)`,
        },
      );
      return { text: result.text, model: result.model, mocked: !!result.mocked };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

async function throwTutorError(err: unknown): Promise<never> {
  const { toOllamaClientPayload } = await import("@/server/ollama/errors");
  const payload = toOllamaClientPayload(err);
  console.error("[tutor]", payload.code, payload.message);
  const e = new Error(JSON.stringify(payload));
  e.name = "TutorError";
  throw e;
}
