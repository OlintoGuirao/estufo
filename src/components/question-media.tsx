import { officialMediaFor } from "@/lib/official-media";
import { cn } from "@/lib/utils";
import type { QuestionMedia, QuestionMediaSet } from "@/types";

/** Mídia da questão: a que veio com ela ou, para oficiais antigas salvas sem o campo, pelo id. */
export function resolveQuestionMedia(q: { id: string; media?: QuestionMediaSet | undefined }): QuestionMediaSet | undefined {
  return q.media ?? officialMediaFor(q.id.replace(/^daily:/, ""));
}

/**
 * Figuras, prints e tabelas recortados do caderno oficial. Ficam logo abaixo
 * do enunciado (ou dentro da alternativa), na ordem em que aparecem na prova.
 */
export function QuestionMediaList({
  items,
  className,
  compact = false,
}: {
  items: QuestionMedia[] | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((m) => (
        <figure key={m.src} className="m-0">
          <img
            src={m.src}
            alt={m.alt || "Imagem da questão (caderno oficial)"}
            loading="lazy"
            decoding="async"
            className={cn(
              "h-auto max-w-full rounded-md border bg-white p-1",
              // Recortes são em tons de cinza do caderno; no tema escuro ficam sobre fundo branco.
              compact ? "max-h-40" : "max-h-[28rem]",
            )}
          />
        </figure>
      ))}
    </div>
  );
}
