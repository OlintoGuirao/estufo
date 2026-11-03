import { Link } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";

export function Logo({ to = "/", className = "" }: { to?: "/" | "/painel"; className?: string }) {
  return (
    <Link to={to} className={`flex items-center gap-2 font-display text-lg font-semibold ${className}`}>
      <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
        <BrainCircuit className="h-5 w-5" aria-hidden />
      </span>
      Estu<span className="text-highlight">foo</span>
    </Link>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-card">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
