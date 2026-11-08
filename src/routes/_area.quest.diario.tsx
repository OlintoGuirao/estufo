import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { QuestQuiz } from "@/components/tjsp-quest/quest-quiz";
import {
  Confetti,
  GameButton,
  GameHud,
  GameLinkButton,
  Mascot,
  MascotSays,
  Stars,
  gameSound,
  starsFromPct,
} from "@/components/tjsp-quest/game-ui";
import {
  buildDailyQuestions,
  DAILY_REWARD,
  DAILY_SIZE,
  DAILY_WHEEL,
  dailyReward,
  todayKey,
  type WheelSlice,
} from "@/lib/tjsp-quest/daily";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import type { QuestQuestion } from "@/types/tjsp-quest";

export const Route = createFileRoute("/_area/quest/diario")({
  head: () => ({ meta: [{ title: "Desafio do dia — TJSP Quest" }] }),
  component: DailyChallenge,
});

type Stage = "wheel" | "loading" | "play" | "done";

function DailyChallenge() {
  const [player, refresh] = useTjspQuest();
  const date = todayKey();
  const alreadyDone = player.daily?.date === date && player.daily.done;

  const [stage, setStage] = useState<Stage>(alreadyDone ? "done" : "wheel");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [slice, setSlice] = useState<WheelSlice | null>(null);
  const [questions, setQuestions] = useState<QuestQuestion[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; reward: number } | null>(null);
  const [fire, setFire] = useState(0);

  useEffect(() => {
    if (alreadyDone) setStage("done");
  }, [alreadyDone]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    gameSound.spin();
    const n = DAILY_WHEEL.length;
    const index = Math.floor(Math.random() * n);
    const per = 360 / n;
    // Ponteiro fica no topo: gira até o centro da fatia sorteada parar lá.
    const target = 360 * 6 + (360 - (index * per + per / 2));
    setRotation((r) => r - (r % 360) + target);
    window.setTimeout(() => {
      const chosen = DAILY_WHEEL[index]!;
      setSlice(chosen);
      setSpinning(false);
      gameSound.coin();
    }, 4200);
  };

  const play = async () => {
    if (!slice) return;
    setStage("loading");
    const qs = await buildDailyQuestions(slice, date);
    setQuestions(qs);
    setStage("play");
  };

  const finish = ({ correct, total }: { correct: number; total: number }) => {
    const reward = dailyReward(correct, total);
    tjspQuestStore.finishDaily({ date, subjectId: slice?.id ?? "?", correct, total, reward });
    refresh();
    setResult({ correct, total, reward });
    setStage("done");
    if (correct >= Math.ceil(total * 0.6)) {
      gameSound.win();
      setFire((n) => n + 1);
    }
  };

  const summary = result ?? (player.daily && player.daily.date === date
    ? { correct: player.daily.correct, total: player.daily.total, reward: player.daily.coinsAwarded }
    : null);

  return (
    <QuestShell
      backTo="/quest"
      {...(slice ? { world: slice.id } : {})}
      top={<GameHud player={player} />}
      title={stage === "play" ? `${slice?.emoji ?? ""} ${slice?.label ?? ""}` : "Desafio do dia"}
    >
      <Confetti fire={fire} pieces={90} />

      {stage === "wheel" && (
        <div className="flex flex-col items-center">
          <MascotSays mood="wave" className="mb-4">
            Gire a roleta! {DAILY_SIZE} questões <b>reais</b> de prova do TJSP, com moedas de bônus.
          </MascotSays>
          <Wheel rotation={rotation} spinning={spinning} />
          <div className="mt-6 w-full max-w-sm space-y-4">
            {!slice ? (
              <GameButton onClick={spin} disabled={spinning} color="#ff006e" shadow="#b3004d">
                {spinning ? "Girando…" : "Girar roleta 🎡"}
              </GameButton>
            ) : (
              <>
                <div
                  className="q-pop rounded-3xl p-4 text-center text-white shadow-[0_6px_0_rgba(0,0,0,.2)]"
                  style={{ background: slice.color }}
                >
                  <p className="text-5xl">{slice.emoji}</p>
                  <p className="text-2xl font-extrabold">{slice.label}</p>
                  <p className="text-sm font-bold text-white/90">
                    Até {DAILY_SIZE * DAILY_REWARD.perCorrect + DAILY_REWARD.perfectBonus} 🪙 se gabaritar!
                  </p>
                </div>
                <GameButton onClick={() => void play()} color="#06d6a0" shadow="#04a37a">
                  Jogar ➜
                </GameButton>
              </>
            )}
          </div>
        </div>
      )}

      {stage === "loading" && (
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff006e]" />
          <p className="font-extrabold">Separando as questões de hoje…</p>
        </QuestCard>
      )}

      {stage === "play" &&
        (questions.length ? (
          <QuestQuiz
            phaseId="daily"
            mode="diario"
            questions={questions}
            grade={(q, choice) => {
              const correct = q.correctKey === choice.toUpperCase();
              return { correct, xpAwarded: correct ? DAILY_REWARD.perCorrect : 0 };
            }}
            onFinish={finish}
          />
        ) : (
          <QuestCard>Sem questões desta matéria hoje. Volte e gire de novo.</QuestCard>
        ))}

      {stage === "done" && summary && (
        <div className="flex flex-col items-center text-center text-white">
          <h2 className="q-pop text-4xl font-extrabold" style={{ textShadow: "0 4px 0 rgba(0,0,0,.2)" }}>
            {summary.correct === summary.total ? "Gabaritou! 🏆" : "Desafio feito!"}
          </h2>
          <Stars
            count={starsFromPct(Math.round((summary.correct / Math.max(1, summary.total)) * 100))}
            size={42}
            className="mt-3"
            animate
          />
          <Mascot mood={summary.correct >= 3 ? "cheer" : "happy"} size={100} className="mt-2" />
          <QuestCard className="mt-2 w-full max-w-sm">
            <p className="text-5xl font-extrabold">
              {summary.correct}/{summary.total}
            </p>
            <p className="mt-2 text-xl font-extrabold text-[#c9184a]">+{summary.reward} 🪙 · +{summary.reward} ⭐</p>
            <p className="mt-2 text-sm font-bold text-[#5c677d]">
              Volte amanhã para uma nova roleta — <NextReset />.
            </p>
          </QuestCard>
          <div className="mt-5 w-full max-w-sm">
            <GameLinkButton to="/quest" color="#3a86ff" shadow="#2459b3">
              Voltar ao mapa 🗺️
            </GameLinkButton>
          </div>
        </div>
      )}
    </QuestShell>
  );
}

/** Roleta em SVG: uma fatia por matéria; o ponteiro fica no topo. */
function Wheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const n = DAILY_WHEEL.length;
  const r = 140;
  const per = (2 * Math.PI) / n;
  const slices = useMemo(
    () =>
      DAILY_WHEEL.map((s, i) => {
        const a0 = i * per - Math.PI / 2;
        const a1 = a0 + per;
        const x0 = r + r * Math.cos(a0);
        const y0 = r + r * Math.sin(a0);
        const x1 = r + r * Math.cos(a1);
        const y1 = r + r * Math.sin(a1);
        const mid = a0 + per / 2;
        return {
          s,
          d: `M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`,
          tx: r + r * 0.66 * Math.cos(mid),
          ty: r + r * 0.66 * Math.sin(mid),
          rot: (mid * 180) / Math.PI + 90,
        };
      }),
    [n, per],
  );
  return (
    <div className="relative">
      <div className="absolute left-1/2 top-[-14px] z-10 -translate-x-1/2">
        <svg width="40" height="44" viewBox="0 0 40 44">
          <path d="M20 42 L4 8 Q20 -6 36 8 Z" fill="#fff" stroke="#2b2d42" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="rounded-full bg-white p-3 shadow-[0_10px_0_rgba(0,0,0,.2)]">
        <svg
          width={2 * r}
          height={2 * r}
          viewBox={`0 0 ${2 * r} ${2 * r}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(.12,.75,.15,1)" : "none",
          }}
        >
          {slices.map(({ s, d, tx, ty, rot }) => (
            <g key={s.id}>
              <path d={d} fill={s.color} stroke="#fff" strokeWidth="3" />
              <text
                x={tx}
                y={ty}
                transform={`rotate(${rot} ${tx} ${ty})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="26"
              >
                {s.emoji}
              </text>
            </g>
          ))}
          <circle cx={r} cy={r} r="26" fill="#fff" stroke="#2b2d42" strokeWidth="4" />
          <text x={r} y={r} textAnchor="middle" dominantBaseline="central" fontSize="22">
            ⚖️
          </text>
        </svg>
      </div>
    </div>
  );
}

function NextReset() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end.getTime() - now) / 60_000));
  return (
    <span>
      faltam {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}
    </span>
  );
}
