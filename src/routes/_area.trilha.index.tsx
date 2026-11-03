import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, FileUp, Loader2, Map as MapIcon, CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader, Panel } from "@/components/common";
import { TrailResumeCard } from "@/components/trail/resume-card";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { approvalTrailService } from "@/services/approval-trail.service";
import { trailWeekLessonStore } from "@/services/trail-week-lesson-store";
import { trailProgressService } from "@/services/trail-progress.service";
import { EXAM_IMPORT_MAX_BYTES } from "@/lib/exam-import/validate";
import { cn } from "@/lib/utils";
import type {
  TrailPhaseStatus,
  TrailSubject,
  TrailTopic,
  TrailWeek,
} from "@/types/approval-trail";
import type { TrailWeekProgress } from "@/types/trail-progress";

function groupSessionsByWeek(sessions: TrailWeek[]) {
  const map = new Map<
    number,
    { weekNumber: number; subject: string; sessions: TrailWeek[]; subjects: string[] }
  >();
  for (const s of sessions) {
    const wn = s.weekNumber ?? s.week;
    const cur = map.get(wn) ?? {
      weekNumber: wn,
      subject: "",
      sessions: [],
      subjects: [],
    };
    cur.sessions.push(s);
    for (const name of s.subjectNames) {
      if (name && !cur.subjects.includes(name)) cur.subjects.push(name);
    }
    cur.subject =
      cur.subjects.length <= 2
        ? cur.subjects.join(" · ")
        : `${cur.subjects[0]} · +${cur.subjects.length - 1}`;
    map.set(wn, cur);
  }
  return [...map.values()].sort((a, b) => a.weekNumber - b.weekNumber);
}

export const Route = createFileRoute("/_area/trilha/")({
  head: () => ({
    meta: [
      { title: "Trilha da aprovação — Estufoo" },
      {
        name: "description",
        content: "Analise o edital com IA e acompanhe seu plano de estudos.",
      },
    ],
  }),
  component: TrilhaPage,
});

function TrilhaPage() {
  const qc = useQueryClient();
  const trailQ = useQuery({
    queryKey: ["approval-trail"],
    queryFn: () => approvalTrailService.hydrate(),
  });
  const progressAllQ = useQuery({
    queryKey: ["trail-progress-all", trailQ.data?.id],
    queryFn: () => trailProgressService.hydrateAll(trailQ.data!.id),
    enabled: !!trailQ.data?.id,
  });
  const progressByWeek = useMemo(() => {
    const map = new Map<number, TrailWeekProgress>();
    for (const p of progressAllQ.data ?? []) map.set(p.week, p);
    return map;
  }, [progressAllQ.data]);
  const [file, setFile] = useState<File | null>(null);
  const [hours, setHours] = useState(2);
  const [weeks, setWeeks] = useState(10);
  const [drag, setDrag] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o PDF do edital.");
      return approvalTrailService.analyzeFromPdf({
        file,
        hoursPerWeek: hours,
        weeksTarget: weeks,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-trail"] });
      toast.success("Trilha criada por matéria. Gere o material em cada uma para explicar os artigos.");
      setFile(null);
      setSetupOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  // Primeira visita em /trilha: abre o pop-up de configuração + PDF.
  useEffect(() => {
    if (trailQ.isLoading || trailQ.isFetching) return;
    if (autoOpened) return;
    if (!trailQ.data) {
      setSetupOpen(true);
      setAutoOpened(true);
    }
  }, [trailQ.isLoading, trailQ.isFetching, trailQ.data, autoOpened]);

  const setStatus = useMutation({
    mutationFn: async (args: {
      subjectId: string;
      topicId: string;
      status: TrailPhaseStatus;
    }) => approvalTrailService.setTopicStatus(args.subjectId, args.topicId, args.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-trail"] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const [materialSubjectId, setMaterialSubjectId] = useState<string | null>(null);
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrent, setBatchCurrent] = useState("");
  const [batchErrors, setBatchErrors] = useState<{ name: string; message: string }[]>([]);
  const [batchDone, setBatchDone] = useState(0);
  /** null = ainda não escolheu; abre se houver matéria pendente. */
  const [materialOpen, setMaterialOpen] = useState<boolean | null>(null);

  const genMaterial = useMutation({
    mutationFn: async (subjectId: string) => {
      setMaterialSubjectId(subjectId);
      return approvalTrailService.generateSubjectMaterial(subjectId);
    },
    onSuccess: (trail) => {
      qc.invalidateQueries({ queryKey: ["approval-trail"] });
      qc.invalidateQueries({ queryKey: ["trail-progress-all", trail.id] });
      toast.success("Material gerado. O cronograma por dia foi liberado abaixo.");
      setMaterialSubjectId(null);
    },
    onError: (e) => {
      setMaterialSubjectId(null);
      toast.error(errMsg(e));
    },
  });

  const materialBusy = genMaterial.isPending || batchRunning;

  const runGenerateAll = async () => {
    const current = approvalTrailService.get() ?? trailQ.data;
    if (!current || batchRunning || genMaterial.isPending) return;

    const queue = current.subjects.filter((s) =>
      s.topics.some((t) => !t.explanation?.trim()),
    );
    if (!queue.length) {
      toast.message("Todas as matérias já têm material gerado.");
      return;
    }

    setBatchOpen(true);
    setBatchRunning(true);
    setBatchIndex(0);
    setBatchDone(0);
    setBatchTotal(queue.length);
    setBatchCurrent("");
    setBatchErrors([]);

    let ok = 0;
    const errors: { name: string; message: string }[] = [];

    for (let i = 0; i < queue.length; i++) {
      const subject = queue[i]!;
      setBatchIndex(i + 1);
      setBatchCurrent(subject.name);
      try {
        const next = await approvalTrailService.generateSubjectMaterial(subject.id);
        ok += 1;
        setBatchDone(ok);
        qc.setQueryData(["approval-trail"], next);
      } catch (e) {
        errors.push({ name: subject.name, message: errMsg(e) });
        setBatchErrors([...errors]);
      }
    }

    setBatchRunning(false);
    setBatchCurrent("");
    await qc.invalidateQueries({ queryKey: ["approval-trail"] });
    if (current.id) {
      await qc.invalidateQueries({ queryKey: ["trail-progress-all", current.id] });
    }

    if (errors.length === 0) {
      toast.success(`Material gerado para ${ok} matérias.`);
    } else if (ok > 0) {
      toast.message(`Gerado em ${ok} matérias; ${errors.length} com erro.`);
    } else {
      toast.error("Não foi possível gerar o material.");
    }
  };

  const addCard = (subjectId: string) => {
    const next = approvalTrailService.addCustomTopic(subjectId);
    if (!next) {
      toast.error("Não foi possível criar o card.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["approval-trail"] });
    toast.success("Card criado. Edite o título e clique em Gerar material.");
  };

  const renameCard = (subjectId: string, topicId: string, name: string) => {
    approvalTrailService.updateTopicName(subjectId, topicId, name);
    qc.invalidateQueries({ queryKey: ["approval-trail"] });
  };

  const removeCard = (subjectId: string, topicId: string) => {
    approvalTrailService.removeTopic(subjectId, topicId);
    qc.invalidateQueries({ queryKey: ["approval-trail"] });
    toast.success("Card removido.");
  };

  const trail = trailQ.data;
  const totalTopics = trail?.subjects.reduce((n, s) => n + s.topics.length, 0) ?? 0;
  const doneTopics =
    trail?.subjects.reduce(
      (n, s) => n + s.topics.filter((t) => t.status === "concluida").length,
      0,
    ) ?? 0;
  const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const pendingMaterialCount =
    trail?.subjects.filter((s) => !s.topics.some((t) => !!t.explanation?.trim())).length ?? 0;
  const materialExpanded = materialOpen ?? pendingMaterialCount > 0;

  return (
    <>
      <PageHeader
        title="Trilha da aprovação"
        description="Matérias separadas como no edital. Em Direito, cada artigo vira etapa; a IA explica o que cada um significa no material de estudo."
        actions={
          trail ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSetupOpen(true)}>
                <MapIcon className="h-4 w-4" />
                Nova análise
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={analyze.isPending}
                onClick={() => {
                  trailWeekLessonStore.clearTrail(trail.id);
                  trailProgressService.clearTrail(trail.id);
                  approvalTrailService.clear();
                  qc.invalidateQueries({ queryKey: ["approval-trail"] });
                  qc.invalidateQueries({ queryKey: ["trail-week-lesson"] });
                  qc.invalidateQueries({ queryKey: ["trail-week-progress"] });
                  setAutoOpened(false);
                  toast.message("Trilha removida deste dispositivo.");
                }}
              >
                Limpar trilha
              </Button>
            </div>
          ) : undefined
        }
      />

      <Dialog
        open={setupOpen}
        onOpenChange={(open) => {
          if (analyze.isPending) return;
          setSetupOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar trilha</DialogTitle>
            <DialogDescription>
              Na primeira vez, defina sua rotina e envie o PDF do edital para montar as matérias e
              etapas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Horas por dia" htmlFor="h">
              <Input
                id="h"
                type="number"
                min={1}
                max={12}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 2)}
              />
            </Field>
            <Field label="Semanas alvo" htmlFor="w">
              <Input
                id="w"
                type="number"
                min={4}
                max={24}
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value) || 10)}
              />
            </Field>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center",
              drag ? "border-primary bg-primary/5" : "border-muted-foreground/30",
            )}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">PDF do edital (texto selecionável)</p>
            <p className="text-xs text-muted-foreground">
              Máx. {Math.round(EXAM_IMPORT_MAX_BYTES / (1024 * 1024))} MB · sem OCR
            </p>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              className="max-w-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            O PDF é processado no servidor (extração de texto). Só o texto vai para a IA — sem inventar
            matérias fora do edital.
          </p>

          <DialogFooter>
            <Button
              variant="highlight"
              disabled={!file || analyze.isPending}
              onClick={() => analyze.mutate()}
            >
              {analyze.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4" /> Analisar edital e criar plano
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!trail ? (
        <EmptyState
          title="Nenhuma trilha ainda"
          description="Na primeira visita o pop-up abre sozinho. Se fechou, use o botão abaixo."
          action={
            <Button variant="highlight" onClick={() => setSetupOpen(true)}>
              <MapIcon className="h-4 w-4" />
              Configurar trilha
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{trail.contestName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {trail.organ} · {trail.role} · {trail.board}
                  {trail.examDate ? ` · prova ${trail.examDate}` : ""}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{trail.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {trail.mocked && <Badge variant="secondary">Mock / demo</Badge>}
                <Badge variant="outline">{trail.fileName}</Badge>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progresso dos assuntos</span>
                <span>
                  {doneTopics}/{totalTopics} · {pct}%
                </span>
              </div>
              <Progress value={pct} />
            </div>
            {!!trail.warnings.length && (
              <ul className="mt-3 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
                {trail.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Collapsible
            open={materialExpanded}
            onOpenChange={(open) => setMaterialOpen(open)}
          >
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        !materialExpanded && "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <h2 className="text-base font-semibold">Material por matéria</h2>
                    {!materialExpanded ? (
                      <Badge variant="secondary" className="ml-1">
                        {trail.subjects.length} matérias
                        {pendingMaterialCount > 0
                          ? ` · ${pendingMaterialCount} pendente${pendingMaterialCount === 1 ? "" : "s"}`
                          : ""}
                      </Badge>
                    ) : null}
                  </button>
                </CollapsibleTrigger>
                <Button
                  size="sm"
                  disabled={materialBusy}
                  onClick={() => void runGenerateAll()}
                >
                  {batchRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Gerar todos
                </Button>
              </div>

              <CollapsibleContent className="data-[state=closed]:animate-none">
                <p className="mb-4 mt-4 text-sm text-muted-foreground">
                  Depois de <strong>Gerar material</strong>, a matéria vira um card. Clique nele para
                  abrir os itens explicados. Use <strong>+</strong> para incluir assuntos novos ou{" "}
                  <strong>Gerar todos</strong> para processar as matérias pendentes de uma vez.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {trail.subjects.map((s) => {
                    const explained = s.topics.filter((t) => !!t.explanation?.trim()).length;
                    const ready = explained > 0;
                    const generating =
                      genMaterial.isPending && materialSubjectId === s.id;
                    const doneCount = s.topics.filter((t) => t.status === "concluida").length;

                    if (ready) {
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setOpenSubjectId(s.id)}
                          className="group flex w-full flex-col rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:bg-primary/5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                              <h3 className="text-lg font-semibold leading-snug group-hover:text-primary">
                                {s.name}
                              </h3>
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Material pronto · clique para estudar os itens
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {s.questionCountHint != null && (
                              <Badge variant="outline">~{s.questionCountHint} questões</Badge>
                            )}
                            <Badge variant="secondary">{s.topics.length} itens</Badge>
                            <Badge variant="outline">
                              {explained}/{s.topics.length} explicados
                            </Badge>
                            {doneCount > 0 && (
                              <Badge variant="outline">{doneCount} concluídos</Badge>
                            )}
                          </div>
                        </button>
                      );
                    }

                    return (
                      <div key={s.id} className="rounded-xl border p-4 sm:col-span-2">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                            <h3 className="text-lg font-semibold">{s.name}</h3>
                            {s.questionCountHint != null && (
                              <Badge variant="outline">~{s.questionCountHint} questões</Badge>
                            )}
                            <Badge variant="secondary">{s.topics.length} etapas</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={materialBusy}
                              onClick={() => addCard(s.id)}
                              aria-label={`Adicionar card em ${s.name}`}
                              title="Adicionar card"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              disabled={materialBusy}
                              onClick={() => genMaterial.mutate(s.id)}
                            >
                              {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              Gerar material
                            </Button>
                          </div>
                        </div>
                        <SubjectTopicList
                          subject={s}
                          onRename={renameCard}
                          onRemove={removeCard}
                          onStatus={(topicId, status) =>
                            setStatus.mutate({ subjectId: s.id, topicId, status })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>

              <SubjectMaterialDialog
                subject={trail.subjects.find((s) => s.id === openSubjectId) ?? null}
                open={!!openSubjectId}
                generating={
                  materialBusy &&
                  (batchRunning || materialSubjectId === openSubjectId)
                }
                onOpenChange={(open) => {
                  if (!open) setOpenSubjectId(null);
                }}
                onAdd={() => {
                  if (openSubjectId) addCard(openSubjectId);
                }}
                onGenerate={() => {
                  if (openSubjectId && !materialBusy) genMaterial.mutate(openSubjectId);
                }}
                onRename={renameCard}
                onRemove={removeCard}
                onStatus={(subjectId, topicId, status) =>
                  setStatus.mutate({ subjectId, topicId, status })
                }
              />

              <Dialog
                open={batchOpen}
                onOpenChange={(open) => {
                  if (batchRunning) return;
                  setBatchOpen(open);
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {batchRunning ? "Gerando material…" : "Geração concluída"}
                    </DialogTitle>
                    <DialogDescription>
                      {batchRunning
                        ? "Processando as matérias pendentes uma a uma. Não feche esta janela."
                        : batchErrors.length
                          ? "Algumas matérias falharam; as demais foram geradas."
                          : "Todas as matérias pendentes foram processadas."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {(() => {
                      const stepsDone = batchRunning
                        ? Math.max(0, batchIndex - 1)
                        : batchTotal;
                      const pctBatch = batchTotal
                        ? Math.round((stepsDone / batchTotal) * 100)
                        : 0;
                      return (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {batchTotal
                                ? `${Math.min(batchIndex, batchTotal)} de ${batchTotal}`
                                : "—"}
                            </span>
                            <span className="font-medium">{pctBatch}%</span>
                          </div>
                          <Progress value={pctBatch} />
                        </>
                      );
                    })()}
                    {batchRunning && batchCurrent ? (
                      <p className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        <span className="truncate">{batchCurrent}</span>
                      </p>
                    ) : null}
                    {!batchRunning && batchDone > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {batchDone} matéria{batchDone === 1 ? "" : "s"} com material pronto.
                      </p>
                    ) : null}
                    {batchErrors.length > 0 ? (
                      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs text-destructive">
                        {batchErrors.map((e) => (
                          <li key={e.name}>
                            <span className="font-medium">{e.name}:</span> {e.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      disabled={batchRunning}
                      onClick={() => setBatchOpen(false)}
                    >
                      Fechar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          </Collapsible>

          {(trail.scheduleUnlocked ||
            trail.subjects.some((s) => s.topics.some((t) => !!t.explanation?.trim()))) &&
          trail.weeks.length > 0 ? (
            <>
            <TrailResumeCard />
            <Panel title="Cronograma por dia de estudo">
              <p className="mb-4 text-xs text-muted-foreground">
                Cada dia (~2h): em Português, 1 assunto; em Direito, vários artigos no mesmo dia.
                Módulos: Definição, Macete, Exemplo e questões + Prática. Progresso salvo neste
                dispositivo.
              </p>
              <div className="space-y-6">
                {groupSessionsByWeek(trail.weeks).map((group) => (
                  <div key={group.weekNumber}>
                    <h3 className="mb-2 text-sm font-semibold">
                      Semana {group.weekNumber}
                      {group.subject ? ` · ${group.subject}` : ""}
                    </h3>
                    <ol className="space-y-2">
                      {group.sessions.map((w) => {
                        const dayProgress = progressByWeek.get(w.week);
                        const status = dayProgress?.status ?? "pendente";
                        return (
                        <li key={w.week}>
                          <Link
                            to="/trilha/semana/$week"
                            params={{ week: String(w.week) }}
                            className={cn(
                              "group flex items-start gap-3 rounded-lg border p-3 text-sm transition hover:border-primary hover:bg-primary/5",
                              status === "concluida" && "border-emerald-500/40 bg-emerald-500/5",
                              status === "em-andamento" && "border-amber-500/40 bg-amber-500/5",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold group-hover:text-primary">
                                  {w.dayLabel ?? `Dia ${w.week}`}: {w.focus}
                                </p>
                                {status === "concluida" && (
                                  <Badge variant="secondary" className="gap-1 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Concluído
                                  </Badge>
                                )}
                                {status === "em-andamento" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Em andamento
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {Math.max(2, w.hoursSuggested)}h ·{" "}
                                {w.subjectNames.join(", ") || "—"}
                              </p>
                              {!!w.activities.length && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {w.activities.slice(0, 3).join(" · ")}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                          </Link>
                        </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </Panel>
            </>
          ) : (
            <Panel title="Cronograma por dia de estudo">
              <p className="text-sm text-muted-foreground">
                Ainda oculto. Defina os dias em Configurações e clique em{" "}
                <strong>Gerar material</strong> — a agenda monta Segunda, Terça… com uma etapa por
                dia.
              </p>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function SubjectTopicList({
  subject,
  onRename,
  onRemove,
  onStatus,
}: {
  subject: TrailSubject;
  onRename: (subjectId: string, topicId: string, name: string) => void;
  onRemove: (subjectId: string, topicId: string) => void;
  onStatus: (topicId: string, status: TrailPhaseStatus) => void;
}) {
  if (!subject.topics.length) {
    return <p className="text-xs text-muted-foreground">Sem etapas neste bloco.</p>;
  }

  return (
    <ul className="space-y-3">
      {subject.topics.map((t) => (
        <TopicItem
          key={t.id}
          topic={t}
          subjectId={subject.id}
          onRename={onRename}
          onRemove={onRemove}
          onStatus={onStatus}
        />
      ))}
    </ul>
  );
}

function TopicItem({
  topic: t,
  subjectId,
  onRename,
  onRemove,
  onStatus,
}: {
  topic: TrailTopic;
  subjectId: string;
  onRename: (subjectId: string, topicId: string, name: string) => void;
  onRemove: (subjectId: string, topicId: string) => void;
  onStatus: (topicId: string, status: TrailPhaseStatus) => void;
}) {
  return (
    <li className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {t.custom ? (
            <Input
              defaultValue={t.name}
              className="h-8 max-w-xl font-medium"
              placeholder="Ex.: Art. 312 ou Concordância verbal"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== t.name) onRename(subjectId, t.id, v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <p className="font-medium">
              {t.status === "concluida" && (
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
              )}
              {t.name}
            </p>
          )}
          {t.explanation ? (
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {t.explanation}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.custom
                ? "Card criado — ajuste o título e clique em Gerar material."
                : "Material ainda não gerado — use Gerar material nesta matéria."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {t.custom && <Badge variant="secondary">criado</Badge>}
          {t.kind === "artigo" && <Badge variant="outline">artigo</Badge>}
          {t.custom && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(subjectId, t.id)}
              aria-label="Remover card"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <NativeSelect
            className="h-8 w-[140px] text-xs"
            value={t.status}
            onChange={(e) => onStatus(t.id, e.target.value as TrailPhaseStatus)}
          >
            <option value="pendente">Pendente</option>
            <option value="em-andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
          </NativeSelect>
        </div>
      </div>
    </li>
  );
}

function SubjectMaterialDialog({
  subject,
  open,
  generating,
  onOpenChange,
  onAdd,
  onGenerate,
  onRename,
  onRemove,
  onStatus,
}: {
  subject: TrailSubject | null;
  open: boolean;
  generating: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onGenerate: () => void;
  onRename: (subjectId: string, topicId: string, name: string) => void;
  onRemove: (subjectId: string, topicId: string) => void;
  onStatus: (subjectId: string, topicId: string, status: TrailPhaseStatus) => void;
}) {
  if (!subject) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto" />
      </Dialog>
    );
  }

  const explained = subject.topics.filter((t) => !!t.explanation?.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            {subject.name}
          </DialogTitle>
          <DialogDescription>
            {explained}/{subject.topics.length} itens com material · marque o status conforme
            estudar
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onAdd} disabled={generating}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
          <Button size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Atualizar material
          </Button>
        </div>

        <SubjectTopicList
          subject={subject}
          onRename={onRename}
          onRemove={onRemove}
          onStatus={(topicId, status) => onStatus(subject.id, topicId, status)}
        />
      </DialogContent>
    </Dialog>
  );
}
