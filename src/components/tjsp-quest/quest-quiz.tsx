import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestCard } from "@/components/tjsp-quest/quest-shell";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import type { QuestAltKey, QuestQuestion } from "@/types/tjsp-quest";
import { cn } from "@/lib/utils";

type Props = {
  phaseId: string;
  questions: QuestQuestion[];
  mode: "desafio" | "chefao" | "revisao";
  onFinish: (result: { correct: number; total: number; pct: number; xp: number }) => void;
};

export function QuestQuiz({ phaseId, questions, mode, onFinish }: Props) {
  const list = useMemo(() => questions, [questions]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  const q = list[idx];
  const total = list.length;
  const progressPct = Math.round(((idx + (locked ? 1 : 0)) / total) * 100);

  if (!q) {
    return (
      <QuestCard>
        <p className="text-sm text-muted-foreground">Sem questões neste modo.</p>
      </QuestCard>
    );
  }

  const confirm = () => {
    if (!draft || locked) return;
    const { correct, xpAwarded } = tjspQuestStore.submitAnswer({
      phaseId,
      questionId: q.id,
      choice: draft,
      mode,
      streakCount: streak,
    });
    setLocked(true);
    setLastCorrect(correct);
    if (correct) {
      setCorrectCount((c) => c + 1);
      setXpTotal((x) => x + xpAwarded);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      // Liga ao caderno de erros (snapshot)
      void import("@/services")
        .then(({ errorNotesService }) =>
          errorNotesService.save({
            questionId: q.id,
            reasonCode: "nao-sabia",
            origin: "quest",
            snapshot: true,
            subject: q.legalBasis?.slice(0, 80) || "TJSP Quest",
            topic: q.legalBasis || phaseId,
            statement: q.statement,
            yourKey: draft,
            correctKey: q.correctKey,
            explanation: q.whyCorrect,
            sourceLabel: `Quest · ${mode}`,
          }),
        )
        .catch(() => undefined);
    }
  };

  const goNext = () => {
    setIdx((i) => i + 1);
    setDraft(null);
    setLocked(false);
    setLastCorrect(null);
  };

  const finishFromLast = () => {
    const pct = Math.round((correctCount / total) * 100);
    onFinish({ correct: correctCount, total, pct, xp: xpTotal });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-white">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-[#ff9f1c] transition-all"
            style={{ width: `${Math.max(6, progressPct)}%` }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums">
          {idx + 1}/{total}
        </span>
        <span className="rounded-full bg-white/15 px-2 py-1 text-xs font-bold text-[#ff9f1c]">
          +{xpTotal} XP
        </span>
      </div>

      <QuestCard>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#e85d04]">
          {mode === "chefao" ? "Chefão" : mode === "revisao" ? "Revisão" : "Desafio"} · Padrão
          VUNESP · treino IA
          {q.boardStyle === "VUNESP" ? " · A–E" : ""}
        </p>
        <p className="font-serif text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {q.statement}
        </p>

        <div className="mt-5 space-y-2.5">
          {q.alternatives.map((alt) => {
            const selected = draft === alt.key;
            const isCorrect = locked && alt.key === q.correctKey;
            const isWrong = locked && selected && alt.key !== q.correctKey;
            return (
              <button
                key={alt.key}
                type="button"
                disabled={locked}
                onClick={() => setDraft(alt.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all",
                  "border-transparent bg-[#f4f1ea] hover:bg-[#ebe6db]",
                  selected && !locked && "border-[#0077b6] bg-[#0077b6]/10 ring-2 ring-[#0077b6]/25",
                  isCorrect && "border-emerald-500 bg-emerald-50",
                  isWrong && "border-rose-500 bg-rose-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white",
                    isWrong ? "bg-rose-500" : isCorrect ? "bg-emerald-600" : "bg-[#0b132b]",
                  )}
                >
                  {alt.key}
                </span>
                <span className="text-sm font-medium leading-snug">{alt.text}</span>
              </button>
            );
          })}
        </div>

        {!locked ? (
          <Button
            className="mt-5 h-12 w-full rounded-2xl bg-[#e85d04] text-base font-bold text-white hover:bg-[#d00000]"
            disabled={!draft}
            onClick={confirm}
          >
            Confirmar
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            <div
              className={cn(
                "flex items-start gap-2 rounded-2xl p-3 text-sm",
                lastCorrect ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900",
              )}
            >
              {lastCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-bold">{lastCorrect ? "Acertou!" : "Errou."}</p>
                <p className="mt-1 text-[13px] leading-relaxed">{q.whyCorrect}</p>
                {!lastCorrect && draft && q.whyWrong[draft as QuestAltKey] && (
                  <p className="mt-1 text-[13px] leading-relaxed opacity-90">
                    Sobre a sua escolha: {q.whyWrong[draft as QuestAltKey]}
                  </p>
                )}
                <p className="mt-2 text-xs font-semibold opacity-80">Base: {q.legalBasis}</p>
                {q.memoryTip && (
                  <p className="mt-1 text-xs italic opacity-80">Dica: {q.memoryTip}</p>
                )}
              </div>
            </div>
            <Button
              className="h-12 w-full rounded-2xl bg-[#0b132b] text-base font-bold text-white hover:bg-[#1c2541]"
              onClick={() => {
                if (idx + 1 >= total) finishFromLast();
                else goNext();
              }}
            >
              {idx + 1 >= total ? "Ver resultado" : "Próxima"}
            </Button>
          </div>
        )}
      </QuestCard>
    </div>
  );
}
