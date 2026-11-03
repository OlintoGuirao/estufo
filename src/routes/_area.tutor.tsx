import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { errMsg } from "@/components/forms";
import { aggregateWrongByTopic } from "@/lib/study-cycle";
import { questionsService, reviewsService, tutorService } from "@/services";
import { toast } from "sonner";

export const Route = createFileRoute("/_area/tutor")({
  head: () => ({
    meta: [
      { title: "Tutor IA — Estufoo" },
      { name: "description", content: "Tutor de estudos com Gemini Flash-Lite." },
    ],
  }),
  component: TutorPage,
});

function TutorPage() {
  const status = useQuery({
    queryKey: ["tutor-status"],
    queryFn: () => tutorService.status(),
    staleTime: 15_000,
  });
  const questions = useQuery({
    queryKey: ["questions", { status: "todas", page: 1 }],
    queryFn: () => questionsService.list({ status: "todas", page: 1 }),
  });
  // list first page only is weak — pull more pages via a wider request isn't available; use answered from page + difficulty store
  const reviews = useQuery({ queryKey: ["reviews"], queryFn: () => reviewsService.list() });

  const advice = useMutation({
    mutationFn: async () => {
      const allQ = await questionsService.list({ status: "todas", page: 1 });
      // mock pageSize 5 — fetch a few pages for local stats
      const pages = Math.min(5, Math.max(1, Math.ceil(allQ.total / allQ.pageSize)));
      const items = [...allQ.items];
      for (let p = 2; p <= pages; p++) {
        const chunk = await questionsService.list({ status: "todas", page: p });
        items.push(...chunk.items);
      }
      const wrongByTopic = aggregateWrongByTopic(items);
      const today = new Date().toISOString().slice(0, 10);
      const overdue = (reviews.data ?? [])
        .filter((r) => r.dueDate <= today)
        .map((r) => ({ subject: r.subject, topic: r.topic, dueDate: r.dueDate }));
      const difficultyEvents = tutorService.listDifficulties().map((d) => ({
        subject: d.subject,
        topic: d.topic,
        code: d.code,
        at: d.at,
      }));
      return tutorService.recommendations({
        wrongByTopic,
        difficultyEvents,
        overdueReviews: overdue,
        lateSessionsCount: 0,
      });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <PageHeader
        title="Tutor de estudos (IA)"
        description="Gemini Flash-Lite no servidor — dicas e treino sem enviar o gabarito ao modelo."
        actions={
          <Button variant="outline" asChild>
            <Link to="/questoes">Ir às questões</Link>
          </Button>
        }
      />

      {status.isLoading ? (
        <ListSkeleton />
      ) : status.error ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <Panel className="mb-6" title="Status do tutor (Gemini)">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={status.data?.available ? "default" : "destructive"}>
              {status.data?.available ? "Serviço alcançável" : "Indisponível"}
            </Badge>
            <Badge variant={status.data?.modelReady ? "secondary" : "outline"}>
              Modelo {status.data?.modelReady ? "ok" : "ausente"}
            </Badge>
            {status.data?.useMock && <Badge variant="outline">MOCK explícito</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{status.data?.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Endpoint: {status.data?.baseUrl} · modelo: {status.data?.model}
          </p>
          {!status.data?.available && (
            <p className="mt-3 text-sm">
              Defina <code className="text-xs">GEMINI_API_KEY</code> no <code className="text-xs">.env</code>{" "}
              (modelo padrão: {status.data?.model ?? "gemini-3.5-flash-lite"}). Sem chave, o tutor
              pode cair no fallback Ollama se estiver configurado.
            </p>
          )}
        </Panel>
      )}

      <Panel
        title="Recomendações de estudo"
        action={
          <Button
            size="sm"
            disabled={advice.isPending || questions.isLoading}
            onClick={() => advice.mutate()}
          >
            <GraduationCap className="h-4 w-4" />
            Atualizar
          </Button>
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Baseadas em erros/revisões/dificuldades locais (regras). Um único erro não vira
          diagnóstico recorrente. Horas estudadas não medem aprendizado. Alterações no plano exigem
          confirmação na tela do plano.
        </p>
        {advice.isPending ? (
          <ListSkeleton count={3} />
        ) : advice.data ? (
          <ul className="space-y-3">
            {advice.data.items.map((item, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  {item.provisional && <Badge variant="outline">Provisória</Badge>}
                </div>
                <p className="mt-1 text-muted-foreground">{item.reason}</p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {item.evidence.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Gere recomendações"
            description="Usa dados reais disponíveis no mock/localStorage deste navegador."
            action={
              <Button onClick={() => advice.mutate()} disabled={advice.isPending}>
                Gerar agora
              </Button>
            }
          />
        )}
        {advice.data && <p className="mt-3 text-xs text-muted-foreground">{advice.data.note}</p>}
      </Panel>
    </>
  );
}
