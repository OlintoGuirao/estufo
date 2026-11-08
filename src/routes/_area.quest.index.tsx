import { createFileRoute, Link } from "@tanstack/react-router";
import { QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  GameHud,
  GameLinkButton,
  MascotSays,
  Stars,
  starsFromPct,
  worldTheme,
} from "@/components/tjsp-quest/game-ui";
import { tjspQuestCatalog } from "@/data/tjsp-quest-catalog";
import { dueReviews, levelProgress } from "@/lib/tjsp-quest/progress";
import { DAILY_REWARD, DAILY_SIZE, todayKey } from "@/lib/tjsp-quest/daily";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import type { QuestPhaseProgress } from "@/types/tjsp-quest";

export const Route = createFileRoute("/_area/quest/")({
  head: () => ({
    meta: [
      { title: "TJSP Quest — Estufoo" },
      {
        name: "description",
        content: "Estude para o TJSP jogando: mundos por matéria, roleta diária e chefões.",
      },
    ],
  }),
  component: QuestHome,
});

function bestPct(prog: QuestPhaseProgress | undefined): number {
  if (!prog) return 0;
  return Math.max(prog.chefaoBestPct ?? 0, prog.desafioBestPct ?? 0, ...(prog.trailStageBestPct ?? [0]));
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function QuestHome() {
  const [player] = useTjspQuest();
  const lp = levelProgress(player.xp);
  const pending = dueReviews(player);
  const continuePhase =
    tjspQuestCatalog.phases.find(
      (p) => player.phases[p.id]?.unlocked && !player.phases[p.id]?.completed,
    ) ?? tjspQuestCatalog.phases[0];
  const dailyDone = player.daily?.date === todayKey() && player.daily.done;

  return (
    <QuestShell backTo="/painel" top={<GameHud player={player} />}>
      {/* Boas-vindas + jogar */}
      <div className="mb-5 text-center text-white">
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ textShadow: "0 4px 0 rgba(0,0,0,.2)" }}>
          TJSP Quest
        </h1>
        <p className="text-sm font-bold text-white/85">
          Nível {lp.level} · faltam {lp.need - lp.into} XP para o próximo
        </p>
        <div className="mx-auto mt-2 h-3 max-w-xs overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-[#ffd166]" style={{ width: `${lp.pct}%` }} />
        </div>
      </div>

      <MascotSays mood="wave" className="mb-4">
        {greeting()}! {player.streakDays > 1 ? `🔥 ${player.streakDays} dias seguidos — não quebra!` : "Bora estudar jogando?"}
      </MascotSays>

      {continuePhase && (
        <div className="mb-6">
          <GameLinkButton
            to="/quest/fase/$phaseId"
            params={{ phaseId: continuePhase.id }}
            color="#06d6a0"
            shadow="#04a37a"
            className="!h-16 !text-xl"
          >
            ▶ Jogar: {continuePhase.title.length > 22 ? `${continuePhase.title.slice(0, 22)}…` : continuePhase.title}
          </GameLinkButton>
        </div>
      )}

      {/* Roleta diária */}
      <Link
        to="/quest/diario"
        className="mb-6 flex items-center gap-4 rounded-[28px] bg-gradient-to-r from-[#ff006e] to-[#fb5607] p-4 text-white shadow-[0_8px_0_#a3003f] transition-transform active:translate-y-1"
      >
        <span className={dailyDone ? "text-5xl" : "text-5xl q-bob"}>🎡</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-widest text-white/85">Desafio do dia</p>
          <p className="text-xl font-extrabold leading-tight">
            {dailyDone ? "Feito hoje! ✅" : "Gire a roleta"}
          </p>
          <p className="text-sm font-bold text-white/90">
            {dailyDone
              ? `${player.daily!.correct}/${player.daily!.total} acertos · +${player.daily!.coinsAwarded} 🪙`
              : `${DAILY_SIZE} questões reais de prova · até ${DAILY_SIZE * DAILY_REWARD.perCorrect + DAILY_REWARD.perfectBonus} 🪙`}
          </p>
        </div>
      </Link>

      {/* Mundos (matérias) */}
      <h2 className="mb-3 text-xl font-extrabold text-white" style={{ textShadow: "0 2px 0 rgba(0,0,0,.2)" }}>
        🗺️ Mundos
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {tjspQuestCatalog.subjects.map((s) => {
          const theme = worldTheme(s.id);
          const phases = tjspQuestCatalog.phases.filter((p) => p.subjectId === s.id);
          const done = phases.filter((p) => player.phases[p.id]?.completed).length;
          const starTotal = phases.reduce((n, p) => n + starsFromPct(bestPct(player.phases[p.id])), 0);
          const isCurrent = s.id === continuePhase?.subjectId;
          return (
            <Link
              key={s.id}
              to="/quest/materia/$subjectId"
              params={{ subjectId: s.id }}
              className="relative flex flex-col items-center rounded-[26px] p-3 pb-4 text-center text-white transition-transform hover:-translate-y-0.5 active:translate-y-1"
              style={{
                background: `linear-gradient(160deg, ${theme.from}, ${theme.to})`,
                boxShadow: "0 7px 0 rgba(0,0,0,.25)",
              }}
            >
              {isCurrent && (
                <span className="absolute -top-2 right-3 rounded-full bg-[#ffd166] px-2 py-0.5 text-[10px] font-extrabold text-[#2b2d42] shadow">
                  VOCÊ ESTÁ AQUI
                </span>
              )}
              <span className="text-5xl drop-shadow">{theme.emoji}</span>
              <p className="mt-1 text-[15px] font-extrabold leading-tight">{s.shortName || s.name}</p>
              <p className="text-[11px] font-bold leading-tight text-white/85">{theme.name}</p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${phases.length ? (done / phases.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs font-extrabold">
                {done}/{phases.length} fases · ⭐ {starTotal}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Atalhos */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Tile to="/quest/loja" emoji="🛍️" label="Loja" color="#8338ec" shadow="#5a22a8" />
        <Tile
          to="/quest/revisao"
          emoji="🧠"
          label={`Revisões${pending.length ? ` (${pending.length})` : ""}`}
          color="#3a86ff"
          shadow="#2459b3"
        />
        <Tile to="/quest" emoji="🏆" label={`Medalhas (${player.achievements.length})`} color="#ffbe0b" shadow="#c48f00" />
      </div>

      {player.achievements.length > 0 && (
        <div className="mt-4 rounded-[24px] bg-black/20 p-4 text-white">
          <p className="mb-2 text-sm font-extrabold">🏆 Suas medalhas</p>
          <div className="flex flex-wrap gap-2">
            {player.achievements.slice(-12).map((a) => (
              <span key={a} className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-[#2b2d42]">
                🏅 {a.startsWith("phase:") ? a.replace("phase:", "Fase ") : a}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs font-bold text-white/70">
        <Stars count={3} size={12} /> Ganhe 3 estrelas acertando 90% ou mais em cada fase.
      </p>
    </QuestShell>
  );
}

function Tile({
  to,
  emoji,
  label,
  color,
  shadow,
}: {
  to: string;
  emoji: string;
  label: string;
  color: string;
  shadow: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 rounded-[22px] py-3 text-center text-white transition-transform active:translate-y-1"
      style={{ background: color, boxShadow: `0 6px 0 ${shadow}` }}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-xs font-extrabold leading-tight">{label}</span>
    </Link>
  );
}
