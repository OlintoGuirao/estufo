import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QuestCard } from "@/components/tjsp-quest/quest-shell";
import {
  ANSWER_COLORS,
  Confetti,
  GameButton,
  Mascot,
  gameSound,
} from "@/components/tjsp-quest/game-ui";
import { normalizeShop } from "@/lib/tjsp-quest/shop";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import type { QuestAltKey, QuestQuestion } from "@/types/tjsp-quest";
import { cn } from "@/lib/utils";

type Grade = (q: QuestQuestion, choice: string, streak: number) => { correct: boolean; xpAwarded: number };

type Props = {
  phaseId: string;
  questions: QuestQuestion[];
  mode: "desafio" | "chefao" | "revisao" | "diario";
  onFinish: (result: { correct: number; total: number; pct: number; xp: number }) => void;
  /** Correção própria (ex.: desafio do dia, com questões fora das fases). */
  grade?: Grade;
};

const PRAISE = ["Mandou bem!", "Isso aí!", "Arrasou!", "Na mosca!", "Show!"];
const ENCOURAGE = ["Quase!", "Faz parte!", "Bora de novo!", "Errar ensina!"];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]!;

const MODE_LABEL: Record<Props["mode"], { text: string; color: string }> = {
  desafio: { text: "Desafio", color: "#3a86ff" },
  chefao: { text: "👑 Chefão", color: "#ff006e" },
  revisao: { text: "Revisão", color: "#06a77d" },
  diario: { text: "🎡 Desafio do dia", color: "#fb8500" },
};

export function QuestQuiz({ phaseId, questions, mode, onFinish, grade }: Props) {
  const list = useMemo(() => questions, [questions]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [hiddenKeys, setHiddenKeys] = useState<QuestAltKey[]>([]);
  const [tipOpen, setTipOpen] = useState(false);
  const [shop, setShop] = useState(() => normalizeShop(tjspQuestStore.get().shop));
  const [confetti, setConfetti] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  const q = list[idx];
  const total = list.length;

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
    if (!res.ok) return void toast.error("Sem ajudas de eliminar — compre na Loja.");
    gameSound.tap();
    const wrong = q.alternatives.filter((a) => a.key !== q.correctKey).map((a) => a.key);
    const pickWrong = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHiddenKeys((prev) => Array.from(new Set([...prev, ...pickWrong])));
  };

  const useFifty = () => {
    if (locked) return;
    const res = tjspQuestStore.useHelp("fifty");
    bumpShop();
    if (!res.ok) return void toast.error("Sem 50/50 — compre na Loja.");
    gameSound.tap();
    const wrong = q.alternatives.filter((a) => a.key !== q.correctKey).map((a) => a.key);
    const keepWrong = wrong.sort(() => Math.random() - 0.5)[0];
    const hide = q.alternatives.map((a) => a.key).filter((k) => k !== q.correctKey && k !== keepWrong);
    setHiddenKeys(hide);
    if (draft && hide.includes(draft as QuestAltKey)) setDraft(null);
  };

  const useTip = () => {
    if (locked) return;
    const res = tjspQuestStore.useHelp("tip");
    bumpShop();
    if (!res.ok) return void toast.error("Sem dicas — compre na Loja.");
    gameSound.tap();
    setTipOpen(true);
  };

  const confirm = () => {
    if (!draft || locked) return;
    const { correct, xpAwarded } = grade
      ? grade(q, draft, streak)
      : tjspQuestStore.submitAnswer({
          phaseId,
          questionId: q.id,
          choice: draft,
          mode: mode === "diario" ? "desafio" : mode,
          streakCount: streak,
        });
    setLocked(true);
    setLastCorrect(correct);
    setLastXp(correct ? xpAwarded : 0);
    setResults((r) => [...r, correct]);
    if (correct) {
      const nextStreak = streak + 1;
      setCorrectCount((c) => c + 1);
      setXpTotal((x) => x + xpAwarded);
      setStreak(nextStreak);
      setFeedbackText(nextStreak >= 3 ? `Combo x${nextStreak}! 🔥` : pick(PRAISE));
      if (nextStreak >= 3) {
        gameSound.combo();
        setConfetti((n) => n + 1);
      } else {
        gameSound.correct();
      }
    } else {
      setStreak(0);
      setFeedbackText(pick(ENCOURAGE));
      setShakeKey((k) => k + 1);
      gameSound.wrong();
      if (!grade) {
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
    }
  };

  const retryWithLife = () => {
    const res = tjspQuestStore.useLife();
    bumpShop();
    if (!res.ok) return void toast.error("Sem vidas — compre na Loja.");
    gameSound.tap();
    setLocked(false);
    setLastCorrect(null);
    setDraft(null);
    setResults((r) => r.slice(0, -1));
  };

  const goNext = () => {
    gameSound.tap();
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

  const modeInfo = MODE_LABEL[mode];

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />

      {/* Placar: bolinhas de progresso + XP + combo + vidas */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          {list.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 flex-1 rounded-full transition-colors",
                i < results.length
                  ? results[i]
                    ? "bg-[#06d6a0]"
                    : "bg-[#ff4d6d]"
                  : i === idx
                    ? "bg-white"
                    : "bg-white/35",
              )}
            />
          ))}
        </div>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-sm font-extrabold text-[#ffd166]">
          ⭐ {xpTotal}
        </span>
        {streak >= 2 && (
          <span className="q-pop rounded-full bg-[#ff5400] px-2.5 py-1 text-sm font-extrabold text-white">
            🔥x{streak}
          </span>
        )}
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-sm font-extrabold text-white">
          ❤️ {shop.lives}
        </span>
      </div>

      <div key={shakeKey} className={cn(shakeKey > 0 && lastCorrect === false && "q-shake")}>
        <QuestCard className="relative overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white"
              style={{ background: modeInfo.color }}
            >
              {modeInfo.text}
            </span>
            <span className="text-xs font-extrabold text-[#8d99ae]">
              Pergunta {idx + 1} de {total}
            </span>
          </div>

          <p className="whitespace-pre-line font-sans text-[17px] font-semibold leading-relaxed text-[#2b2d42]">
            {q.statement}
          </p>

          {tipOpen && (
            <p className="q-pop mt-3 rounded-2xl bg-[#fff3c4] px-3 py-2 text-sm font-bold text-[#7a5c00]">
              💡 {q.memoryTip || q.legalBasis || "Leia com calma e elimine as extremas."}
            </p>
          )}

          <div className="mt-5 space-y-3">
            {visibleAlts.map((alt) => {
              const color = ANSWER_COLORS[alt.key] ?? ANSWER_COLORS["A"]!;
              const selected = draft === alt.key;
              const isRight = locked && alt.key === q.correctKey;
              const isWrong = locked && selected && alt.key !== q.correctKey;
              const dim = locked && !isRight && !isWrong;
              return (
                <button
                  key={alt.key}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    gameSound.tap();
                    setDraft(alt.key);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-[3px] bg-white px-3 py-3 text-left transition-all active:translate-y-[3px]",
                    dim && "opacity-45",
                    isRight && "q-pop",
                  )}
                  style={{
                    borderColor: isRight ? "#06d6a0" : isWrong ? "#ff4d6d" : selected ? color.bg : "#e9ecef",
                    background: isRight ? "#e6fff6" : isWrong ? "#ffe8ec" : selected ? `${color.bg}14` : "#fff",
                    boxShadow: `0 4px 0 ${isRight ? "#04a37a" : isWrong ? "#c9184a" : selected ? color.shadow : "#dee2e6"}`,
                  }}
                >
                  <span
                    className="font-game flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white"
                    style={{
                      background: isRight ? "#06d6a0" : isWrong ? "#ff4d6d" : color.bg,
                      boxShadow: `0 3px 0 ${isRight ? "#04a37a" : isWrong ? "#c9184a" : color.shadow}`,
                    }}
                  >
                    {isRight ? "✓" : isWrong ? "✗" : alt.key}
                  </span>
                  <span className="font-sans text-[15px] font-semibold leading-snug text-[#2b2d42]">
                    {alt.text}
                  </span>
                </button>
              );
            })}
          </div>

          {!locked && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <HelpBubble emoji="✂️" label="Eliminar 2" count={shop.helps.eliminate} onClick={useEliminate} />
              <HelpBubble emoji="🎯" label="50/50" count={shop.helps.fifty} onClick={useFifty} />
              <HelpBubble emoji="💡" label="Dica" count={shop.helps.tip} onClick={useTip} />
            </div>
          )}

          {!locked && (
            <GameButton
              className="mt-5"
              color="#ff5d8f"
              shadow="#c4325f"
              disabled={!draft}
              onClick={confirm}
            >
              Confirmar
            </GameButton>
          )}
        </QuestCard>
      </div>

      {/* Feedback que sobe de baixo, com o mascote reagindo */}
      {locked && (
        <div
          className={cn(
            "q-slide-up rounded-[28px] p-4 text-white shadow-[0_8px_0_rgba(0,0,0,.18)]",
            lastCorrect ? "bg-[#06a77d]" : "bg-[#e63962]",
          )}
        >
          <div className="flex items-center gap-3">
            <Mascot mood={lastCorrect ? "cheer" : "sad"} size={64} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-tight">{feedbackText}</p>
              {lastCorrect ? (
                <p className="q-pop text-lg font-extrabold text-[#ffd166]">+{lastXp} XP · +{lastXp} 🪙</p>
              ) : (
                <p className="text-sm font-bold text-white/90">Resposta certa: {q.correctKey}</p>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1.5 rounded-2xl bg-black/15 p-3 font-sans text-[14px] leading-relaxed">
            <p>{q.whyCorrect}</p>
            {!lastCorrect && draft && q.whyWrong[draft as QuestAltKey] && (
              <p className="opacity-95">Sobre a sua escolha: {q.whyWrong[draft as QuestAltKey]}</p>
            )}
            {q.legalBasis && <p className="text-xs font-bold opacity-85">📖 {q.legalBasis}</p>}
            {q.memoryTip && <p className="text-xs italic opacity-85">💡 {q.memoryTip}</p>}
          </div>

          <div className="mt-4 space-y-3">
            {!lastCorrect && shop.lives > 0 && (
              <GameButton color="#ffffff" shadow="#d0d4dc" className="!text-[#e63962]" onClick={retryWithLife} size="md">
                ❤️ Usar vida e tentar de novo ({shop.lives})
              </GameButton>
            )}
            <GameButton
              color="#ffbe0b"
              shadow="#c48f00"
              onClick={() => (idx + 1 >= total ? finishFromLast() : goNext())}
            >
              {idx + 1 >= total ? "Ver resultado 🏁" : "Próxima ➜"}
            </GameButton>
          </div>
        </div>
      )}
    </div>
  );
}

function HelpBubble({
  emoji,
  label,
  count,
  onClick,
}: {
  emoji: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count <= 0}
      className="relative flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-[#f1f3f9] text-xl shadow-[0_4px_0_#d5d9e6] transition-transform active:translate-y-1 disabled:opacity-40"
      title={count > 0 ? label : `${label} — compre na Loja`}
      aria-label={`${label} (${count})`}
    >
      {emoji}
      <span className="font-game text-[10px] font-extrabold text-[#5c677d]">{label}</span>
      <span className="font-game absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8338ec] px-1 text-[11px] font-extrabold text-white">
        {count}
      </span>
    </button>
  );
}
