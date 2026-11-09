import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { splitPassageSource } from "@/lib/official-question-clean";
import { cn } from "@/lib/utils";

/**
 * Texto de apoio da prova, separado da pergunta.
 * Celular: caixa recolhível com rolagem. Tela grande: coluna fixa ao lado.
 */
export function SupportTextPanel({
  label,
  passage,
  className,
}: {
  label: string;
  passage: string;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const { body, source } = splitPassageSource(passage);
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-xl border bg-muted/40 lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left lg:cursor-default"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          {label}
        </span>
        <span className="text-muted-foreground lg:hidden">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      <div
        className={cn(
          "overflow-y-auto px-5 py-4 font-serif text-[15px] leading-7 text-foreground/90",
          open ? "max-h-80 lg:max-h-none lg:flex-1" : "hidden lg:block lg:flex-1",
        )}
      >
        <p className="whitespace-pre-line">{body}</p>
        {source && <p className="mt-4 text-right text-xs italic text-muted-foreground">{source}</p>}
      </div>
    </section>
  );
}
