import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  explainVideoWrongFn,
  generateVideoLessonQuizFn,
} from "@/services/video-lessons.fns";
import { videoLessonQuizStore } from "@/services/video-lesson-quiz-store";
import { errorNotesService } from "@/services";
import type { VideoQuizQuestion } from "@/lib/video-lessons/ai-quiz";

type Props = {
  lessonId: string;
  subjectName: string;
  lessonTitle: string;
};

export function VideoLessonQuiz({ lessonId, subjectName, lessonTitle }: Props) {
  const cached = videoLessonQuizStore.getQuiz(lessonId);
  const [questions, setQuestions] = useState<VideoQuizQuestion[]>(
    cached?.quiz.questions ?? [],
  );
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const gen = useMutation({
    mutationFn: () =>
      generateVideoLessonQuizFn({
        data: { lessonId, subjectName, lessonTitle, count: 8 },
      }),
    onSuccess: (r) => {
      videoLessonQuizStore.setQuiz({
        lessonId,
        quiz: r.quiz,
        model: r.model,
        mocked: r.mocked,
        savedAt: new Date().toISOString(),
      });
      setQuestions(r.quiz.questions);
      setIdx(0);
      setDraft(null);
      setLocked(false);
      setLastCorrect(null);
      setTip(null);
      setCorrectCount(0);
      setDone(false);
    },
  });

  useEffect(() => {
    void videoLessonQuizStore.hydrate();
    if (!cached && !gen.isPending && !gen.isSuccess) {
      gen.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gera uma vez ao montar
  }, [lessonId]);

  const q = questions[idx];
  const answered = useMemo(
    () => videoLessonQuizStore.answersForLesson(lessonId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonId, locked, done],
  );

  if (gen.isPending && !questions.length) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Gerando pelo menos 8 questões com IA sobre esta aula...
      </div>
    );
  }

  if (gen.isError && !questions.length) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <p className="text-sm text-destructive">
          Não foi possível gerar as questões. Tente de novo.
        </p>
        <Button type="button" onClick={() => gen.mutate()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!q || done) {
    const total = questions.length || answered.length;
    const ok =
      correctCount ||
      answered.filter((a) => a.correct).length;
    return (
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Quiz da aula concluído</h3>
        <p className="text-sm text-muted-foreground">
          Acertos: {ok}/{total}. Os erros foram para o Caderno de erros (origem
          Videoaula) e entram no balancete de desempenho.
        </p>
        <Button type="button" variant="outline" onClick={() => gen.mutate()}>
          Gerar novo conjunto
        </Button>
      </div>
    );
  }

  const confirm = async () => {
    if (!draft || locked) return;
    const correct = draft.toUpperCase() === q.correctKey;
    setLocked(true);
    setLastCorrect(correct);
    if (correct) {
      setCorrectCount((c) => c + 1);
      setTip(null);
      videoLessonQuizStore.recordAnswer({
        lessonId,
        questionId: q.id,
        choice: draft,
        correct: true,
        tip: null,
        at: new Date().toISOString(),
      });
      return;
    }

    setTipLoading(true);
    let approach = "";
    try {
      const r = await explainVideoWrongFn({
        data: {
          subjectName,
          lessonTitle,
          statement: q.statement,
          alternatives: q.alternatives,
          choice: draft,
        },
      });
      approach = r.tip;
      setTip(r.tip);
    } catch {
      approach =
        "Revise o comando da questão e elimine alternativas absolutas ou fora do tema da aula — sem atalhar para o gabarito.";
      setTip(approach);
    } finally {
      setTipLoading(false);
    }

    videoLessonQuizStore.recordAnswer({
      lessonId,
      questionId: q.id,
      choice: draft,
      correct: false,
      tip: approach,
      at: new Date().toISOString(),
    });

    void errorNotesService
      .save({
        questionId: q.id,
        reasonCode: "nao-sabia",
        origin: "video-aula",
        snapshot: true,
        subject: subjectName,
        topic: q.topic || lessonTitle,
        statement: q.statement,
        yourKey: draft,
        correctKey: q.correctKey,
        explanation: approach,
        sourceLabel: `Videoaula · ${lessonTitle}`,
      })
      .catch(() => undefined);
  };

  const goNext = () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setDraft(null);
    setLocked(false);
    setLastCorrect(null);
    setTip(null);
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Questões da aula</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {idx + 1}/{questions.length}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{q.statement}</p>
      <div className="space-y-2">
        {q.alternatives.map((alt) => {
          const selected = draft === alt.key;
          const showCorrect = locked && lastCorrect && alt.key === q.correctKey;
          const showWrong = locked && !lastCorrect && selected;
          return (
            <button
              key={alt.key}
              type="button"
              disabled={locked}
              onClick={() => setDraft(alt.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                selected && !locked && "border-primary bg-primary/5",
                showCorrect && "border-emerald-600 bg-emerald-50",
                showWrong && "border-destructive bg-destructive/5",
                !selected && !locked && "hover:bg-muted/60",
              )}
            >
              <span className="font-semibold">{alt.key})</span>
              <span>{alt.text}</span>
            </button>
          );
        })}
      </div>

      {locked && lastCorrect && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Certo. {q.explanation}
        </p>
      )}
      {locked && lastCorrect === false && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Como resolver (sem gabarito)</p>
          <p>{tipLoading ? "Gerando orientação com IA..." : tip}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!locked ? (
          <Button type="button" disabled={!draft} onClick={() => void confirm()}>
            Confirmar
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            {idx + 1 >= questions.length ? "Ver resultado" : "Próxima"}
          </Button>
        )}
      </div>
    </div>
  );
}
