import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkyDecor, worldTheme } from "@/components/tjsp-quest/game-ui";

/**
 * Moldura do TJSP Quest em "modo jogo": céu colorido (cor do mundo da
 * matéria), nuvens flutuando e tipografia arredondada.
 */
export function QuestShell({
  children,
  title,
  backTo = "/quest",
  right,
  className,
  world,
  top,
}: {
  children: ReactNode;
  title?: string;
  backTo?: string;
  right?: ReactNode;
  className?: string;
  /** id da matéria → cores do "mundo". Sem isso: céu roxo padrão. */
  world?: string;
  /** Conteúdo fixo no topo (ex.: HUD). */
  top?: ReactNode;
}) {
  const theme = worldTheme(world);
  return (
    <div
      className={cn(
        // light-island: o jogo mantém o visual colorido mesmo no tema escuro.
        "light-island font-game relative -mx-4 min-h-[calc(100vh-7rem)] overflow-hidden px-4 pb-10 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% -10%, rgba(255,255,255,.35), transparent 55%), linear-gradient(170deg, ${theme.from} 0%, ${theme.to} 100%)`,
        }}
      />
      <SkyDecor />
      <div className="relative z-10 mx-auto max-w-3xl pt-3">
        {top && <div className="mb-4">{top}</div>}
        {(title || backTo || right) && (
          <div className="mb-4 flex items-center gap-3">
            <Link
              to={backTo}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2b2d42] shadow-[0_4px_0_rgba(0,0,0,.2)] transition-transform active:translate-y-1"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            </Link>
            {title && (
              <h1
                className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl"
                style={{ textShadow: "0 3px 0 rgba(0,0,0,.18)" }}
              >
                {title}
              </h1>
            )}
            <div className="ml-auto">{right}</div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Cartão branco "de jogo": cantos bem redondos e sombra sólida embaixo. */
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
        "rounded-[28px] bg-white p-5 text-[#2b2d42] shadow-[0_8px_0_rgba(0,0,0,.14)] sm:p-6",
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
  accent = "#ffbe0b",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-2 text-center backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</p>
      <p className="text-xl font-extrabold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
