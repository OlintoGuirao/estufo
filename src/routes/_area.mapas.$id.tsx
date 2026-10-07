import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  Background, Controls, ReactFlow, addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, ListSkeleton, MasteryBadge, masteryMeta } from "@/components/common";
import { Field, NativeSelect } from "@/components/forms";
import { mindMapsService } from "@/services";
import type { Mastery, MindNodeData } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/mapas/$id")({
  head: () => ({ meta: [{ title: "Editor de mapa mental — AprovaMind" }, { name: "description", content: "Edite seu mapa mental." }, { property: "og:title", content: "Mapa mental — AprovaMind" }, { property: "og:description", content: "Edite seu mapa mental." }] }),
  component: Editor,
});

type N = Node<MindNodeData>;

function TopicNode({ data, selected }: NodeProps<N>) {
  return (
    <div className={cn("min-w-36 rounded-xl border-2 bg-card px-3 py-2 text-sm shadow-card", data.root && "bg-primary text-primary-foreground", selected && "ring-2 ring-ring")}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", masteryMeta[data.mastery].dot)} />{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { topic: TopicNode };
const uid = () => Math.random().toString(36).slice(2, 10);

function Editor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["mind-map", id], queryFn: () => mindMapsService.get(id) });
  const [nodes, setNodes] = useState<N[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setNodes(q.data.nodes.map((n) => ({ id: n.id, position: n.position, data: n.data, type: "topic" })));
    setEdges(q.data.links.map((l) => ({ id: l.id, source: l.source, target: l.target })));
  }, [q.data]);

  const onNodesChange = useCallback((c: NodeChange<N>[]) => setNodes((n) => applyNodeChanges(c, n)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => {
    c.forEach((x) => x.type === "remove" && mindMapsService.removeLink(id, x.id));
    setEdges((e) => applyEdgeChanges(c, e));
  }, [id]);
  const onConnect = useCallback((c: Connection) => {
    const link = { id: uid(), source: c.source, target: c.target };
    mindMapsService.addLink(id, link);
    setEdges((e) => addEdge(link, e));
  }, [id]);

  const save = useMutation({
    mutationFn: () => mindMapsService.update(id, { nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })), links: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) }),
    onSuccess: () => toast.success("Mapa salvo."),
  });
  const remove = useMutation({ mutationFn: () => mindMapsService.remove(id), onSuccess: () => nav({ to: "/mapas" }) });

  const addTopic = () => {
    const parent = nodes.find((n) => n.id === sel) ?? nodes.find((n) => n.data.root);
    const n: N = { id: uid(), type: "topic", position: { x: (parent?.position.x ?? 0) + 240, y: (parent?.position.y ?? 0) + 80 }, data: { title: "Novo tópico", mastery: "nao-estudado" } };
    mindMapsService.addNode(id, { id: n.id, position: n.position, data: n.data });
    setNodes((x) => [...x, n]);
    if (parent) onConnect({ source: parent.id, target: n.id, sourceHandle: null, targetHandle: null });
    setSel(n.id);
  };
  const selected = nodes.find((n) => n.id === sel);
  const patch = (d: Partial<MindNodeData>) => {
    if (!selected) return;
    setNodes((x) => x.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...d } } : n)));
    mindMapsService.updateNode(id, selected.id, { data: { ...selected.data, ...d } });
  };
  const delNode = () => {
    if (!selected || selected.data.root) return;
    mindMapsService.removeNode(id, selected.id);
    setNodes((x) => x.filter((n) => n.id !== selected.id));
    setEdges((x) => x.filter((e) => e.source !== selected.id && e.target !== selected.id));
    setSel(null);
  };

  if (q.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar"><Link to="/mapas"><ArrowLeft /></Link></Button>
        <h1 className="font-display text-xl font-semibold">{q.data!.title}</h1>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={addTopic}><Plus />Tópico</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          <Button variant="ghost" size="icon" aria-label="Excluir mapa" onClick={() => confirm("Excluir este mapa?") && remove.mutate()}><Trash2 /></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex-1 overflow-hidden rounded-xl border bg-card">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSel(n.id)} onPaneClick={() => setSel(null)} fitView>
            <Background /><Controls />
          </ReactFlow>
        </div>
        {selected && (
          <aside className="hidden w-72 shrink-0 space-y-3 overflow-y-auto rounded-xl border bg-card p-4 md:block">
            <MasteryBadge mastery={selected.data.mastery} />
            <Field label="Título" htmlFor="nt"><Input id="nt" value={selected.data.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
            <Field label="Domínio" htmlFor="nm">
              <NativeSelect id="nm" value={selected.data.mastery} onChange={(e) => patch({ mastery: e.target.value as Mastery })}>
                {Object.entries(masteryMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Resumo" htmlFor="ns"><Textarea id="ns" rows={3} value={selected.data.summary ?? ""} onChange={(e) => patch({ summary: e.target.value })} /></Field>
            <Field label="Anotações" htmlFor="nn"><Textarea id="nn" rows={4} value={selected.data.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} /></Field>
            {!selected.data.root && <Button variant="outline" className="w-full" onClick={delNode}><Trash2 />Remover tópico</Button>}
          </aside>
        )}
      </div>
    </div>
  );
}
