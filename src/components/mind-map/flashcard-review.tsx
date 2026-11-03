import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Panel } from "@/components/common";
import type { Flashcard, FlashcardStatus } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  cards: Flashcard[];
  onUpdate: (cards: Flashcard[]) => void;
};

export function FlashcardReview({ cards, onUpdate }: Props) {
  const queue = useMemo(
    () => cards.filter((c) => c.status === "novo" || c.status === "revisar"),
    [cards],
  );
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = queue[idx] ?? null;

  const mark = (status: FlashcardStatus) => {
    if (!current) return;
    const next = cards.map((c) => (c.id === current.id ? { ...c, status } : c));
    onUpdate(next);
    setFlipped(false);
    setIdx((i) => {
      const remaining = next.filter((c) => c.status === "novo" || c.status === "revisar");
      if (!remaining.length) return 0;
      return Math.min(i, remaining.length - 1);
    });
  };

  if (!cards.length) {
    return (
      <EmptyState
        title="Nenhum flashcard"
        description="Gere cartões a partir do material ou dos nós do mapa."
      />
    );
  }

  const remembered = cards.filter((c) => c.status === "lembrei").length;
  const toReview = cards.filter((c) => c.status === "revisar").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{cards.length} cartões</Badge>
        <Badge variant="secondary">{remembered} lembrei</Badge>
        <Badge variant="outline">{toReview} revisar</Badge>
        <Badge variant="outline">{queue.length} na fila</Badge>
      </div>

      {!current ? (
        <Panel className="text-center">
          <p className="font-medium">Fila concluída nesta sessão.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Você pode resetar os marcados como “lembrei” para treinar de novo.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              onUpdate(cards.map((c) => ({ ...c, status: "novo" as const })));
              setIdx(0);
              setFlipped(false);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar revisão
          </Button>
        </Panel>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={cn(
              "flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border-2 border-[#1d3557]/30 bg-[#f8f1e3] p-6 text-center shadow-sm transition",
              flipped && "border-[#e85d04]/50 bg-white",
            )}
            aria-label={flipped ? "Mostrar frente" : "Virar cartão"}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {flipped ? "Verso — resposta" : "Frente — lembre"}
            </p>
            <p className="text-lg font-medium leading-relaxed text-[#1d3557]">
              {flipped ? current.back : current.front}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {current.topic}
              {current.tags.length ? ` · ${current.tags.join(", ")}` : ""}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Toque para virar</p>
          </button>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              disabled={!flipped}
              onClick={() => mark("revisar")}
            >
              <X className="h-4 w-4" /> Preciso revisar
            </Button>
            <Button disabled={!flipped} onClick={() => mark("lembrei")}>
              <Check className="h-4 w-4" /> Lembrei
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Cartão {Math.min(idx + 1, queue.length)} de {queue.length}
          </p>
        </>
      )}

      <Panel title="Todos os cartões" className="max-h-64 overflow-y-auto">
        <ul className="space-y-2 text-sm">
          {cards.map((c) => (
            <li key={c.id} className="rounded-lg border px-3 py-2">
              <p className="font-medium">{c.front}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{c.back}</p>
              <Badge variant="outline" className="mt-1 text-[10px]">
                {c.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
