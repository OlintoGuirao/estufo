import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Panel } from "@/components/common";
import type { MindPracticeQuestion } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  questions: MindPracticeQuestion[];
};

export function PracticeQuestionReview({ questions }: Props) {
  const list = useMemo(() => questions, [questions]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const q = list[idx];
  const total = list.length;

  if (!total) {
    return (
      <EmptyState
        title="Nenhuma questão"
        description="Gere o mapa de novo: a IA cria questões objetivas a partir do seu material."
      />
    );
  }

  if (done) {
    const pct = Math.round((correctCount / total) * 100);
    return (
      <Panel className="space-y-3 text-center">
        <p className="font-semibold">Treino concluído</p>
        <p className="text-sm text-muted-foreground">
          {correctCount}/{total} acertos ({pct}%)
        </p>
        <p className="text-xs text-muted-foreground">
          Questões de treino geradas por IA — não são itens oficiais de banca.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setIdx(0);
            setDraft(null);
            setLocked(false);
            setCorrectCount(0);
            setDone(false);
          }}
        >
          <RotateCcw className="h-4 w-4" /> Treinar de novo
        </Button>
      </Panel>
    );
  }

  if (!q) return null;

  const confirm = () => {
    if (!draft || locked) return;
    const ok = draft.toUpperCase() === q.correctKey.toUpperCase();
    setLocked(true);
    if (ok) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (idx + 1 >= total) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setDraft(null);
    setLocked(false);
  };

  const isCorrect = locked && draft?.toUpperCase() === q.correctKey.toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {idx + 1}/{total}
        </Badge>
        <Badge variant="secondary">{q.topic}</Badge>
        <Badge variant="outline">IA · treino</Badge>
      </div>

      <Panel className="space-y-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.statement}</p>

        <div className="space-y-2">
          {q.alternatives.map((a) => {
            const selected = draft === a.key;
            const showAnswer = locked;
            const isRight = a.key === q.correctKey;
            return (
              <button
                key={a.key}
                type="button"
                disabled={locked}
                onClick={() => setDraft(a.key)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selected && !showAnswer && "border-primary bg-primary/5",
                  showAnswer && isRight && "border-emerald-600 bg-emerald-50",
                  showAnswer && selected && !isRight && "border-destructive bg-destructive/5",
                  !selected && !showAnswer && "hover:bg-muted/50",
                )}
              >
                <span className="font-semibold tabular-nums">{a.key})</span>
                <span className="flex-1">{a.text}</span>
              </button>
            );
          })}
        </div>

        {locked && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              isCorrect
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-900"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <p className="flex items-center gap-1.5 font-medium">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Correto
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" /> Incorreto — gabarito: {q.correctKey}
                </>
              )}
            </p>
            {!!q.explanation && (
              <p className="mt-1.5 text-xs leading-relaxed opacity-90">{q.explanation}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!locked ? (
            <Button onClick={confirm} disabled={!draft}>
              Confirmar
            </Button>
          ) : (
            <Button onClick={next}>{idx + 1 >= total ? "Ver resultado" : "Próxima"}</Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
