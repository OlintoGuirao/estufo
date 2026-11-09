import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { ScratchPad } from "@/components/scratch-pad";
import { SupportTextPanel } from "@/components/exam/support-text-panel";
import { formatQuestionText, splitSupportText } from "@/lib/official-question-clean";
import { examsService } from "@/services";
import { cn } from "@/lib/utils";

const HIDE_TIMER_KEY = "estufoo.simulado.hide-timer";

export const Route = createFileRoute("/_area/simulados/$id/")({
  head: () => ({
    meta: [
      { title: "Simulado em andamento — Estufoo" },
      { name: "description", content: "Resolva o simulado cronometrado com questões de prova." },
    ],
  }),
  component: TakeExam,
});

function TakeExam() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exam", id], queryFn: () => examsService.get(id) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  // Esconder o cronômetro (alguns alunos ficam ansiosos vendo o tempo). Fica lembrado.
  const [hideTimer, setHideTimer] = useState(() => {
    try {
      return localStorage.getItem(HIDE_TIMER_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleTimer = () =>
    setHideTimer((v) => {
      try {
        localStorage.setItem(HIDE_TIMER_KEY, v ? "0" : "1");
      } catch {
        /* sem storage: vale só nesta tela */
      }
      return !v;
    });
  const sent = useRef(false);
  // Centraliza o nº da questão atual na faixa — só rola a FAIXA (para o lado),
  // nunca a página. (Antes um scrollIntoView rodava a cada segundo do cronômetro
  // e jogava o aluno de volta ao topo no celular/tablet.)
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [idx, started]);
  const submit = useMutation({
    mutationFn: () => examsService.submit(id, { answers, timeUsedSec: elapsed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["error-notes"] });
      qc.invalidateQueries({ queryKey: ["performance"] });
      nav({ to: "/simulados/$id/resultado", params: { id } });
    },
  });

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const limit = (q.data?.timeLimitMin ?? 0) * 60;
  useEffect(() => {
    if (!started || !q.data) return;
    if (elapsed >= limit && !sent.current) {
      sent.current = true;
      submit.mutate();
    }
  }, [elapsed, limit, q.data, started, submit]);

  if (q.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const exam = q.data!;
  const cur = exam.questions[idx];
  const parts = cur ? splitSupportText(cur.statement) : null;
  const left = Math.max(0, limit - elapsed);
  const warn = left < 300;
  const critical = left < 60;

  if (!started) {
    return (
      <>
        <PageHeader title={exam.title} />
        <Panel className="mx-auto max-w-lg space-y-4 text-center">
          <Badge variant="secondary">Questões de prova (banco TJSP) · sem IA</Badge>
          <p className="text-sm text-muted-foreground">
            {exam.questionCount} questões · tempo limite{" "}
            <strong className="text-foreground">{exam.timeLimitMin} min</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            O cronômetro começa ao clicar em Iniciar. Ao zerar, o simulado é enviado
            automaticamente. Durante a prova você só marca as respostas — o gabarito e o
            balancete por matéria aparecem só no final.
          </p>
          <Button
            className="h-12 w-full"
            onClick={() => {
              setStarted(true);
              setElapsed(0);
            }}
          >
            <Timer className="h-4 w-4" /> Iniciar cronômetro
          </Button>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={exam.title}
        actions={
          <div className="flex items-center gap-1.5">
            {hideTimer && !critical ? (
              <span
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground",
                  warn && "border-amber-500 text-amber-700 dark:text-amber-300",
                )}
              >
                <Timer className="h-4 w-4" />
                {warn ? "Menos de 5 min!" : "Tempo oculto"}
              </span>
            ) : (
              <span
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 font-mono text-sm tabular-nums",
                  warn && "border-amber-500 text-amber-700 dark:text-amber-300",
                  critical && "border-destructive text-destructive animate-pulse",
                )}
                aria-live="polite"
              >
                <Timer className="h-4 w-4" />
                {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
                <span className="text-xs text-muted-foreground">
                  / {exam.timeLimitMin} min
                </span>
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTimer}
              aria-label={hideTimer ? "Mostrar cronômetro" : "Ocultar cronômetro"}
              title={hideTimer ? "Mostrar cronômetro" : "Ocultar cronômetro"}
            >
              {hideTimer ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      <p className="mb-3 text-xs text-muted-foreground">
        Sem feedback na hora · gabarito e balancete só ao finalizar · erros vão ao caderno
      </p>
      {/* Celular: faixa rolável (não empurra a questão para baixo). Tela grande: grade. */}
      <div ref={stripRef} className="relative -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {exam.questions.map((x, i) => (
          <button
            key={x.id}
            data-idx={i}
            type="button"
            onClick={() => setIdx(i)}
            className={cn(
              "h-8 w-8 shrink-0 rounded-md border text-xs",
              answers[x.id] && "bg-accent",
              i === idx && "border-primary ring-1 ring-primary",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {cur && parts && (
        <div className={cn(parts.passage && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6")}>
          {parts.passage && (
            <SupportTextPanel key={parts.label} label={parts.label!} passage={parts.passage} className="mb-4 lg:mb-0" />
          )}
        <Panel>
          <p className="text-xs text-muted-foreground">
            Questão {idx + 1} de {exam.questions.length} · {cur.subject}
            {cur.board ? ` · ${cur.board}` : ""}
            {cur.year ? ` ${cur.year}` : ""}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-base font-medium leading-relaxed">
            {formatQuestionText(parts.question)}
          </p>
          <div className="mt-4 space-y-2">
            {cur.alternatives.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAnswers({ ...answers, [cur.id]: a.key })}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm leading-relaxed transition-colors hover:bg-accent",
                  answers[cur.id] === a.key && "border-primary bg-accent ring-1 ring-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    answers[cur.id] === a.key && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {a.key}
                </span>
                <span className="pt-0.5">{a.text}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              Anterior
            </Button>
            {idx < exam.questions.length - 1 ? (
              <Button onClick={() => setIdx(idx + 1)}>Próxima</Button>
            ) : (
              <Button
                variant="highlight"
                disabled={submit.isPending}
                onClick={() => {
                  sent.current = true;
                  submit.mutate();
                }}
              >
                Finalizar simulado
              </Button>
            )}
          </div>
        </Panel>
        </div>
      )}
      <div className="mt-6 border-t pt-6">
        {/* Um rascunho por simulado — não limpa ao trocar de questão. */}
        <ScratchPad resetKey={id} />
      </div>
    </>
  );
}
