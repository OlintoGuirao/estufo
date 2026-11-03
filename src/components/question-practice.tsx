import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScratchPad } from "@/components/scratch-pad";
import { EmptyState } from "@/components/common";
import { errMsg } from "@/components/forms";
import { MastigadoPanel } from "@/components/mastigado-panel";
import { extractFonteUrl } from "@/lib/tutor/fonte";
import { errorNotesService, questionsService, tutorService } from "@/services";
import { tjspBancoCatalog } from "@/services/tjsp-banco.catalog";
import type { ErrorNoteOrigin, Question } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  title?: string | undefined;
  questions: Question[];
  onDone?: (() => void) | undefined;
  doneLabel?: string | undefined;
  /** Chamado a cada resposta confirmada (para atualizar % de erro no card). */
  onAnswer?: ((result: { questionId: string; correct: boolean }) => void) | undefined;
  /** % de erro ao vivo (sessão). */
  liveErrorPct?: number | undefined;
  liveAnswered?: number | undefined;
  liveWrong?: number | undefined;
  /** Se definido, erros vão automaticamente ao caderno. */
  errorOrigin?: ErrorNoteOrigin | undefined;
  errorSourceLabel?: string | undefined;
};

/** Prática de um conjunto de questões (layout da prova diagnóstica). */
export function QuestionPractice({
  title,
  questions,
  onDone,
  doneLabel = "Voltar ao cronograma",
  onAnswer,
  liveErrorPct,
  liveAnswered,
  liveWrong,
  errorOrigin,
  errorSourceLabel,
}: Props) {
  const [items, setItems] = useState(() =>
    questions.map((q) => ({ ...q, answered: null as Question["answered"] })),
  );
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mastigado, setMastigado] = useState<{
    text: string;
    url: string | null;
    activeTest: {
      statement: string;
      alternatives: { key: string; text: string }[];
      correctKey: string;
      explanation: string;
    } | null;
  } | null>(null);
  /** Explicação devolvida ao confirmar (fallback se getRaw falhar). */
  const [explById, setExplById] = useState<Record<string, string>>({});

  const q = items[idx];
  const answeredCount = items.filter((x) => x.answered).length;
  const allAnswered = answeredCount >= items.length;
  const localWrong = items.filter((x) => x.answered && !x.answered.correct).length;
  const shownAnswered = liveAnswered ?? answeredCount;
  const shownWrong = liveWrong ?? localWrong;
  const shownPct =
    liveErrorPct ??
    (answeredCount ? Math.round((localWrong / answeredCount) * 100) : 0);

  const raw = q ? tjspBancoCatalog.getRaw(q.id) : undefined;
  const explanationText = (raw?.explanation || (q ? explById[q.id] : undefined) || "").trim();
  const fonteUrl = extractFonteUrl(explanationText) ?? null;
  const explanationHint = explanationText
    ? explanationText.replace(/\[fonte\]\([^)]+\)/gi, "").trim().slice(0, 1100)
    : undefined;
  const canMastigar = Boolean(fonteUrl || explanationHint);

  useEffect(() => {
    setDraft(q?.answered?.choice ?? null);
    setMastigado(null);
  }, [q?.id, q?.answered?.choice]);

  const mastigadoMut = useMutation({
    mutationFn: async () => {
      if (!q) throw new Error("Questão indisponível.");
      if (!canMastigar) {
        throw new Error("Sem fundamento no gabarito para mastigar esta questão.");
      }
      return tutorService.mastigado({
        statement: q.statement,
        subject: q.subject,
        topic: q.topic,
        alternatives: q.alternatives.map((a) => ({ key: a.key, text: a.text })),
        ...(fonteUrl ? { fonteUrl } : {}),
        ...(explanationHint ? { explanationHint } : {}),
      });
    },
    onMutate: () => {
      toast.loading(
        fonteUrl ? "Lendo a fonte e mastigando com a IA…" : "Mastigando o fundamento com a IA…",
        { id: "mastigado" },
      );
    },
    onSuccess: (r) => {
      toast.dismiss("mastigado");
      setMastigado({
        text: r.mastigado,
        url: r.fonteUrl ?? null,
        activeTest: r.activeTest ?? null,
      });
      if (r.mocked) toast.message("Resposta mockada (GEMINI_USE_MOCK).");
      else if (fonteUrl && !r.fetchedPage) {
        toast.message("Fonte difícil de ler — usei o fundamento disponível.");
      } else toast.success("Mastigado pronto.");
    },
    onError: (e) => {
      toast.dismiss("mastigado");
      toast.error(errMsg(e));
    },
  });

  const goTo = (next: number) => {
    const max = items.length - 1;
    setIdx(Math.min(Math.max(0, next), max));
  };

  const confirm = async () => {
    if (!q || pending || q.answered || !draft) return;
    setPending(true);
    try {
      const result = await questionsService.answer(q.id, { choice: draft, timeSec: 0 });
      if (result.explanation?.trim()) {
        setExplById((prev) => ({ ...prev, [q.id]: result.explanation }));
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? {
                ...item,
                answered: {
                  choice: draft.toUpperCase(),
                  correct: result.correct,
                },
              }
            : item,
        ),
      );
      onAnswer?.({ questionId: q.id, correct: result.correct });
      if (!result.correct && errorOrigin) {
        void errorNotesService
          .save({
            questionId: q.id,
            reasonCode: "nao-sabia",
            origin: errorOrigin,
            snapshot: true,
            subject: q.subject,
            topic: q.topic,
            statement: q.statement,
            yourKey: draft.toUpperCase(),
            correctKey: result.correctKey,
            explanation: result.explanation ?? "",
            sourceLabel: errorSourceLabel || title || errorOrigin,
          })
          .catch(() => undefined);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPending(false);
    }
  };

  if (!items.length) {
    return <EmptyState title="Sem questões" description="Não há itens neste tópico." />;
  }
  if (!q) {
    return <EmptyState title="Questão não encontrada" description="Volte e escolha outro tópico." />;
  }

  const locked = !!q.answered;
  const selected = draft;

  return (
    <div className="-mx-1 space-y-3 sm:-mx-2">
      {title && (
        <p className="px-1 text-sm font-medium text-foreground">{title}</p>
      )}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm text-muted-foreground">
            {idx + 1} de {items.length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {shownAnswered} respondida(s)
            {shownAnswered > 0
              ? ` · ${shownPct}% de erro (${shownWrong}/${shownAnswered})`
              : " · % de erro atualiza a cada resposta"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Questão anterior"
            disabled={idx === 0}
            onClick={() => goTo(idx - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ddd9d1] bg-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima questão"
            disabled={idx >= items.length - 1}
            onClick={() => goTo(idx + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ddd9d1] bg-white disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ebe7df] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-sm font-semibold tracking-wide text-[#b56a3a]">
            QUESTÃO {idx + 1}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-lg border-[#c5d4cc] text-[#1a3d32]"
            disabled={!canMastigar || mastigadoMut.isPending}
            title={
              canMastigar
                ? fonteUrl
                  ? "Ler a fonte e mastigar com a IA"
                  : "Mastigar o fundamento do gabarito com a IA"
                : "Sem fundamento no gabarito para mastigar"
            }
            onClick={() => mastigadoMut.mutate()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {mastigadoMut.isPending ? "Mastigando…" : "Mastigado"}
          </Button>
        </div>

        <p className="mt-3 font-serif text-lg font-semibold leading-snug sm:text-xl">{q.statement}</p>

        {mastigado && q && (
          <MastigadoPanel
            text={mastigado.text}
            fonteUrl={mastigado.url}
            activeTest={mastigado.activeTest}
            subject={q.subject}
            topic={q.topic}
            sourceStatement={q.statement}
          />
        )}

        <div className="mt-6 space-y-2.5">
          {q.alternatives.map((alt) => {
            const isSelected = selected === alt.key;
            const isCorrect = locked && q.answered?.correct && q.answered.choice === alt.key;
            const isWrong = locked && !q.answered?.correct && q.answered?.choice === alt.key;
            return (
              <button
                key={alt.key}
                type="button"
                disabled={locked || pending}
                onClick={() => setDraft(alt.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-left transition-colors",
                  "border-[#e2ddd4] bg-white hover:border-[#c9c3b8]",
                  isSelected && !locked && "border-[#1a3d32] bg-[#1a3d32]/[0.04] ring-1 ring-[#1a3d32]/30",
                  isCorrect && "border-[#1a3d32]/50 bg-[#e8f2ee]",
                  isWrong && "border-destructive/40 bg-destructive/5",
                  locked && !isSelected && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                    isWrong ? "bg-destructive" : "bg-[#1a3d32]",
                  )}
                >
                  {alt.key}
                </span>
                <span className="text-sm leading-snug sm:text-[15px]">{alt.text}</span>
              </button>
            );
          })}
        </div>

        {!locked ? (
          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-xl bg-[#6f7f72] text-base font-medium text-white hover:bg-[#5f6e62]"
            disabled={!draft || pending}
            onClick={confirm}
          >
            {pending ? "Confirmando…" : "Confirmar"}
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            <p
              className={cn(
                "text-center text-sm font-medium",
                q.answered?.correct ? "text-[#1a3d32]" : "text-destructive",
              )}
            >
              {q.answered?.correct ? "Acertou." : "Errou — revise o gabarito e tente de novo depois."}
            </p>
            {idx < items.length - 1 ? (
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#6f7f72] text-base text-white hover:bg-[#5f6e62]"
                onClick={() => goTo(idx + 1)}
              >
                Próxima questão
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#1a3d32] text-base text-white hover:bg-[#143229]"
                disabled={!allAnswered}
                onClick={onDone}
              >
                {allAnswered ? doneLabel : "Responda todas para concluir"}
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 border-t border-[#ebe7df] pt-6">
          <ScratchPad resetKey={q.id} />
        </div>
      </div>
    </div>
  );
}
