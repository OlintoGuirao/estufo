import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, ListSkeleton, Panel } from "@/components/common";
import { errMsg } from "@/components/forms";
import { FlashcardReview } from "@/components/mind-map/flashcard-review";
import { PracticeQuestionReview } from "@/components/mind-map/practice-question-review";
import { mindMapNodeTypes, type MindFlowNode } from "@/components/mind-map/topic-nodes";
import { mindMapsService, tutorService } from "@/services";
import { syncStudyMindPack } from "@/services/study-mind-pack-db";
import type { Flashcard, MindNodeKind, MindPracticeQuestion } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/mapas/$id")({
  head: () => ({
    meta: [{ title: "Editor de mapa mental — Estufoo" }],
  }),
  component: Editor,
});

const uid = () => Math.random().toString(36).slice(2, 10);

type Tab = "mapa" | "questoes" | "flashcards" | "resumo";

function Editor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mind-map", id], queryFn: () => mindMapsService.get(id) });
  const [nodes, setNodes] = useState<MindFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [practiceQs, setPracticeQs] = useState<MindPracticeQuestion[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mapa");

  useEffect(() => {
    if (!q.data) return;
    setNodes(
      q.data.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: n.data,
        type: "topic",
      })),
    );
    setEdges(
      q.data.links.map((l) => ({
        id: l.id,
        source: l.source,
        target: l.target,
        label: l.label,
        type: "default",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: "#1d3557", strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: "#457b9d" },
        labelBgStyle: { fill: "#f8f1e3", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      })),
    );
    setCards(q.data.flashcards ?? []);
    setPracticeQs(q.data.practiceQuestions ?? []);
  }, [q.data]);

  const onNodesChange = useCallback(
    (c: NodeChange<MindFlowNode>[]) => setNodes((n) => applyNodeChanges(c, n)),
    [],
  );
  const onEdgesChange = useCallback(
    (c: EdgeChange[]) => {
      c.forEach((x) => x.type === "remove" && mindMapsService.removeLink(id, x.id));
      setEdges((e) => applyEdgeChanges(c, e));
    },
    [id],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      const link = {
        id: uid(),
        source: c.source!,
        target: c.target!,
      };
      mindMapsService.addLink(id, link);
      setEdges((e) =>
        addEdge(
          {
            ...link,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: "#1d3557", strokeWidth: 1.5 },
          },
          e,
        ),
      );
    },
    [id],
  );

  const persistPayload = () => ({
    nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    links: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(typeof e.label === "string" && e.label ? { label: e.label } : {}),
    })),
    flashcards: cards,
    practiceQuestions: practiceQs,
  });

  const save = useMutation({
    mutationFn: async () => {
      const updated = await mindMapsService.update(id, persistPayload());
      syncStudyMindPack(updated);
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      toast.success("Projeto salvo.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: () => mindMapsService.remove(id),
    onSuccess: () => nav({ to: "/mapas" }),
  });

  const genCards = useMutation({
    mutationFn: async () => {
      const selectedNodes = sel
        ? nodes.filter((n) => n.id === sel)
        : nodes.filter((n) => !n.data.root).slice(0, 12);
      if (!selectedNodes.length) throw new Error("Selecione um nó ou tenha tópicos no mapa.");
      return tutorService.generateFlashcardsFromNodes({
        subject: q.data!.subject,
        mapTitle: q.data!.title,
        count: Math.min(10, Math.max(4, selectedNodes.length)),
        nodes: selectedNodes.map((n) => ({
          id: n.id,
          title: n.data.title,
          summary: n.data.summary ?? "",
          keywords: n.data.keywords ?? [],
        })),
      });
    },
    onSuccess: (r) => {
      const added: Flashcard[] = r.flashcards.map((c, i) => ({
        id: `fc_${uid()}_${i}`,
        front: c.front,
        back: c.back,
        topic: c.topic,
        tags: c.tags,
        nodeId: c.nodeId ?? null,
        status: "novo",
      }));
      setCards((prev) => [...prev, ...added]);
      setTab("flashcards");
      toast.success(
        r.mocked
          ? `${added.length} flashcards (mock) adicionados.`
          : `${added.length} flashcards gerados a partir do mapa.`,
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  /** Cria um card-filho por item da lista do card selecionado (pessoais, possessivos…). */
  const explainItems = useMutation({
    mutationFn: async () => {
      const parent = nodes.find((n) => n.id === sel);
      if (!parent) throw new Error("Clique primeiro no card que você quer detalhar.");
      const childIds = new Set(edges.filter((e) => e.source === parent.id).map((e) => e.target));
      const existingChildren = nodes.filter((n) => childIds.has(n.id)).map((n) => n.data.title);
      const r = await tutorService.explainNodeItems({
        subject: q.data?.subject ?? "",
        mapTitle: q.data?.title ?? "",
        nodeTitle: parent.data.title,
        nodeSummary: parent.data.summary ?? parent.data.description ?? "",
        existingChildren,
        material: (q.data?.material ?? "").slice(0, 20_000),
      });
      return { parent, ...r };
    },
    onSuccess: ({ parent, items, mocked }) => {
      const gapX = 260;
      const startX = parent.position.x - ((items.length - 1) * gapX) / 2;
      const created: MindFlowNode[] = items.map((it, i) => ({
        id: uid(),
        type: "topic",
        position: { x: startX + i * gapX, y: parent.position.y + 260 },
        data: {
          title: it.title,
          summary: it.summary,
          keywords: it.keywords,
          kind: "explicacao",
          mastery: "nao-estudado",
        },
      }));
      for (const n of created) {
        mindMapsService.addNode(id, { id: n.id, position: n.position, data: n.data });
      }
      setNodes((x) => [...x, ...created]);
      for (const n of created) {
        onConnect({ source: parent.id, target: n.id, sourceHandle: null, targetHandle: null });
      }
      toast.success(
        mocked
          ? `${created.length} cards (demonstração) criados.`
          : `${created.length} cards explicando cada item foram criados.`,
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const addTopic = (kind: MindNodeKind = "topico") => {
    const parent = nodes.find((n) => n.id === sel) ?? nodes.find((n) => n.data.root);
    const n: MindFlowNode = {
      id: uid(),
      type: "topic",
      position: {
        x: (parent?.position.x ?? 0) + 220,
        y: (parent?.position.y ?? 0) + 90,
      },
      data: {
        title: kind === "artigo" ? "Art. N / Lei N/AAAA" : "Novo tópico",
        mastery: "nao-estudado",
        kind,
        summary:
          kind === "artigo"
            ? "Preencha o número do artigo ou o número e a data da lei."
            : "",
        keywords: kind === "artigo" ? ["Art.", "Lei"] : [],
      },
    };
    mindMapsService.addNode(id, { id: n.id, position: n.position, data: n.data });
    setNodes((x) => [...x, n]);
    if (parent) {
      onConnect({
        source: parent.id,
        target: n.id,
        sourceHandle: null,
        targetHandle: null,
      });
    }
    setSel(n.id);
  };

  if (q.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "mapa", label: "Mapa mental" },
    { id: "questoes", label: `Questões (${practiceQs.length})` },
    { id: "flashcards", label: `Flashcards (${cards.length})` },
    { id: "resumo", label: "Resumo" },
  ];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar">
          <Link to="/mapas">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight">{q.data!.title}</h1>
          <p className="text-xs text-muted-foreground">{q.data!.subject}</p>
        </div>
        {q.data!.mocked && <Badge variant="secondary">Mock</Badge>}
        {q.data!.aiGenerated && (
          <Badge variant="outline">
            <Sparkles className="mr-1 h-3 w-3" />
            Revisar conteúdo da IA
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addTopic("artigo")}>
            <Plus /> Artigo
          </Button>
          <Button variant="outline" size="sm" onClick={() => addTopic("conceito")}>
            <Plus /> Conceito
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!sel || explainItems.isPending}
            title={
              sel
                ? "A IA cria um card explicando cada tipo/item citado neste card"
                : "Clique num card do mapa primeiro"
            }
            onClick={() => explainItems.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {explainItems.isPending ? "Explicando…" : "Explicar itens do card"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={genCards.isPending}
            onClick={() => genCards.mutate()}
          >
            <Layers className="h-4 w-4" />
            {genCards.isPending ? "Gerando…" : "Cards dos nós"}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir"
            onClick={() => confirm("Excluir este projeto?") && remove.mutate()}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <Panel className="overflow-y-auto">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {q.data!.summary || "Sem resumo estruturado neste projeto."}
          </p>
          {!!q.data!.warnings?.length && (
            <ul className="mt-4 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
              {q.data!.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {q.data!.material && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Material de origem</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">
                {q.data!.material.slice(0, 8000)}
              </pre>
            </details>
          )}
        </Panel>
      )}

      {tab === "questoes" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PracticeQuestionReview questions={practiceQs} mapId={id} />
          <p className="mt-2 text-xs text-muted-foreground">
            Questões de treino geradas por IA a partir do material — não substituem itens oficiais de
            banca. Mapas antigos: gere um projeto novo para obter questões.
          </p>
        </div>
      )}

      {tab === "flashcards" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FlashcardReview
            cards={cards}
            onUpdate={(next) => {
              setCards(next);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Clique em Salvar para gravar o progresso dos cartões.
          </p>
        </div>
      )}

      {tab === "mapa" && (
        <div
          // light-island: o caderno do mapa mental fica sempre claro (papel), mesmo no tema escuro.
          className="light-island min-h-0 flex-1 overflow-hidden rounded-xl border"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(29,53,87,0.06) 28px), #fbf7ef",
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={mindMapNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSel(n.id)}
            onPaneClick={() => setSel(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={28} color="transparent" />
            <Controls />
            <MiniMap
              nodeStrokeColor="#1d3557"
              nodeColor={(n) => {
                const d = n.data as { root?: boolean; kind?: string } | undefined;
                if (d?.root) return "#e85d04";
                if (d?.kind === "artigo") return "#f8f1e3";
                return "#a8dadc";
              }}
              maskColor="rgb(251,247,239,0.7)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
