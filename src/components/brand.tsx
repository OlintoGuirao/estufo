import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({
  to = "/",
  className = "",
  showWordmark = true,
}: {
  to?: "/" | "/painel";
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 font-display text-lg font-semibold",
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Estufoo"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-lg object-contain"
        decoding="async"
      />
      {showWordmark ? (
        <span>
          Estu<span className="text-highlight">foo</span>
        </span>
      ) : null}
    </Link>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-card">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
