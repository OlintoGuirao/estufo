import { Children, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Flame, Lock, ShoppingBag, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stars } from "@/components/tjsp-quest/game-ui";

/** Altura de cada "andar" do mapa (nó + rótulo + estrelas). */
const ROW_H = 120;

/** Deslocamento horizontal do nó no mapa (caminho sinuoso). */
export function pathOffsetX(index: number): number {
  const pattern = [0, 70, 100, 70, 0, -70, -100, -70];
  return pattern[index % pattern.length]!;
}

export function QuestPathStats({
  streak,
  level,
  xp,
}: {
  streak: number;
  level: number;
  xp: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-center gap-3 text-sm font-extrabold">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-[#ffd166]">
        <Flame className="h-4 w-4 fill-current" aria-hidden />
        {streak}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-white">
        <Sparkles className="h-4 w-4" aria-hidden />
        Nv.{level}
      </span>
      <Link
        to="/quest/loja"
        className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-[#ffd166]"
      >
        <Star className="h-4 w-4 fill-current" aria-hidden />
        {xp}
      </Link>
      <Link
        to="/quest/loja"
        className="inline-flex items-center rounded-full bg-black/20 p-2 text-white"
        aria-label="Loja"
      >
        <ShoppingBag className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Placa do topo do mapa (nome do mundo / fase atual). */
export function QuestModuleHeader({
  eyebrow,
  title,
  to,
  params,
  accent = "#8338ec",
}: {
  eyebrow: string;
  title: string;
  to?: string;
  params?: Record<string, string>;
  accent?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {eyebrow}
        </p>
        <p className="mt-0.5 truncate text-lg font-extrabold text-[#2b2d42]">{title}</p>
      </div>
      {to && (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_4px_0_rgba(0,0,0,.2)]"
          style={{ background: accent }}
          aria-hidden
        >
          <ChevronRight className="h-6 w-6" strokeWidth={3} />
        </span>
      )}
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_6px_0_rgba(0,0,0,.15)] transition-transform active:translate-y-1";

  if (to && params) {
    return (
      <Link to={to} params={params} className={className}>
        {inner}
      </Link>
    );
  }
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export type PathNodeStatus = "locked" | "available" | "done" | "boss" | "boss-done";

/** Bolinha de nível no mapa: 3D, estrelas embaixo, avatar quando é a atual. */
export function QuestPathNode({
  icon,
  label,
  status,
  to,
  params,
  offsetX = 0,
  className,
  stars,
  current = false,
  avatar,
  boss = false,
}: {
  icon: ReactNode;
  label: string;
  status: PathNodeStatus;
  to?: string;
  params?: Record<string, string>;
  offsetX?: number;
  className?: string;
  /** 0–3 estrelas (melhor resultado). */
  stars?: number;
  /** Nível onde o aluno está — ganha brilho e o avatar dele. */
  current?: boolean;
  avatar?: string;
  /** Chefão (maior, com coroa) mesmo enquanto bloqueado. */
  boss?: boolean;
}) {
  const isBoss = boss || status === "boss" || status === "boss-done";
  const locked = status === "locked";
  const done = status === "done" || status === "boss-done";

  const face = isBoss && !locked
    ? { bg: done ? "#06d6a0" : "#ffbe0b", shadow: done ? "#04a37a" : "#c48f00" }
    : done
      ? { bg: "#06d6a0", shadow: "#04a37a" }
      : locked
        ? { bg: "#d9dbe7", shadow: "#a9acc0" }
        : { bg: "#ff5d8f", shadow: "#c4325f" };

  const node = (
    <div
      className={cn(
        "relative flex flex-col items-center",
        !locked && "transition-transform hover:scale-105 active:scale-95",
        className,
      )}
      style={{ transform: `translateX(${offsetX}px)` }}
    >
      {current && avatar && (
        <span className="q-bob absolute -top-11 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow-[0_4px_0_rgba(0,0,0,.2)]">
          {avatar}
        </span>
      )}
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full text-white",
          isBoss ? "h-[84px] w-[84px]" : "h-[68px] w-[68px]",
          current && "q-glow",
        )}
        style={{
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.45), transparent 45%), ${face.bg}`,
          boxShadow: `0 7px 0 ${face.shadow}, inset 0 -4px 0 rgba(0,0,0,.08)`,
        }}
      >
        {locked ? (
          isBoss ? (
            <span className="text-4xl grayscale">👑</span>
          ) : (
            <Lock className="h-7 w-7 text-white/90" strokeWidth={3} aria-hidden />
          )
        ) : (
          <span
            className={cn("[&_svg]:h-8 [&_svg]:w-8", isBoss && "[&_svg]:h-10 [&_svg]:w-10")}
            style={{ textShadow: "0 2px 0 rgba(0,0,0,.2)" }}
          >
            {icon}
          </span>
        )}
      </span>
      {typeof stars === "number" && !locked ? (
        <Stars count={stars} size={16} className="mt-2" />
      ) : (
        <span className="mt-2 h-4" />
      )}
      <span className="mt-0.5 max-w-[8rem] rounded-full bg-black/25 px-2 py-0.5 text-center text-[11px] font-extrabold leading-tight text-white">
        {label}
      </span>
    </div>
  );

  const row = "flex items-center justify-center";
  if (locked || !to) {
    return (
      <div className={row} style={{ height: ROW_H }}>
        {node}
      </div>
    );
  }
  return (
    <div className={row} style={{ height: ROW_H }}>
      <Link
        to={to}
        {...(params ? { params } : {})}
        className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-white/70"
      >
        {node}
      </Link>
    </div>
  );
}

/**
 * Mapa vertical com estrada sinuosa ligando os nós (mesmos deslocamentos
 * de `pathOffsetX`). Os filhos devem ser `QuestPathNode`, na ordem.
 */
export function QuestPathTrail({
  children,
  className,
  doneCount = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Quantos nós já foram vencidos (pinta o trecho percorrido). */
  doneCount?: number;
}) {
  const count = Children.count(children);
  const width = 360;
  const cx = width / 2;
  const height = count * ROW_H;
  const pts = Array.from({ length: count }, (_, i) => ({
    x: cx + pathOffsetX(i),
    y: i * ROW_H + 44,
  }));
  const curve = (list: typeof pts) =>
    list
      .map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = list[i - 1]!;
        const midY = (prev.y + p.y) / 2;
        return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      })
      .join(" ");
  const full = curve(pts);
  const walked = curve(pts.slice(0, Math.min(count, doneCount + 1)));

  return (
    <div className={cn("relative mx-auto max-w-[360px] pb-10 pt-12", className)}>
      <svg
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <path d={full} fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="22" strokeLinecap="round" />
        <path d={full} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="14" strokeLinecap="round" />
        <path
          d={full}
          fill="none"
          stroke="rgba(0,0,0,.12)"
          strokeWidth="3"
          strokeDasharray="2 14"
          strokeLinecap="round"
        />
        {doneCount > 0 && (
          <path d={walked} fill="none" stroke="#06d6a0" strokeWidth="14" strokeLinecap="round" opacity=".9" />
        )}
      </svg>
      <div className="relative z-10 flex flex-col">{children}</div>
    </div>
  );
}
