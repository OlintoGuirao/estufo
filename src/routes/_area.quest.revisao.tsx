import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { QuestQuiz } from "@/components/tjsp-quest/quest-quiz";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { getQuestPhase, tjspQuestCatalog } from "@/data/tjsp-quest-catalog";
import { dueReviews } from "@/lib/tjsp-quest/progress";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { questPhaseAiService } from "@/services/quest-phase-ai.service";
import type { QuestQuestion } from "@/types/tjsp-quest";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_area/quest/revisao")({
  component: RevisaoPage,
});

function RevisaoPage() {
  const [player, refresh] = useTjspQuest();
  const due = dueReviews(player);
  const [session, setSession] = useState<QuestQuestion[] | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of player.reviews) {
      map.set(r.subjectId, (map.get(r.subjectId) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [player.reviews]);

  const start = () => {
    const qs: QuestQuestion[] = [];
    let firstPhase: string | null = null;
    for (const r of due.slice(0, 8)) {
      const phase =
        questPhaseAiService.peekCached(r.phaseId)?.phase ?? getQuestPhase(r.phaseId);
      const q = phase
        ? [...phase.questions, ...phase.bossQuestions].find((x) => x.id === r.questionId)
        : undefined;
      if (q) {
        qs.push(q);
        firstPhase ??= r.phaseId;
      }
    }
    setSession(qs);
    setPhaseId(firstPhase);
  };

  return (
    <QuestShell title="Revisão de erros" backTo="/quest">
      {!session ? (
        <>
          <QuestCard className="mb-4">
            <p className="font-semibold">Pendentes para hoje</p>
            <p className="mt-1 text-3xl font-black text-[#e85d04]">{due.length}</p>
            <p className="text-sm text-muted-foreground">
              Intervalos SRS: 1, 3, 7, 14 e 30 dias. Acertos removem da fila.
            </p>
            <Button
              className="mt-4 h-12 w-full rounded-2xl bg-[#e85d04] font-bold"
              disabled={!due.length}
              onClick={start}
            >
              Iniciar revisão
            </Button>
          </QuestCard>
          <QuestCard>
            <p className="mb-2 text-sm font-semibold">Erros por matéria</p>
            {bySubject.length ? (
              <ul className="space-y-2">
                {bySubject.map(([sid, n]) => {
                  const name =
                    tjspQuestCatalog.subjects.find((s) => s.id === sid)?.name ?? sid;
                  return (
                    <li key={sid} className="flex justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-bold">{n}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum erro registrado ainda. Bom sinal!</p>
            )}
          </QuestCard>
        </>
      ) : phaseId ? (
        <QuestQuiz
          phaseId={phaseId}
          questions={session}
          mode="revisao"
          onFinish={() => {
            setSession(null);
            setPhaseId(null);
            refresh();
          }}
        />
      ) : null}
    </QuestShell>
  );
}
