import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/common";
import { VunespProposal } from "@/components/redacao/vunesp-proposal";
import { LinedEssayEditor } from "@/components/redacao/lined-essay-editor";
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

  // ---- Progresso salvo automaticamente --------------------------------------
  // 1) No aparelho: ~0,4 s depois de parar de digitar (não perde nada ao sair).
  // 2) No banco: ~3 s depois (agrupa), e na hora ao sair/trocar de aba/app.
  const dirtyRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [saveState, setSaveState] = useState<
    "idle" | "local" | "saving" | "cloud" | "offline"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Carrega o texto salvo. Só sobrescreve o que está na tela se o aluno ainda
  // não digitou (o banco pode chegar depois e não pode apagar o que ele escreveu).
  useEffect(() => {
    if (!essay) return;
    if (loadedIdRef.current !== essay.id) {
      loadedIdRef.current = essay.id;
      dirtyRef.current = false;
      setBody(essay.body);
      return;
    }
    if (!dirtyRef.current && essay.body !== bodyRef.current) setBody(essay.body);
  }, [essay?.id, essay?.body]);

  const canSave = !!essay && essay.status !== "corrigida";

  const flushLocal = useCallback(() => {
    if (!canSave || !dirtyRef.current) return false;
    redacaoStore.saveDraftLocal(essayId, bodyRef.current);
    return true;
  }, [canSave, essayId]);

  const syncCloud = useCallback(async () => {
    if (!canSave) return;
    setSaveState("saving");
    const ok = await redacaoStore.syncDraftNow();
    setSaveState(ok ? "cloud" : "offline");
    setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }, [canSave]);

  useEffect(() => {
    if (!canSave || !dirtyRef.current) return;
    const local = window.setTimeout(() => {
      if (flushLocal()) setSaveState((st) => (st === "saving" ? st : "local"));
    }, 400);
    const cloud = window.setTimeout(() => void syncCloud(), 3000);
    return () => {
      window.clearTimeout(local);
      window.clearTimeout(cloud);
    };
  }, [body, canSave, flushLocal, syncCloud]);

  // Saiu da página, trocou de aba ou fechou o app: grava tudo na hora.
  useEffect(() => {
    const flushAll = () => {
      if (flushLocal()) void redacaoStore.syncDraftNow();
    };
    const onHidden = () => document.visibilityState === "hidden" && flushAll();
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onHidden);
      flushAll(); // saindo da tela pelo menu / botão Voltar
    };
  }, [flushLocal]);

  const onChangeBody = (v: string) => {
    dirtyRef.current = true;
    setBody(v);
  };

  const saveLabel =
    saveState === "saving"
      ? "Salvando…"
      : saveState === "cloud"
        ? `Salvo na nuvem${savedAt ? ` às ${savedAt}` : ""}`
        : saveState === "offline"
          ? "Salvo neste aparelho (sem conexão com o banco)"
          : saveState === "local"
            ? "Salvo neste aparelho"
            : null;

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
        title="Proposta de redação"
        description={
          done
            ? "Correção salva"
            : "Leia os textos motivadores como na prova VUNESP e escreva sua dissertação"
        }
      />

      <VunespProposal
        title={essay.themeTitle}
        prompt={essay.themePrompt}
        supportTexts={
          essay.supportTexts?.length
            ? essay.supportTexts
            : redacaoStore.getTheme(essay.themeId)?.supportTexts
        }
      />

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

      <Panel title="Seu texto">
        <LinedEssayEditor
          value={body}
          onChange={onChangeBody}
          disabled={done || correct.isPending}
          placeholder="Escreva sua dissertação argumentativa aqui…"
          status={
            <span className="text-xs text-muted-foreground">
              {words} palavras
              {saveLabel && (
                <span className={saveState === "offline" ? "ml-2 text-amber-600" : "ml-2"}>
                  · {saveLabel}
                </span>
              )}
            </span>
          }
          actions={
            !done ? (
              <>
                <Button
                  onClick={() => {
                    try {
                      dirtyRef.current = true;
                      flushLocal();
                      void syncCloud();
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
              </>
            ) : undefined
          }
        />
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
