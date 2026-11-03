import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/common";
import { countWords } from "@/lib/redacao/ai";
import { approvalTrailService } from "@/services/approval-trail.service";
import { correctRedacaoFn } from "@/services/redacao.fns";
import { redacaoStore } from "@/services/redacao-store";

export const Route = createFileRoute("/_area/redacao/$essayId")({
  head: () => ({
    meta: [{ title: "Escrever redação — Estufoo" }],
  }),
  component: RedacaoEssayPage,
});

function RedacaoEssayPage() {
  const { essayId } = Route.useParams();
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [tick, setTick] = useState(0);
  void tick;

  useQuery({
    queryKey: ["redacao", "hydrate", essayId],
    queryFn: async () => {
      await approvalTrailService.hydrate();
      return redacaoStore.hydrate();
    },
  });

  const essay = redacaoStore.getEssay(essayId);

  useEffect(() => {
    if (essay) setBody(essay.body);
  }, [essay?.id, essay?.body]);

  useEffect(() => {
    if (!essay) return;
    if (essay.status === "corrigida") return;
    const t = window.setTimeout(() => {
      try {
        redacaoStore.saveDraft(essayId, body);
      } catch {
        /* ignore */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [body, essayId, essay?.status]);

  const correct = useMutation({
    mutationFn: async () => {
      if (!essay) throw new Error("Redação não encontrada.");
      const words = countWords(body);
      if (words < 80) throw new Error("Escreva pelo menos cerca de 80 palavras antes de concluir.");
      redacaoStore.saveDraft(essayId, body);
      const trail = approvalTrailService.get();
      return correctRedacaoFn({
        data: {
          essayId,
          contestName: trail?.contestName,
          board: trail?.board,
          themeTitle: essay.themeTitle,
          themePrompt: essay.themePrompt,
          essayBody: body,
          focusPoints: essay.focusPoints.map((p) => ({
            id: p.id,
            area: p.area,
            tip: p.tip,
          })),
        },
      });
    },
    onSuccess: (res) => {
      redacaoStore.applyCorrection(essayId, res.correction, res.resolvedFocusAreas);
      setTick((t) => t + 1);
      toast.success(
        res.mocked
          ? "Correção demonstrativa salva. Os pontos a melhorar vão para a próxima."
          : "Redação corrigida. Pontos a melhorar salvos para a próxima.",
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha na correção.");
    },
  });

  if (!essay) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Redação não encontrada.</p>
        <Button asChild variant="outline">
          <Link to="/redacao">Voltar</Link>
        </Button>
      </div>
    );
  }

  const words = countWords(body);
  const done = essay.status === "corrigida";
  const correction = redacaoStore.getEssay(essayId)?.correction;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/redacao">
            <ArrowLeft className="h-4 w-4" />
            Redação
          </Link>
        </Button>
      </div>

      <PageHeader
        title={essay.themeTitle}
        description={done ? "Correção salva" : "Escreva e conclua para a IA corrigir"}
      />

      <Panel title="Proposta">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{essay.themePrompt}</p>
        {essay.themeContext && (
          <p className="mt-3 text-xs text-muted-foreground">{essay.themeContext}</p>
        )}
      </Panel>

      {essay.focusPoints.length > 0 && (
        <Panel title="Foco desta redação">
          <p className="mb-2 text-sm text-muted-foreground">
            Pontos carregados da(s) correção(ões) anterior(es):
          </p>
          <ul className="space-y-2">
            {essay.focusPoints.map((p) => (
              <li key={p.id} className="flex gap-2 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">{p.area}: </span>
                  {p.tip}
                  {p.status === "melhorou" && (
                    <Badge className="ml-2" variant="secondary">
                      melhorou
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Seu texto"
        action={<span className="text-xs text-muted-foreground">{words} palavras</span>}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={done || correct.isPending}
          placeholder="Escreva sua dissertação argumentativa aqui…"
          className="min-h-[320px] resize-y text-base leading-relaxed"
        />
        {!done && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                try {
                  redacaoStore.saveDraft(essayId, body);
                  toast.success("Rascunho salvo.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
                }
              }}
              variant="outline"
            >
              Salvar rascunho
            </Button>
            <Button onClick={() => correct.mutate()} disabled={correct.isPending || words < 80}>
              {correct.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Concluir e corrigir
            </Button>
          </div>
        )}
      </Panel>

      {done && correction && (
        <Panel title={`Correção — ${correction.score}/${correction.maxScore}`}>
          <p className="mb-4 text-sm leading-relaxed">{correction.overallFeedback}</p>

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {correction.competencies.map((c) => (
              <div key={c.name} className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-2 font-medium">
                  <span>{c.name}</span>
                  <span>
                    {c.score}/{c.max}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{c.feedback}</p>
              </div>
            ))}
          </div>

          {correction.strengths.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-medium">Pontos fortes</p>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {correction.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1 text-sm font-medium">Para levar na próxima</p>
            <ul className="space-y-2">
              {correction.improvements.map((p) => (
                <li key={p.id} className="rounded-lg border border-dashed px-3 py-2 text-sm">
                  <span className="font-medium">{p.area}: </span>
                  {p.tip}
                </li>
              ))}
            </ul>
          </div>

          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate({ to: "/redacao" })}
          >
            Voltar aos temas
          </Button>
        </Panel>
      )}
    </div>
  );
}
