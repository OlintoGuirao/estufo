import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function throwTutorError(err: unknown): Promise<never> {
  const { OllamaError } = await import("@/server/ollama/errors");
  if (err instanceof OllamaError) throw err;
  const msg = err instanceof Error ? err.message : "Erro nas videoaulas.";
  throw new OllamaError("upstream", msg, 503);
}

export const listVideoSubjectsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listVideoSubjects, getVideoSourceLabel } = await import(
    "@/server/video-lessons/catalog"
  );
  const { getBunnyVideoConfig, isBunnyVideoConfigured } = await import(
    "@/server/video-lessons/config"
  );
  const subjects = await listVideoSubjects();
  const bunny = getBunnyVideoConfig();
  const cdnLooksLikeStorageApi = !!bunny?.cdnBaseUrl && /storage\.bunnycdn\.com/i.test(bunny.cdnBaseUrl);
  return {
    source: getVideoSourceLabel(),
    provider: isBunnyVideoConfigured() ? ("bunny" as const) : ("local" as const),
    subjects,
    available: subjects.length > 0,
    warning: cdnLooksLikeStorageApi
      ? "BUNNY_CDN_BASE_URL está apontando para storage.bunnycdn.com. Use a URL da Pull Zone (ex.: https://sua-zone.b-cdn.net), senão o player não toca."
      : null,
  };
});

export const listVideoLessonsFn = createServerFn({ method: "POST" })
  .validator(z.object({ subjectId: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const { listLessonsForSubject } = await import("@/server/video-lessons/catalog");
    const lessons = await listLessonsForSubject(data.subjectId);
    // Pré-aquece previews em background (fila 1 a 1).
    const { warmSubjectThumbs } = await import("@/server/video-lessons/thumb");
    warmSubjectThumbs(
      data.subjectId,
      lessons.map((l) => l.fileName),
    );
    return { lessons };
  });

export const generateVideoLessonQuizFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      lessonId: z.string().min(1).max(120),
      subjectName: z.string().min(1).max(200),
      lessonTitle: z.string().min(1).max(300),
      count: z.number().int().min(8).max(12).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const count = data.count ?? 8;
      const {
        buildVideoLessonQuizMessages,
        mockVideoLessonQuiz,
        parseVideoLessonQuizJson,
      } = await import("@/lib/video-lessons/ai-quiz");
      const { tutorChat } = await import("@/server/tutor-llm");
      const mock = mockVideoLessonQuiz({
        lessonId: data.lessonId,
        subjectName: data.subjectName,
        lessonTitle: data.lessonTitle,
        count,
      });
      const result = await tutorChat(
        buildVideoLessonQuizMessages({
          subjectName: data.subjectName,
          lessonTitle: data.lessonTitle,
          count,
        }),
        { mockText: JSON.stringify(mock) },
      );
      let payload;
      try {
        payload = parseVideoLessonQuizJson(result.text, {
          lessonId: data.lessonId,
          subjectName: data.subjectName,
          lessonTitle: data.lessonTitle,
          count,
        });
      } catch {
        payload = mock;
      }
      return { quiz: payload, model: result.model, mocked: !!result.mocked };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

export const explainVideoWrongFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subjectName: z.string().min(1).max(200),
      lessonTitle: z.string().min(1).max(300),
      statement: z.string().min(1).max(1200),
      alternatives: z
        .array(z.object({ key: z.string().min(1).max(1), text: z.string().min(1).max(500) }))
        .min(2)
        .max(5),
      choice: z.string().min(1).max(1),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { buildWrongApproachMessages, mockWrongApproach } = await import(
        "@/lib/video-lessons/ai-quiz"
      );
      const { tutorChat } = await import("@/server/tutor-llm");
      const result = await tutorChat(buildWrongApproachMessages(data), {
        mockText: mockWrongApproach(data.choice),
      });
      const text = (result.text || mockWrongApproach(data.choice)).trim().slice(0, 1600);
      return { tip: text, model: result.model, mocked: !!result.mocked };
    } catch (err) {
      return await throwTutorError(err);
    }
  });
