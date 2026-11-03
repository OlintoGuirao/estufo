import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Card estilo trilha (print2): título, descrição, ícone em “balão” e segmentos de progresso. */
export function QuestModuleCard({
  title,
  description,
  icon,
  accent = "#7b2cbf",
  progressFilled,
  progressTotal = 5,
  isCurrent = false,
  locked = false,
  to,
  params,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: string;
  progressFilled: number;
  progressTotal?: number;
  isCurrent?: boolean;
  locked?: boolean;
  to: string;
  params?: Record<string, string>;
}) {
  const segments = Math.max(1, progressTotal);
  const filled = Math.min(segments, Math.max(0, progressFilled));

  const body = (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 pb-4 pt-3 transition",
        locked && "opacity-55",
        isCurrent
          ? "border-[#3a86ff] bg-[#151b2e] shadow-[0_0_24px_-8px_rgba(58,134,255,0.55)]"
          : "border-white/10 bg-[#121826] hover:border-white/20",
      )}
    >
      {isCurrent && (
        <span className="mb-2 inline-flex rounded-md bg-[#3a86ff] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          Atual
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-snug text-white sm:text-base">{title}</h3>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#8b9bb4] sm:text-[13px]">
            {description}
          </p>
        </div>

        {/* Ícone estilo balão / speech bubble */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border border-white/10 bg-[#1a2236]"
            style={{ borderRight: "none", borderTop: "none" }}
          />
          <span
            className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-xl border border-white/10 bg-[#1a2236] text-white shadow-inner"
            style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
          >
            <span className="[&_svg]:h-8 [&_svg]:w-8" style={{ color: accent }}>
              {icon}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5" aria-label={`Progresso ${filled} de ${segments}`}>
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < filled ? "bg-[#7b2cbf] shadow-[0_0_8px_rgba(123,44,191,0.65)]" : "bg-[#2a3148]",
            )}
            style={i < filled ? { backgroundColor: accent } : undefined}
          />
        ))}
      </div>
    </article>
  );

  if (locked) {
    return <div className="block">{body}</div>;
  }

  if (params) {
    return (
      <Link
        to={to}
        params={params}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-[#3a86ff]"
      >
        {body}
      </Link>
    );
  }

  return (
    <Link to={to} className="block outline-none focus-visible:ring-2 focus-visible:ring-[#3a86ff]">
      {body}
    </Link>
  );
}
