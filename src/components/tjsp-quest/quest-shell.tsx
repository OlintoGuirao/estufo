import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visual estilo jogo (Trivia Crack / Perguntados): fundo vibrante, tipografia forte. */
export function QuestShell({
  children,
  title,
  backTo = "/quest",
  right,
  className,
}: {
  children: ReactNode;
  title?: string;
  backTo?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative -mx-4 min-h-[calc(100vh-7rem)] overflow-hidden px-4 pb-10 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#ff9f1c33,transparent_55%),radial-gradient(ellipse_at_bottom_right,#0077b622,transparent_50%),linear-gradient(180deg,#0b132b_0%,#1c2541_45%,#3a506b_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h20v20H0V0zm20 20h20v20H20V20z'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl pt-2">
        <div className="mb-4 flex items-center gap-3">
          <Link
            to={backTo}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {title && (
            <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h1>
          )}
          <div className="ml-auto">{right}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QuestCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/15 bg-white p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function QuestStatPill({
  label,
  value,
  accent = "#ff9f1c",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2 text-center backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{label}</p>
      <p className="text-lg font-black text-white" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
