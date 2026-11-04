import { useMemo, useState } from "react";
import { CheckCircle2, Heart, Lightbulb, Scissors, Target, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuestCard } from "@/components/tjsp-quest/quest-shell";
import { normalizeShop } from "@/lib/tjsp-quest/shop";
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
  const [hiddenKeys, setHiddenKeys] = useState<QuestAltKey[]>([]);
  const [tipOpen, setTipOpen] = useState(false);
  const [shop, setShop] = useState(() => normalizeShop(tjspQuestStore.get().shop));

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

  const visibleAlts = q.alternatives.filter((a) => !hiddenKeys.includes(a.key));

  const bumpShop = () => setShop(normalizeShop(tjspQuestStore.get().shop));

  const useEliminate = () => {
    if (locked) return;
    const res = tjspQuestStore.useHelp("eliminate");
    bumpShop();
    if (!res.ok) {
      toast.error("Sem ajudas de eliminar — compre na Loja.");
      return;
    }
    const wrong = q.alternatives.filter((a) => a.key !== q.correctKey).map((a) => a.key);
    const pick = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHiddenKeys((prev) => Array.from(new Set([...prev, ...pick])));
    toast.message("2 alternativas incorretas removidas.");
  };

  const useFifty = () => {
    if (locked) return;
    const res = tjspQuestStore.useHelp("fifty");
    bumpShop();
    if (!res.ok) {
      toast.error("Sem 50/50 — compre na Loja.");
      return;
    }
    const wrong = q.alternatives.filter((a) => a.key !== q.correctKey).map((a) => a.key);
    const keepWrong = wrong.sort(() => Math.random() - 0.5)[0];
    const hide = q.alternatives
      .map((a) => a.key)
      .filter((k) => k !== q.correctKey && k !== keepWrong);
    setHiddenKeys(hide);
    if (draft && hide.includes(draft as QuestAltKey)) setDraft(null);
    toast.message("50/50 ativado.");
  };

  const useTip = () => {
    if (locked) return;
    const res = tjspQuestStore.useHelp("tip");
    bumpShop();
    if (!res.ok) {
      toast.error("Sem dicas — compre na Loja.");
      return;
    }
    setTipOpen(true);
    toast.message("Dica revelada.");
  };

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

  const retryWithLife = () => {
    const res = tjspQuestStore.useLife();
    bumpShop();
    if (!res.ok) {
      toast.error("Sem vidas — compre na Loja.");
      return;
    }
    setLocked(false);
    setLastCorrect(null);
    setDraft(null);
    toast.message("Vida usada — tente de novo!");
  };

  const goNext = () => {
    setIdx((i) => i + 1);
    setDraft(null);
    setLocked(false);
    setLastCorrect(null);
    setHiddenKeys([]);
    setTipOpen(false);
  };

  const finishFromLast = () => {
    const pct = Math.round((correctCount / total) * 100);
    onFinish({ correct: correctCount, total, pct, xp: xpTotal });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-white">
        <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-white/15">
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
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 px-2 py-1 text-xs font-bold text-rose-100">
          <Heart className="h-3.5 w-3.5 fill-current" />
          {shop.lives}
        </span>
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
            disabled={shop.helps.eliminate <= 0}
            onClick={useEliminate}
          >
            <Scissors className="h-3.5 w-3.5" />
            Eliminar ({shop.helps.eliminate})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
            disabled={shop.helps.fifty <= 0}
            onClick={useFifty}
          >
            <Target className="h-3.5 w-3.5" />
            50/50 ({shop.helps.fifty})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
            disabled={shop.helps.tip <= 0}
            onClick={useTip}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Dica ({shop.helps.tip})
          </Button>
        </div>
      )}

      <QuestCard>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#e85d04]">
          {mode === "chefao" ? "Chefão" : mode === "revisao" ? "Revisão" : "Desafio"} · Padrão
          VUNESP · treino IA
          {q.boardStyle === "VUNESP" ? " · A–E" : ""}
        </p>
        <p className="font-serif text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {q.statement}
        </p>

        {tipOpen && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            💡 {q.memoryTip || q.legalBasis || "Leia o enunciado com calma e elimine extremos."}
          </p>
        )}

        <div className="mt-5 space-y-2.5">
          {visibleAlts.map((alt) => {
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
            {!lastCorrect && shop.lives > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-2xl border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={retryWithLife}
              >
                <Heart className="h-4 w-4 fill-current" />
                Usar vida e tentar de novo ({shop.lives})
              </Button>
            )}
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
