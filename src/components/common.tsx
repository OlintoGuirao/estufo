import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Mastery } from "@/types";

export function PageHeader({ title, description, actions }: { title: string; description?: string | undefined; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: ReactNode; hint?: string | undefined; icon: LucideIcon; tone?: "primary" | "highlight" }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("rounded-lg p-2", tone === "highlight" ? "bg-highlight-soft text-highlight" : "bg-accent text-primary")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/30 bg-card px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <p className="mt-3 font-medium">Não foi possível carregar os dados</p>
      <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erro desconhecido."}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function GridSkeleton({ count = 4, className = "h-28" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", className)} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export const masteryMeta: Record<Mastery, { label: string; className: string; dot: string }> = {
  "nao-estudado": { label: "Não estudado", className: "border-mastery-none/40 text-muted-foreground", dot: "bg-mastery-none" },
  baixo: { label: "Baixo domínio", className: "border-mastery-low/40 text-mastery-low", dot: "bg-mastery-low" },
  intermediario: { label: "Intermediário", className: "border-mastery-mid/50 text-foreground", dot: "bg-mastery-mid" },
  bom: { label: "Bom domínio", className: "border-mastery-good/40 text-mastery-good", dot: "bg-mastery-good" },
  revisado: { label: "Revisado recentemente", className: "border-mastery-reviewed/40 text-mastery-reviewed", dot: "bg-mastery-reviewed" },
};

export function MasteryBadge({ mastery }: { mastery: Mastery }) {
  const m = masteryMeta[mastery];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", m.className)}>
      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Badge>
  );
}

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", opts);

export const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 864e5);

export const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}min ${String(s).padStart(2, "0")}s`;
};
