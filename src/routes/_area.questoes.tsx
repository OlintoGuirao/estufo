import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, CalendarPlus, ChevronLeft, ChevronRight, Play, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScratchPad } from "@/components/scratch-pad";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { errMsg } from "@/components/forms";
import { RECURRING_MIN, focusesToSchedule } from "@/lib/study-plan-diagnostic";
import { cn } from "@/lib/utils";
import {
  studyPlanDiagnosticService,
  type DiagnosticRun,
} from "@/services/study-plan-diagnostic.service";
import { questionsService } from "@/services";
import { toast } from "sonner";

export const Route = createFileRoute("/_area/questoes")({
  head: () => ({
    meta: [
      { title: "Plano de estudo — Estufoo" },
      { name: "description", content: "Prova diagnóstica aleatória para montar seu plano de estudo." },
      { property: "og:title", content: "Plano de estudo — Estufoo" },
      { property: "og:description", content: "Prova diagnóstica aleatória para montar seu plano de estudo." },
    ],
  }),
  component: Questions,
});

function Questions() {
  return <DiagnosticFlow />;
}

function DiagnosticFlow() {
  const qc = useQueryClient();
  const runQ = useQuery({
    queryKey: ["study-plan-diagnostic"],
    queryFn: () => studyPlanDiagnosticService.hydrate(),
  });

  const start = useMutation({
    mutationFn: async () => studyPlanDiagnosticService.startRandomProva(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-plan-diagnostic"] });
      toast.success("Estudo iniciado — boa prova!");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const finish = useMutation({
    mutationFn: async () => studyPlanDiagnosticService.finish(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-plan-diagnostic"] });
      toast.success("Prova finalizada. Veja suas dificuldades abaixo.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const apply = useMutation({
    mutationFn: () => studyPlanDiagnosticService.applyFocusToSchedule(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["study-plan-diagnostic"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (r.created === 0) {
        toast.message("Nada novo para agendar — já aplicado ou sem erros.");
      } else {
        toast.success(`${r.created} sessão(ões) no cronograma.`);
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const restart = () => {
    studyPlanDiagnosticService.clearCurrent();
    qc.invalidateQueries({ queryKey: ["study-plan-diagnostic"] });
    start.mutate();
  };

  if (runQ.isLoading) return <ListSkeleton />;
  if (runQ.error) return <ErrorState error={runQ.error} onRetry={runQ.refetch} />;

  const run = runQ.data ?? null;
  const running = !!run && !run.finishedAt;
  const finished = !!run?.finishedAt && !!run.analysis;

  if (running && run) {
    return (
      <ExamRunning
        run={run}
        onChanged={() => qc.invalidateQueries({ queryKey: ["study-plan-diagnostic"] })}
        onFinish={() => finish.mutate()}
        finishing={finish.isPending}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Plano de estudo"
        description="Faça uma prova diagnóstica sorteada. Com base nos erros, montamos o foco do seu estudo."
        actions={
          <Button variant="outline" asChild>
            <Link to="/erros">
              <BookMarked className="h-4 w-4" />
              Caderno de erros
            </Link>
          </Button>
        }
      />
      {finished && run?.analysis ? (
        <ExamResult
          run={run}
          applying={apply.isPending}
          onApply={() => apply.mutate()}
          onRestart={restart}
          restarting={start.isPending}
        />
      ) : (
        <Panel className="mx-auto max-w-xl space-y-5 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Pronto para começar?</h2>
            <p className="text-sm text-muted-foreground">
              Vamos sortear uma prova de 22 questões. Respostas e progresso são salvos neste
              dispositivo — você pode sair e continuar depois.
            </p>
          </div>
          <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>
            <Play className="h-4 w-4" />
            {start.isPending ? "Sorteando prova…" : "Iniciar estudo"}
          </Button>
        </Panel>
      )}
    </>
  );
}

function ExamRunning({
  run,
  onChanged,
  onFinish,
  finishing,
}: {
  run: DiagnosticRun;
  onChanged: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const [idx, setIdx] = useState(() => run.currentIndex ?? 0);
  const [pending, setPending] = useState(false);
  const q = run.questions[idx];
  const answeredCount = run.answers.length;
  const allAnswered = answeredCount >= run.questions.length;
  const draft =
    q?.answered?.choice ?? (q ? (run.drafts[q.id] ?? null) : null);

  useEffect(() => {
    if (idx !== run.currentIndex) {
      studyPlanDiagnosticService.setCurrentIndex(idx);
      onChanged();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só persiste quando o usuário muda o índice
  }, [idx]);

  const goTo = (next: number) => {
    const max = run.questions.length - 1;
    const clamped = Math.min(Math.max(0, next), max);
    setIdx(clamped);
  };

  const pickDraft = (choice: string) => {
    if (!q || q.answered || pending) return;
    studyPlanDiagnosticService.setDraft(q.id, choice);
    onChanged();
  };

  const confirm = async () => {
    if (!q || pending || q.answered || !draft) return;
    setPending(true);
    try {
      const result = await questionsService.answer(q.id, { choice: draft, timeSec: 0 });
      studyPlanDiagnosticService.answerCurrent(q.id, draft, result.correctKey, {
        subject: q.subject,
        topic: q.topic,
      });
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPending(false);
    }
  };

  if (!q) {
    return <EmptyState title="Prova vazia" description="Reinicie o estudo." />;
  }

  const selected = draft;
  const locked = !!q.answered;

  return (
    <div className="-mx-1 space-y-3 sm:-mx-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm text-muted-foreground">
            {idx + 1} de {run.questions.length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {answeredCount} respondida(s) · progresso salvo
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Questão anterior"
            disabled={idx === 0}
            onClick={() => goTo(idx - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ddd9d1] bg-white text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima questão"
            disabled={idx >= run.questions.length - 1}
            onClick={() => goTo(idx + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ddd9d1] bg-white text-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ebe7df] bg-white p-5 shadow-sm sm:p-7">
        <p className="font-serif text-sm font-semibold tracking-wide text-[#b56a3a]">
          QUESTÃO {idx + 1}
        </p>
        <p className="mt-3 font-serif text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {q.statement}
        </p>

        <div className="mt-6 space-y-2.5">
          {q.alternatives.map((alt) => {
            const isSelected = selected === alt.key;
            const isCorrect = locked && q.answered?.correct && q.answered.choice === alt.key;
            const isWrong = locked && !q.answered?.correct && q.answered?.choice === alt.key;
            return (
              <button
                key={alt.key}
                type="button"
                disabled={locked || pending}
                onClick={() => pickDraft(alt.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-left transition-colors",
                  "border-[#e2ddd4] bg-white hover:border-[#c9c3b8]",
                  isSelected && !locked && "border-[#1a3d32] bg-[#1a3d32]/[0.04] ring-1 ring-[#1a3d32]/30",
                  isCorrect && "border-[#1a3d32]/50 bg-[#e8f2ee]",
                  isWrong && "border-destructive/40 bg-destructive/5",
                  locked && !isSelected && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                    isWrong ? "bg-destructive" : "bg-[#1a3d32]",
                  )}
                >
                  {alt.key}
                </span>
                <span className="text-sm leading-snug text-foreground sm:text-[15px]">{alt.text}</span>
              </button>
            );
          })}
        </div>

        {!locked ? (
          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-xl bg-[#6f7f72] text-base font-medium text-white hover:bg-[#5f6e62]"
            disabled={!draft || pending}
            onClick={confirm}
          >
            {pending ? "Confirmando…" : "Confirmar"}
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            <p
              className={cn(
                "text-center text-sm font-medium",
                q.answered?.correct ? "text-[#1a3d32]" : "text-destructive",
              )}
            >
              {q.answered?.correct ? "Acertou." : "Errou — o foco do plano usa esses erros."}
            </p>
            {idx < run.questions.length - 1 ? (
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#6f7f72] text-base text-white hover:bg-[#5f6e62]"
                onClick={() => goTo(idx + 1)}
              >
                Próxima questão
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#1a3d32] text-base text-white hover:bg-[#143229]"
                disabled={!allAnswered || finishing}
                onClick={onFinish}
              >
                {finishing
                  ? "Analisando…"
                  : allAnswered
                    ? "Finalizar e ver dificuldades"
                    : "Responda todas para finalizar"}
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 border-t border-[#ebe7df] pt-6">
          <ScratchPad resetKey={q.id} />
        </div>
      </div>
    </div>
  );
}

function ExamResult({
  run,
  onApply,
  applying,
  onRestart,
  restarting,
}: {
  run: DiagnosticRun;
  onApply: () => void;
  applying: boolean;
  onRestart: () => void;
  restarting: boolean;
}) {
  const analysis = run.analysis!;
  const schedule = useMemo(() => focusesToSchedule(analysis), [analysis]);
  const alreadyApplied = run.scheduledFocusKeys.length > 0;

  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <h2 className="text-lg font-semibold">Suas dificuldades</h2>
        <p className="text-sm text-muted-foreground">
          {analysis.correct} acertos · {analysis.wrong} erros · {analysis.accuracyPct}% de aproveitamento
          ({analysis.total} questões)
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.bySubject.map((s) => (
            <div key={s.subject} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{s.subject}</p>
              <p className="text-muted-foreground">
                {s.correct}/{s.total} · {s.pct}%
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-3">
        <h3 className="font-semibold">Foco de estudo</h3>
        {analysis.focuses.length > 0 ? (
          <ul className="space-y-2">
            {analysis.focuses.map((f) => (
              <li
                key={`${f.subject}-${f.topic}`}
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <p className="font-medium">{f.subject}</p>
                <p className="text-muted-foreground">
                  {f.wrongCount} erro(s) neste assunto (recorrente ≥{RECURRING_MIN})
                </p>
              </li>
            ))}
          </ul>
        ) : analysis.singleErrorTopics.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Nenhum assunto com ≥{RECURRING_MIN} erros. Sugestões a partir de erros isolados:
            </p>
            <ul className="space-y-2">
              {analysis.singleErrorTopics.slice(0, 3).map((f) => (
                <li key={`${f.subject}-${f.topic}`} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{f.subject}</p>
                  <p className="text-muted-foreground">1 erro neste diagnóstico</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem erros — mantenha a revisão leve no cronograma.</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onApply} disabled={applying || schedule.length === 0 || alreadyApplied}>
            <CalendarPlus className="h-4 w-4" />
            {alreadyApplied
              ? "Já aplicado ao cronograma"
              : applying
                ? "Aplicando…"
                : "Aplicar ao cronograma"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/plano">Abrir cronograma</Link>
          </Button>
          <Button variant="ghost" onClick={onRestart} disabled={restarting}>
            <RotateCcw className="h-4 w-4" />
            Novo diagnóstico
          </Button>
        </div>
      </Panel>
    </div>
  );
}
