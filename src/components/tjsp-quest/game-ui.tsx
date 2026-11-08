/**
 * Peças visuais do TJSP Quest em "modo jogo": botões 3D, HUD, mascote,
 * estrelas, confete e sons. Tudo desenhado em CSS/SVG (sem assets externos).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { levelProgress } from "@/lib/tjsp-quest/progress";
import { normalizeShop } from "@/lib/tjsp-quest/shop";
import { getShopItem } from "@/data/tjsp-quest/shop-catalog";
import type { QuestPlayerState } from "@/types/tjsp-quest";

/* ------------------------------------------------------------------ cores */

/** Paleta de "mundo" por matéria (fundo do mapa / destaque). */
export const WORLD_THEMES: Record<
  string,
  { from: string; to: string; ground: string; emoji: string; name: string }
> = {
  port: { from: "#ff7eb3", to: "#7f5af0", ground: "#ffd6e8", emoji: "📚", name: "Vale das Palavras" },
  const: { from: "#ffb347", to: "#ff5e62", ground: "#ffe3c2", emoji: "🏛️", name: "Cidadela da Constituição" },
  penal: { from: "#f857a6", to: "#7b1fa2", ground: "#ffd1ea", emoji: "⚔️", name: "Fortaleza Penal" },
  procpen: { from: "#5ee7df", to: "#6a3093", ground: "#d4fbf8", emoji: "🕵️", name: "Labirinto do Processo Penal" },
  procciv: { from: "#4facfe", to: "#2b5876", ground: "#d6ecff", emoji: "📜", name: "Arquipélago do Processo Civil" },
  admin: { from: "#43e97b", to: "#2a7d8a", ground: "#d8fbe6", emoji: "🏢", name: "Reino Administrativo" },
  legis: { from: "#fddb92", to: "#b06ab3", ground: "#fff3d6", emoji: "⚖️", name: "Torre das Normas" },
  atual: { from: "#f6d365", to: "#fd7043", ground: "#fff1d6", emoji: "📰", name: "Praça das Notícias" },
  mat: { from: "#84fab0", to: "#3f86ed", ground: "#e2fbef", emoji: "🧮", name: "Ilha dos Números" },
  info: { from: "#30cfd0", to: "#330867", ground: "#d3f6f6", emoji: "💻", name: "Cidade Digital" },
  rlm: { from: "#a18cd1", to: "#e05297", ground: "#efe6fb", emoji: "🧩", name: "Floresta da Lógica" },
};

export function worldTheme(subjectId: string | undefined) {
  return (
    WORLD_THEMES[subjectId ?? ""] ?? {
      from: "#8e9eff",
      to: "#5b3cc4",
      ground: "#e3e7ff",
      emoji: "⭐",
      name: "Mundo do Conhecimento",
    }
  );
}

/** Cores das alternativas (cada letra uma cor, estilo jogo de perguntas). */
export const ANSWER_COLORS: Record<string, { bg: string; shadow: string }> = {
  A: { bg: "#3a86ff", shadow: "#2459b3" },
  B: { bg: "#ff006e", shadow: "#b3004d" },
  C: { bg: "#fb8500", shadow: "#b05d00" },
  D: { bg: "#8338ec", shadow: "#5a22a8" },
  E: { bg: "#06a77d", shadow: "#04745a" },
};

/* --------------------------------------------------------------- botões */

type GameButtonProps = {
  children: ReactNode;
  color?: string;
  shadow?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  size?: "md" | "lg";
};

/** Botão "3D" que afunda ao apertar. */
export function GameButton({
  children,
  color = "#ffbe0b",
  shadow = "#c48f00",
  className,
  disabled,
  onClick,
  type = "button",
  size = "lg",
}: GameButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "font-game inline-flex w-full select-none items-center justify-center gap-2 rounded-2xl font-extrabold uppercase tracking-wide text-white transition-[transform,box-shadow] duration-75",
        "active:translate-y-[5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        size === "lg" ? "h-14 px-6 text-lg" : "h-11 px-4 text-sm",
        className,
      )}
      style={{
        background: color,
        boxShadow: disabled ? `0 2px 0 ${shadow}` : `0 6px 0 ${shadow}`,
        textShadow: "0 2px 0 rgba(0,0,0,.18)",
      }}
    >
      {children}
    </button>
  );
}

export function GameLinkButton({
  children,
  to,
  params,
  color = "#ffbe0b",
  shadow = "#c48f00",
  className,
}: {
  children: ReactNode;
  to: string;
  params?: Record<string, string>;
  color?: string;
  shadow?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      {...(params ? { params } : {})}
      className={cn(
        "font-game inline-flex h-14 w-full select-none items-center justify-center gap-2 rounded-2xl px-6 text-lg font-extrabold uppercase tracking-wide text-white transition-transform active:translate-y-[5px]",
        className,
      )}
      style={{ background: color, boxShadow: `0 6px 0 ${shadow}`, textShadow: "0 2px 0 rgba(0,0,0,.18)" }}
    >
      {children}
    </Link>
  );
}

/* --------------------------------------------------------------- mascote */

export type MascotMood = "happy" | "sad" | "think" | "cheer" | "wave";

/**
 * "Martelinho" — mascote original do TJSP Quest: um martelinho de juiz
 * com carinha. Muda de expressão conforme o aluno joga.
 */
export function Mascot({
  mood = "happy",
  size = 96,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const eyes =
    mood === "sad" ? (
      <>
        <path d="M44 58 q6 -5 12 0" stroke="#2b2d42" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M68 58 q6 -5 12 0" stroke="#2b2d42" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </>
    ) : mood === "cheer" ? (
      <>
        <path d="M44 60 q6 -8 12 0" stroke="#2b2d42" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M68 60 q6 -8 12 0" stroke="#2b2d42" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="50" cy="57" rx="5.5" ry={mood === "think" ? 4.5 : 7} fill="#2b2d42" />
        <ellipse cx="74" cy="57" rx="5.5" ry={mood === "think" ? 4.5 : 7} fill="#2b2d42" />
        <circle cx="52" cy="54" r="2" fill="#fff" />
        <circle cx="76" cy="54" r="2" fill="#fff" />
      </>
    );
  const mouth =
    mood === "sad" ? (
      <path d="M54 78 q8 -7 16 0" stroke="#2b2d42" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    ) : mood === "think" ? (
      <path d="M56 76 h12" stroke="#2b2d42" strokeWidth="3.5" strokeLinecap="round" />
    ) : (
      <path d="M52 72 q10 12 20 0 z" fill="#2b2d42" />
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={cn(mood === "cheer" ? "q-bob" : "", className)}
      role="img"
      aria-label="Martelinho, o mascote"
    >
      {/* cabo */}
      <rect x="57" y="88" width="12" height="34" rx="6" fill="#8d5524" />
      <rect x="57" y="88" width="5" height="34" rx="2.5" fill="#a86b3a" />
      {/* cabeça do martelo */}
      <rect x="18" y="30" width="92" height="62" rx="22" fill="#c68642" />
      <rect x="18" y="30" width="92" height="20" rx="10" fill="#d99a5b" />
      <rect x="10" y="38" width="12" height="46" rx="6" fill="#8d5524" />
      <rect x="106" y="38" width="12" height="46" rx="6" fill="#8d5524" />
      {/* bochechas */}
      <circle cx="40" cy="70" r="6" fill="#ff8fa3" opacity=".7" />
      <circle cx="86" cy="70" r="6" fill="#ff8fa3" opacity=".7" />
      {eyes}
      {mouth}
      {mood === "cheer" && (
        <>
          <path d="M14 22 l6 6 M114 22 l-6 6 M64 10 v8" stroke="#ffd60a" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {mood === "think" && <text x="96" y="26" fontSize="22" fontWeight="800" fill="#ffd60a">?</text>}
      {mood === "wave" && (
        <path d="M112 30 q8 -14 0 -22" stroke="#c68642" strokeWidth="7" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Mascote com balão de fala. */
export function MascotSays({
  mood,
  children,
  className,
  size = 72,
}: {
  mood?: MascotMood;
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <Mascot mood={mood ?? "happy"} size={size} className="shrink-0 drop-shadow-lg" />
      <div className="font-game relative mb-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold leading-snug text-[#2b2d42] shadow-lg">
        <span className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 bg-white" />
        <span className="relative">{children}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- HUD */

export function characterEmoji(player: QuestPlayerState): string {
  const shop = normalizeShop(player.shop);
  return getShopItem(shop.equippedCharacterId)?.emoji ?? "🧑‍💼";
}

/** Barra do topo: avatar + nível, moedas, vidas, sequência. */
export function GameHud({ player, className }: { player: QuestPlayerState; className?: string }) {
  const lp = levelProgress(player.xp);
  const shop = normalizeShop(player.shop);
  const coins = player.coins ?? player.xp;
  return (
    <div className={cn("font-game flex items-center gap-2", className)}>
      <Link
        to="/quest/loja"
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-[0_4px_0_rgba(0,0,0,.2)]"
        aria-label="Seu personagem (Loja)"
      >
        <svg className="absolute inset-0" viewBox="0 0 48 48" aria-hidden>
          <circle cx="24" cy="24" r="21" fill="none" stroke="#e9ecef" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r="21"
            fill="none"
            stroke="#ffbe0b"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(lp.pct / 100) * 132} 132`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span className="relative">{characterEmoji(player)}</span>
        <span className="absolute -bottom-1 -right-1 rounded-full bg-[#8338ec] px-1.5 text-[11px] font-extrabold leading-5 text-white shadow">
          {lp.level}
        </span>
      </Link>
      <HudPill icon="🪙" value={coins} title="Moedas (gaste na Loja)" to="/quest/loja" />
      <HudPill icon="❤️" value={shop.lives} title="Vidas" to="/quest/loja" />
      <HudPill icon="🔥" value={player.streakDays} title="Dias seguidos" />
      <SoundToggle className="ml-auto" />
    </div>
  );
}

function HudPill({
  icon,
  value,
  title,
  to,
}: {
  icon: string;
  value: number | string;
  title: string;
  to?: string;
}) {
  const inner = (
    <>
      <span className="text-lg leading-none">{icon}</span>
      <span className="tabular-nums">{value}</span>
    </>
  );
  const cls =
    "inline-flex h-9 items-center gap-1 rounded-full bg-black/25 px-3 text-sm font-extrabold text-white backdrop-blur";
  return to ? (
    <Link to={to} className={cls} title={title}>
      {inner}
    </Link>
  ) : (
    <span className={cls} title={title}>
      {inner}
    </span>
  );
}

/* --------------------------------------------------------------- estrelas */

/** 0–3 estrelas a partir do % de acerto. */
export function starsFromPct(pct: number): number {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 50) return 1;
  return 0;
}

export function Stars({
  count,
  size = 18,
  className,
  animate = false,
}: {
  count: number;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-end gap-0.5", className)} aria-label={`${count} de 3 estrelas`}>
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          width={i === 1 ? size * 1.25 : size}
          height={i === 1 ? size * 1.25 : size}
          viewBox="0 0 24 24"
          className={animate && i < count ? "q-pop" : ""}
          style={animate ? { animationDelay: `${i * 0.25}s` } : undefined}
        >
          <path
            d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
            fill={i < count ? "#ffd60a" : "rgba(0,0,0,.18)"}
            stroke={i < count ? "#e0a800" : "rgba(255,255,255,.35)"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- confete */

const CONFETTI_COLORS = ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec", "#3a86ff", "#06d6a0"];

/** Chuva de confete (dispara quando `fire` muda). */
export function Confetti({ fire, pieces = 60 }: { fire: number; pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: `${fire}-${i}`,
        left: Math.random() * 100,
        dx: `${(Math.random() - 0.5) * 240}px`,
        rot: `${Math.random() * 720 - 360}deg`,
        delay: Math.random() * 0.25,
        dur: 1.1 + Math.random() * 0.9,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        w: 6 + Math.random() * 6,
      })),
    [fire, pieces],
  );
  if (!fire) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0" aria-hidden>
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0 block rounded-[2px]"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.w * 0.45,
              background: b.color,
              animation: `q-confetti ${b.dur}s ease-in ${b.delay}s both`,
              "--dx": b.dx,
              "--rot": b.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ sons */

const SOUND_KEY = "estufoo.quest-sound";

function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

let ctx: AudioContext | null = null;

function tone(freqs: number[], dur = 0.12, type: OscillatorType = "triangle", gap = 0.09) {
  if (typeof window === "undefined" || !soundOn()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t0 = now + i * gap;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  } catch {
    /* sem áudio — tudo bem */
  }
}

/** Efeitos sonoros curtos (gerados, sem arquivos). Respeita o botão de som. */
export const gameSound = {
  tap: () => tone([660], 0.06, "square"),
  correct: () => tone([660, 880, 1175], 0.14),
  wrong: () => tone([220, 165], 0.22, "sawtooth", 0.14),
  combo: () => tone([880, 1175, 1568], 0.1, "square", 0.06),
  win: () => tone([523, 659, 784, 1047, 1319], 0.18, "triangle", 0.11),
  coin: () => tone([1319, 1760], 0.08, "square", 0.06),
  spin: () => tone([440, 494, 523, 587, 659, 698, 784], 0.05, "square", 0.05),
};

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (next) gameSound.tap();
  }, [on]);
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur",
        className,
      )}
      aria-label={on ? "Desligar som" : "Ligar som"}
      title={on ? "Som ligado" : "Som desligado"}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}

/* ------------------------------------------------------------ fundo/céu */

/** Nuvens e estrelinhas flutuando (decoração do fundo). */
export function SkyDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {[12, 30, 58, 76].map((top, i) => (
        <svg
          key={top}
          className="absolute opacity-70"
          style={{
            top: `${top}%`,
            left: 0,
            animation: `q-float ${48 + i * 14}s linear ${-i * 11}s infinite`,
          }}
          width={110 + i * 20}
          height={46 + i * 6}
          viewBox="0 0 110 46"
        >
          <path
            d="M18 40c-9 0-14-6-12-13 2-6 9-8 14-6 2-9 11-15 21-12 6-8 21-9 28 1 9-3 19 3 19 12 7 0 12 5 11 11-1 5-5 7-10 7z"
            fill="#fff"
            opacity=".55"
          />
        </svg>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="q-twinkle absolute h-1.5 w-1.5 rounded-full bg-white"
          style={{
            top: `${(i * 37) % 90}%`,
            left: `${(i * 53) % 96}%`,
            animationDelay: `${(i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
