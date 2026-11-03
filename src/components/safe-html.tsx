import { cn } from "@/lib/utils";

/** Renderiza HTML já sanitizado no servidor (allowlist). Não use com conteúdo bruto. */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
