import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Flame, Lock, ShoppingBag, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Deslocamento horizontal do nó na trilha (zigue-zague). */
export function pathOffsetX(index: number): number {
  const pattern = [0, 56, 0, -56, 12, -48, 0];
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
    <div className="mb-4 flex items-center justify-center gap-5 text-sm font-black">
      <span className="inline-flex items-center gap-1.5 text-[#ff6b35]">
        <Flame className="h-5 w-5 fill-current" aria-hidden />
        {streak}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[#ffd60a]">
        <Sparkles className="h-5 w-5" aria-hidden />
        Nv.{level}
      </span>
      <Link
        to="/quest/loja"
        className="inline-flex items-center gap-1.5 text-[#4cc9f0] transition hover:scale-105"
        title="Abrir loja"
      >
        <Star className="h-5 w-5 fill-current" aria-hidden />
        {xp}
      </Link>
      <Link
        to="/quest/loja"
        className="inline-flex items-center gap-1 text-white/80 transition hover:text-white"
        aria-label="Loja"
      >
        <ShoppingBag className="h-5 w-5" />
      </Link>
    </div>
  );
}

export function QuestModuleHeader({
  eyebrow,
  title,
  to,
  params,
  accent = "#4cc9f0",
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
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </p>
        <p className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">{title}</p>
      </div>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
        aria-hidden
      >
        <ChevronRight className="h-5 w-5" />
      </span>
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#121826]/95 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur transition hover:border-white/20";

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

export function QuestPathNode({
  icon,
  label,
  status,
  to,
  params,
  offsetX = 0,
  className,
}: {
  icon: ReactNode;
  label: string;
  status: PathNodeStatus;
  to?: string;
  params?: Record<string, string>;
  offsetX?: number;
  className?: string;
}) {
  const isBoss = status === "boss" || status === "boss-done";
  const locked = status === "locked";
  const done = status === "done" || status === "boss-done";

  const node = (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 transition",
        !locked && "hover:scale-105 active:scale-95",
        locked && "opacity-55",
        className,
      )}
      style={{ transform: `translateX(${offsetX}px)` }}
    >
      <span
        className={cn(
          "flex items-center justify-center border-4 shadow-[0_8px_0_0_rgba(0,0,0,0.35)]",
          isBoss
            ? "h-16 w-[4.5rem] rounded-2xl border-[#c45c00] bg-gradient-to-b from-[#ffb703] to-[#fb8500]"
            : "h-16 w-16 rounded-2xl border-[#1d4e89]",
          !isBoss && done && "border-emerald-600 bg-gradient-to-b from-emerald-400 to-emerald-600",
          !isBoss && status === "available" && "bg-gradient-to-b from-[#4cc9f0] to-[#0077b6]",
          !isBoss && locked && "border-[#2a2f45] bg-[#1e2438]",
          isBoss && done && "border-emerald-700 from-emerald-400 to-emerald-600",
        )}
      >
        {locked ? (
          <Lock className="h-6 w-6 text-white/50" aria-hidden />
        ) : (
          <span className="text-white [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
        )}
      </span>
      <span className="max-w-[7.5rem] text-center text-[11px] font-bold leading-tight text-white/90">
        {label}
      </span>
    </div>
  );

  if (locked || !to) {
    return <div className="flex justify-center py-1">{node}</div>;
  }

  return (
    <div className="flex justify-center py-1">
      {params ? (
        <Link
          to={to}
          params={params}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[#4cc9f0]"
        >
          {node}
        </Link>
      ) : (
        <Link to={to} className="outline-none focus-visible:ring-2 focus-visible:ring-[#4cc9f0]">
          {node}
        </Link>
      )}
    </div>
  );
}

export function QuestPathTrail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto max-w-sm pb-10 pt-2", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-4 top-16 text-5xl font-black text-white/10"
      >
        §
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-6 top-1/3 text-4xl text-white/10"
      >
        ⚖
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-24 left-8 text-4xl text-white/10"
      >
        ⌘
      </div>

      <div
        aria-hidden
        className="absolute left-1/2 top-6 bottom-16 w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#4cc9f0]/90 via-[#0077b6]/70 to-[#fb8500]/80 shadow-[0_0_20px_rgba(76,201,240,0.25)]"
      />

      <div className="relative z-10 flex flex-col gap-5">{children}</div>
    </div>
  );
}
