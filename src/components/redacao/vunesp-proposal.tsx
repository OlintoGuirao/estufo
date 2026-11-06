import { VUNESP_REDACAO_COMMAND, type RedacaoSupportText } from "@/types/redacao";
import { cn } from "@/lib/utils";

/** Proposta de redação no layout da prova VUNESP. */
export function VunespProposal({
  title,
  supportTexts,
  prompt,
  className,
}: {
  title: string;
  supportTexts?: RedacaoSupportText[];
  prompt?: string;
  className?: string;
}) {
  const texts = supportTexts?.filter((t) => t.body?.trim()) ?? [];
  const command = (prompt?.trim() || VUNESP_REDACAO_COMMAND).trim();
  const themeLine = title.trim().toUpperCase();

  return (
    <article
      className={cn(
        "rounded-xl border bg-[#faf9f6] px-4 py-6 text-[#1a1a1a] shadow-sm sm:px-8 sm:py-8",
        className,
      )}
    >
      <h2 className="mb-8 text-center text-sm font-bold tracking-wide sm:text-base">
        REDAÇÃO EM LÍNGUA PORTUGUESA
      </h2>

      {texts.length > 0 ? (
        <div className="space-y-7">
          {texts.map((t) => (
            <section key={t.label + t.source.slice(0, 24)}>
              <p className="mb-2 text-center text-xs font-bold tracking-wide sm:text-sm">
                {t.label}
              </p>
              <p className="text-justify text-sm leading-relaxed whitespace-pre-wrap sm:text-[15px]">
                {t.body}
              </p>
              {t.source ? (
                <p className="mt-2 text-justify text-xs italic leading-relaxed text-[#444] sm:text-[13px]">
                  {t.source}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta proposta ainda não tem textos motivadores no padrão da prova. Gere os temas de
          novo em Redação para receber TEXTO 1, 2 e 3 como na VUNESP.
        </p>
      )}

      <p className="mt-8 text-justify text-sm leading-relaxed sm:text-[15px]">{command}</p>

      <p className="mt-6 text-center text-sm font-bold uppercase leading-snug tracking-wide sm:text-base">
        {themeLine}
      </p>
    </article>
  );
}
