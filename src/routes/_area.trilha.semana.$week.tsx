import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MessageCircle,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { ProfessorText } from "@/components/professor-text";
import { errMsg } from "@/components/forms";
import { approvalTrailService } from "@/services/approval-trail.service";
import { trailWeekLessonService } from "@/services/trail-week-lesson.service";
import { trailProgressService } from "@/services/trail-progress.service";
import { cn } from "@/lib/utils";
import type { ProfessorModule, ProfessorModuleKind } from "@/types/trail-week-lesson";

export const Route = createFileRoute("/_area/trilha/semana/$week")({
  validateSearch: (s: Record<string, unknown>): { m?: number } => {
    const raw = s["m"];
    const n =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    return Number.isFinite(n) && n >= 1 ? { m: Math.floor(n) } : {};
  },
  head: () => ({
    meta: [{ title: "Professor IA — Semana da trilha" }],
  }),
  component: WeekLessonPage,
});

const KIND_META: Record<
  ProfessorModuleKind,
  { label: string; icon: typeof BookOpen; accent: string }
> = {
  abertura: { label: "Abertura", icon: GraduationCap, accent: "#e85d04" },
  teoria: { label: "Teoria", icon: BookOpen, accent: "#0077b6" },
  lei: { label: "Lei", icon: Scale, accent: "#6a040f" },
  memorizacao: { label: "Memorizar", icon: Brain, accent: "#2a9d8f" },
  material: { label: "Material", icon: Sparkles, accent: "#7b2cbf" },
  pratica: { label: "Prática", icon: Swords, accent: "#9b2226" },
  fechamento: { label: "Fechamento", icon: CheckCircle2, accent: "#2d6a4f" },
};

function WeekLessonPage() {
  const { week: weekParam } = Route.useParams();
  const week = Number(weekParam);
  const { m: moduleFromSearch } = Route.useSearch();
  const qc = useQueryClient();
  const [doubt, setDoubt] = useState("");
  const [searchApplied, setSearchApplied] = useState(false);

  useEffect(() => {
    setSearchApplied(false);
  }, [week, moduleFromSearch]);

  const trailQ = useQuery({
    queryKey: ["approval-trail"],
    queryFn: () => approvalTrailService.hydrate(),
  });

  const trailId = trailQ.data?.id;

  const lessonQ = useQuery({
    queryKey: ["trail-week-lesson", trailId, week],
    queryFn: () => trailWeekLessonService.ensureLesson(week),
    enabled: !!trailId && Number.isFinite(week) && week > 0,
    staleTime: Infinity,
    retry: 1,
  });

  const progressQ = useQuery({
    queryKey: ["trail-week-progress", trailId, week],
    queryFn: () => trailProgressService.hydrate(trailId!, week),
    enabled: !!trailId && Number.isFinite(week) && week > 0,
  });

  const progress = progressQ.data;
  const answers = progress?.practiceAnswers ?? {};
  const chat = progress?.chat ?? [];
  const completed = new Set(progress?.completedModuleIds ?? []);

  const regen = useMutation({
    mutationFn: () => trailWeekLessonService.ensureLesson(week, { force: true }),
    onSuccess: (lesson) => {
      qc.setQueryData(["trail-week-lesson", trailId, week], lesson);
      if (trailId && lesson.modules[0]?.id) {
        const p = trailProgressService.setActiveModule(
          trailId,
          week,
          lesson.modules[0].id,
          1,
        );
        qc.setQueryData(["trail-week-progress", trailId, week], p);
      }
      toast.success("Professor regenerou os módulos.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const ask = useMutation({
    mutationFn: async () => {
      const mod = lessonQ.data?.modules.find((m) => m.id === progress?.activeModuleId);
      return trailWeekLessonService.askProfessor({
        week,
        question: doubt.trim(),
        ...(mod?.title ? { moduleTitle: mod.title } : {}),
        lessonContext: [lessonQ.data?.professorIntro, mod?.body]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 6000),
      });
    },
    onSuccess: (r) => {
      if (!trailId) return;
      const p = trailProgressService.appendChat(trailId, week, [
        { role: "aluno", text: doubt.trim() },
        { role: "professor", text: r.answer },
      ]);
      qc.setQueryData(["trail-week-progress", trailId, week], p);
      setDoubt("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const trail = trailQ.data;
  const weekMeta = trail?.weeks.find((w) => w.week === week);
  const lesson = lessonQ.data;
  const modules = lesson?.modules ?? [];

  const active: ProfessorModule | null = useMemo(() => {
    if (!modules.length) return null;
    const id = progress?.activeModuleId;
    return modules.find((m) => m.id === id) ?? modules[0]!;
  }, [modules, progress?.activeModuleId]);

  useEffect(() => {
    if (!trailId || !lesson?.modules.length || !progressQ.isSuccess) return;

    if (
      !searchApplied &&
      moduleFromSearch != null &&
      moduleFromSearch >= 1 &&
      moduleFromSearch <= lesson.modules.length
    ) {
      const mod = lesson.modules[moduleFromSearch - 1]!;
      const p = trailProgressService.setActiveModule(
        trailId,
        week,
        mod.id,
        moduleFromSearch,
      );
      qc.setQueryData(["trail-week-progress", trailId, week], p);
      setSearchApplied(true);
      return;
    }

    if (progress?.activeModuleId) return;
    const first = lesson.modules[0]!;
    const p = trailProgressService.setActiveModule(trailId, week, first.id, 1);
    qc.setQueryData(["trail-week-progress", trailId, week], p);
  }, [
    trailId,
    lesson,
    progress?.activeModuleId,
    progressQ.isSuccess,
    week,
    qc,
    moduleFromSearch,
    searchApplied,
  ]);

  const topicIdsKey = weekMeta?.topicIds?.join(",") ?? "";

  // Liga o progresso do dia às etapas do edital (para rematch e sync de status).
  useEffect(() => {
    if (!trailId || !topicIdsKey || !progressQ.isSuccess) return;
    const ids = topicIdsKey.split(",").filter(Boolean);
    const p = trailProgressService.bindTopics(trailId, week, ids);
    qc.setQueryData(["trail-week-progress", trailId, week], p);
  }, [trailId, week, topicIdsKey, progressQ.isSuccess, qc]);

  if (!Number.isFinite(week) || week < 1) {
    return (
      <EmptyState
        title="Semana inválida"
        action={
          <Button asChild>
            <Link to="/trilha">Voltar</Link>
          </Button>
        }
      />
    );
  }

  if (trailQ.isLoading) return <ListSkeleton />;
  if (!trail || !weekMeta) {
    return (
      <EmptyState
        title="Semana não encontrada"
        description="Analise o edital na Trilha da aprovação primeiro."
        action={
          <Button asChild>
            <Link to="/trilha">Ir para a trilha</Link>
          </Button>
        }
      />
    );
  }

  const doneCount = modules.filter((m) => completed.has(m.id)).length;

  return (
    <>
      <PageHeader
        title={
          weekMeta?.dayLabel
            ? `Professor IA · ${weekMeta.dayLabel}${weekMeta.weekNumber ? ` (Semana ${weekMeta.weekNumber})` : ""}`
            : `Professor IA · Semana ${week}`
        }
        description={weekMeta?.focus ?? "Aula da etapa"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/trilha">
                <ArrowLeft className="h-4 w-4" /> Trilha
              </Link>
            </Button>
            <Button
              variant="secondary"
              disabled={regen.isPending || lessonQ.isFetching}
              onClick={() => regen.mutate()}
            >
              {regen.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerar módulos
            </Button>
            {trailId && progress?.status !== "concluida" && modules.length > 0 && (
              <Button
                variant="highlight"
                size="sm"
                onClick={() => {
                  const pratica = modules.find((m) => m.kind === "pratica");
                  const praticaQs = pratica?.questions ?? [];
                  if (pratica && praticaQs.length) {
                    const answered = praticaQs.filter((q) => answers[q.id]?.revealed).length;
                    if (answered < praticaQs.length) {
                      const praticaIdx = modules.findIndex((m) => m.id === pratica.id) + 1;
                      const p = trailProgressService.setActiveModule(
                        trailId,
                        week,
                        pratica.id,
                        praticaIdx > 0 ? praticaIdx : null,
                      );
                      qc.setQueryData(["trail-week-progress", trailId, week], p);
                      toast.message(
                        `Antes de concluir, faça a Prática (${answered}/${praticaQs.length} questões). Mínimo 5 por assunto.`,
                      );
                      return;
                    }
                    trailProgressService.markModuleDone(trailId, week, pratica.id);
                  }
                  const topicIds = weekMeta?.topicIds ?? progress?.topicIds ?? [];
                  if (topicIds.length) {
                    trailProgressService.bindTopics(trailId, week, topicIds);
                  }
                  const p = trailProgressService.setWeekStatus(trailId, week, "concluida");
                  qc.setQueryData(["trail-week-progress", trailId, week], p);
                  if (topicIds.length) {
                    approvalTrailService.setTopicsStatusByIds(topicIds, "concluida");
                    qc.invalidateQueries({ queryKey: ["approval-trail"] });
                  }
                  qc.invalidateQueries({ queryKey: ["trail-progress-all", trailId] });
                  toast.success("Dia marcado como concluído. Progresso salvo.");
                }}
              >
                Concluir dia
              </Button>
            )}
          </div>
        }
      />

      {lessonQ.isLoading && (
        <Panel className="mb-4 flex items-center gap-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          O professor está montando os módulos da sua aula…
        </Panel>
      )}
      {lessonQ.error && <ErrorState error={lessonQ.error} onRetry={() => lessonQ.refetch()} />}

      {lesson && active && (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Panel className="h-fit space-y-2 p-3">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Módulos · {doneCount}/{modules.length}
            </p>
            {progress?.status === "concluida" && (
              <Badge variant="secondary" className="mx-1">
                Dia concluído
              </Badge>
            )}
            <ul className="space-y-1">
              {modules.map((m, i) => {
                const meta = KIND_META[m.kind] ?? KIND_META.teoria;
                const Icon = meta.icon;
                const selected = active.id === m.id;
                const isDone = completed.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!trailId) return;
                        const p = trailProgressService.setActiveModule(
                          trailId,
                          week,
                          m.id,
                          i + 1,
                        );
                        qc.setQueryData(["trail-week-progress", trailId, week], p);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
                        selected ? "bg-accent font-medium" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: meta.accent }}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] uppercase text-muted-foreground">
                          {i + 1}. {meta.label}
                        </span>
                        <span className="line-clamp-2 leading-snug">{m.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="space-y-4">
            <Panel className="border-highlight/30 bg-highlight-soft/20">
              <div className="mb-2 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-highlight" />
                <p className="text-sm font-bold">Professor IA</p>
                {lesson.mocked && <Badge variant="secondary">Mock</Badge>}
              </div>
              <ProfessorText text={lesson.professorIntro} />
              <p className="mt-2 text-xs text-muted-foreground">
                Objetivo: {lesson.objective}
              </p>
            </Panel>

            <Panel
              title={active.title}
              action={
                <Badge variant="outline">
                  {(KIND_META[active.kind] ?? KIND_META.teoria).label}
                </Badge>
              }
            >
              {(active.definition || active.mnemonic || active.example) && (
                <div className="mb-5 space-y-4">
                  {active.definition && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        Definição
                      </p>
                      <ProfessorText text={active.definition} className="mt-2" />
                    </div>
                  )}
                  {active.mnemonic && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        Macete de fixação
                      </p>
                      <ProfessorText text={active.mnemonic} className="mt-2" />
                    </div>
                  )}
                  {active.example && (
                    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                        Exemplo de uso
                      </p>
                      <ProfessorText text={active.example} className="mt-2" />
                    </div>
                  )}
                </div>
              )}

              {!!active.body?.trim() && !(active.definition || active.mnemonic || active.example) ? (
                <ProfessorText text={active.body} />
              ) : null}
              {!!active.body?.trim() &&
              (active.definition || active.mnemonic || active.example) &&
              !active.body.startsWith("Definição.") ? (
                <ProfessorText text={active.body} className="mb-4 text-muted-foreground" />
              ) : null}

              {!!active.questions?.length && (
                <div className="mt-6 space-y-4">
                  <p className="text-sm font-semibold">
                    {active.kind === "pratica"
                      ? `Prática do dia · ${active.questions.length} questões (≥5 por assunto)`
                      : `Memorização · ${active.questions.length} questões`}
                  </p>
                  {active.questions.map((q, idx) => {
                    const choice = answers[q.id]?.choice;
                    const show = answers[q.id]?.revealed;
                    const ok = choice === q.correctKey;
                    return (
                      <div key={q.id} className="rounded-lg border p-4">
                        <p className="text-sm font-medium">Questão {idx + 1}</p>
                        <ProfessorText
                          text={q.statement}
                          className="mt-2 text-sm leading-relaxed [&_p]:mb-0 [&_strong]:rounded-sm [&_strong]:bg-amber-200/80 [&_strong]:px-0.5 [&_strong]:font-semibold [&_strong]:text-foreground"
                        />
                        <ul className="mt-3 space-y-2">
                          {q.alternatives.map((a) => (
                            <li key={a.key}>
                              <button
                                type="button"
                                disabled={!!show}
                                onClick={() => {
                                  if (!trailId) return;
                                  const p = trailProgressService.setPracticeAnswer(
                                    trailId,
                                    week,
                                    q.id,
                                    { choice: a.key, revealed: false },
                                  );
                                  qc.setQueryData(["trail-week-progress", trailId, week], p);
                                }}
                                className={cn(
                                  "flex w-full rounded-md border px-3 py-2 text-left text-sm",
                                  choice === a.key && "border-primary bg-primary/5",
                                  show &&
                                    a.key === q.correctKey &&
                                    "border-emerald-600 bg-emerald-500/10",
                                  show &&
                                    choice === a.key &&
                                    a.key !== q.correctKey &&
                                    "border-destructive bg-destructive/10",
                                )}
                              >
                                <span className="mr-2 font-bold">{a.key})</span>
                                {a.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            disabled={!choice || !!show}
                            onClick={() => {
                              if (!trailId || !choice) return;
                              const p = trailProgressService.setPracticeAnswer(
                                trailId,
                                week,
                                q.id,
                                { choice, revealed: true },
                              );
                              qc.setQueryData(["trail-week-progress", trailId, week], p);
                            }}
                          >
                            Conferir com o professor
                          </Button>
                          {show && (
                            <span className="text-sm">
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" /> Acertou
                                </span>
                              ) : (
                                <span className="text-destructive">
                                  Errou — gabarito {q.correctKey}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {show && (
                          <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm">
                            <p className="font-medium">Explicação do professor</p>
                            <ProfessorText
                              text={q.explanation}
                              className="mt-1 text-muted-foreground"
                            />
                            <p className="mt-2 text-xs">Base: {q.legalBasis}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={modules[0]?.id === active.id}
                  onClick={() => {
                    if (!trailId) return;
                    const i = modules.findIndex((m) => m.id === active.id);
                    if (i > 0) {
                      const p = trailProgressService.setActiveModule(
                        trailId,
                        week,
                        modules[i - 1]!.id,
                        i,
                      );
                      qc.setQueryData(["trail-week-progress", trailId, week], p);
                    }
                  }}
                >
                  Módulo anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={completed.has(active.id)}
                  onClick={() => {
                    if (!trailId) return;
                    const p = trailProgressService.markModuleDone(trailId, week, active.id);
                    qc.setQueryData(["trail-week-progress", trailId, week], p);
                    toast.success("Módulo marcado como visto.");
                  }}
                >
                  {completed.has(active.id) ? "Módulo visto" : "Marcar como visto"}
                </Button>
                <Button
                  size="sm"
                  variant="highlight"
                  disabled={modules[modules.length - 1]?.id === active.id}
                  onClick={() => {
                    if (!trailId) return;
                    const i = modules.findIndex((m) => m.id === active.id);
                    if (i >= 0 && i < modules.length - 1) {
                      trailProgressService.markModuleDone(trailId, week, active.id);
                      const p = trailProgressService.setActiveModule(
                        trailId,
                        week,
                        modules[i + 1]!.id,
                        i + 2,
                      );
                      qc.setQueryData(["trail-week-progress", trailId, week], p);
                    }
                  }}
                >
                  Próximo módulo
                </Button>
              </div>
            </Panel>

            <Panel title="Tire dúvida com o professor">
              <div className="mb-3 space-y-2">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      m.role === "professor" ? "bg-highlight-soft/50" : "ml-6 bg-muted/60",
                    )}
                  >
                    <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {m.role === "professor" ? "Professor" : "Você"}
                    </p>
                    <ProfessorText text={m.text} />
                  </div>
                ))}
              </div>
              <Textarea
                rows={3}
                placeholder="Ex.: Não entendi a diferença entre concussão e corrupção passiva…"
                value={doubt}
                onChange={(e) => setDoubt(e.target.value)}
              />
              <Button
                className="mt-2"
                disabled={doubt.trim().length < 3 || ask.isPending}
                onClick={() => ask.mutate()}
              >
                {ask.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Perguntar ao professor
              </Button>
            </Panel>

            {!!lesson.warnings.length && (
              <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
                {lesson.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
