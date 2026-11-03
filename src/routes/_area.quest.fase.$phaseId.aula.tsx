import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import type { QuestLessonBlockKind } from "@/types/tjsp-quest";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/quest/fase/$phaseId/aula")({
  component: LessonPage,
});

const KIND_STYLE: Record<QuestLessonBlockKind, { label: string; className: string }> = {
  contexto: { label: "Contextualização", className: "bg-sky-100 text-sky-900" },
  explicacao: { label: "Explicação simples", className: "bg-amber-100 text-amber-900" },
  "base-legal": { label: "Base legal", className: "bg-slate-100 text-slate-900" },
  "texto-legal": {
    label: "Texto legal",
    className: "bg-violet-100 text-violet-950 border-l-4 border-violet-600",
  },
  traducao: { label: "Tradução prática", className: "bg-emerald-100 text-emerald-900" },
  exemplo: { label: "Exemplo cotidiano", className: "bg-orange-100 text-orange-900" },
  prova: { label: "Atenção à prova", className: "bg-rose-100 text-rose-900" },
  memorizar: { label: "Resumo para memorizar", className: "bg-yellow-100 text-yellow-900" },
  "mini-revisao": { label: "Mini revisão", className: "bg-teal-100 text-teal-900" },
};

function LessonPage() {
  const { phaseId } = Route.useParams();
  const { phase, loading, error, mocked } = useQuestPhaseContent(phaseId);
  const nav = useNavigate();
  const [player, refresh] = useTjspQuest();
  const [idx, setIdx] = useState(0);

  const blocks = phase?.lessonBlocks ?? [];
  const block = blocks[idx];
  const prog = phase ? player.phases[phase.id] : undefined;
  const doneIds = new Set(prog?.lessonCompletedBlockIds ?? []);

  const requiredIds = useMemo(
    () => (phase ? phase.lessonBlocks.filter((b) => b.required).map((b) => b.id) : []),
    [phase],
  );
  const allRequiredDone = requiredIds.every((id) => doneIds.has(id));

  if (loading) {
    return (
      <QuestShell title="Resumo" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">Gerando material com IA…</p>
          <p className="text-sm text-muted-foreground">
            Aula no estilo Mastigado + base para questões VUNESP.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  if (!phase || !block) {
    return (
      <QuestShell title="Aula">
        <QuestCard>
          {error ? error : "Conteúdo indisponível."}
        </QuestCard>
      </QuestShell>
    );
  }

  const markAndMaybeAdvance = (nextIdx: number) => {
    tjspQuestStore.completeLessonBlock(phase.id, block.id);
    refresh();
    setIdx(nextIdx);
  };

  const style = KIND_STYLE[block.kind];

  return (
    <QuestShell title="Resumo" backTo={`/quest/fase/${phaseId}`}>
      {mocked && (
        <p className="mb-2 text-center text-[11px] font-semibold text-amber-200">
          Modo demonstrativo — configure GEMINI_API_KEY para material real.
        </p>
      )}
      <div className="mb-3 flex gap-1.5">
        {blocks.map((b, i) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Bloco ${i + 1}`}
            onClick={() => {
              if (i <= idx || doneIds.has(blocks[i - 1]?.id ?? "") || i === 0) setIdx(i);
            }}
            className={cn(
              "h-2 flex-1 rounded-full transition",
              i === idx ? "bg-[#ff9f1c]" : doneIds.has(b.id) ? "bg-emerald-400" : "bg-white/25",
            )}
          />
        ))}
      </div>

      <QuestCard className={cn(block.kind === "texto-legal" && "bg-[#f8f5ff]")}>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            style.className,
          )}
        >
          {style.label}
          {block.required ? "" : " · opcional"}
        </span>
        <h2 className="mt-3 font-display text-xl font-black">{block.title}</h2>
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed whitespace-pre-wrap",
            block.kind === "texto-legal" && "font-serif text-[15px] leading-relaxed",
          )}
        >
          {block.body}
        </p>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Bloco {idx + 1} de {blocks.length} · Material gerado por IA
          {block.kind === "texto-legal" && " · Confira sempre a fonte oficial"}
        </p>
      </QuestCard>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          className="h-12 flex-1 rounded-2xl border-white/30 bg-white/10 text-white hover:bg-white/20"
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        {idx < blocks.length - 1 ? (
          <Button
            className="h-12 flex-1 rounded-2xl bg-[#ff9f1c] font-bold text-[#0b132b] hover:bg-[#ffb703]"
            onClick={() => markAndMaybeAdvance(idx + 1)}
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="h-12 flex-1 rounded-2xl bg-[#06d6a0] font-bold text-[#0b132b] hover:bg-[#05c093]"
            onClick={() => {
              const nextState = tjspQuestStore.completeLessonBlock(phase.id, block.id);
              refresh();
              const ok = nextState.phases[phase.id]?.lessonDone;
              if (ok) {
                nav({ to: "/quest/fase/$phaseId/desafio", params: { phaseId } });
              }
            }}
          >
            <Swords className="h-4 w-4" />
            {allRequiredDone ||
            (block.required &&
              requiredIds.every((id) => doneIds.has(id) || id === block.id))
              ? "Começar desafio"
              : "Concluir bloco"}
          </Button>
        )}
      </div>

      {idx === blocks.length - 1 && !allRequiredDone && (
        <p className="mt-3 text-center text-xs text-amber-200">
          Ainda faltam blocos obrigatórios. Navegue pelos cartões anteriores.
        </p>
      )}

      {(allRequiredDone || prog?.lessonDone) && (
        <p className="mt-3 text-center text-xs text-emerald-200">
          Leitura obrigatória concluída.{" "}
          <Link className="underline" to="/quest/fase/$phaseId/desafio" params={{ phaseId }}>
            Ir ao desafio
          </Link>
        </p>
      )}
    </QuestShell>
  );
}
