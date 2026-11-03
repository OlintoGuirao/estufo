import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { MindNodeData, MindNodeKind } from "@/types";
import { cn } from "@/lib/utils";

export type MindFlowNode = Node<MindNodeData>;

const KIND_CLASS: Record<MindNodeKind, string> = {
  hub: "min-w-[10rem] max-w-[16rem] rounded-[2.5rem] border-[2.5px] border-[#1d3557] bg-[#e85d04] px-5 py-3 text-center font-semibold text-white shadow-md",
  artigo:
    "min-w-[9rem] max-w-[14rem] rounded-md border-2 border-[#1d3557] bg-[#f8f1e3] px-3 py-2.5 text-center text-[#1d3557]",
  conceito:
    "min-w-[10rem] max-w-[17rem] rounded-[1.75rem] border-2 border-[#457b9d] bg-[#a8dadc]/90 px-3 py-2.5 text-center text-[#1d3557]",
  explicacao:
    "min-w-[14rem] max-w-[22rem] -rotate-1 rounded-lg border-2 border-[#6a040f] bg-[#fff3e6] px-3.5 py-2.5 text-left text-[#6a040f] shadow-sm",
  topico:
    "min-w-[11rem] max-w-[18rem] rounded-xl border-2 border-[#1d3557]/40 bg-card px-3 py-2.5 text-sm shadow-sm",
};

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function TopicNode({ data, selected }: NodeProps<MindFlowNode>) {
  const kind: MindNodeKind = data.root ? "hub" : data.kind || "topico";
  const summary = (data.summary ?? data.description ?? "").trim();
  const keywords = (data.keywords ?? data.tags ?? []).filter(Boolean).slice(0, 4);
  const showBody = kind !== "hub" && (!!summary || keywords.length > 0);

  return (
    <div
      className={cn(
        KIND_CLASS[kind],
        selected && "ring-2 ring-ring ring-offset-2",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#1d3557]" />
      <Handle type="target" position={Position.Left} className="!bg-[#1d3557]" />

      <p
        className={cn(
          "leading-snug",
          kind === "hub" || kind === "artigo" ? "font-semibold" : "font-medium",
          kind === "explicacao" && "text-xs font-semibold",
        )}
      >
        {data.title}
      </p>

      {showBody && (
        <div
          className={cn(
            "mt-1.5 space-y-1.5 border-t pt-1.5 text-left font-normal",
            kind === "artigo" && "border-[#1d3557]/20",
            kind === "conceito" && "border-[#1d3557]/25",
            kind === "explicacao" && "border-[#6a040f]/20",
            kind === "topico" && "border-border",
          )}
        >
          {!!summary && (
            <p
              className={cn(
                "text-[11px] leading-snug opacity-90",
                kind === "explicacao" && "text-[11px] leading-relaxed",
                kind === "topico" && "text-[11px]",
              )}
              title={summary}
            >
              {clip(
                summary,
                kind === "explicacao" ? 320 : kind === "topico" ? 160 : 100,
              )}
            </p>
          )}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none",
                    kind === "artigo" && "bg-[#1d3557]/10 text-[#1d3557]",
                    kind === "conceito" && "bg-white/70 text-[#1d3557]",
                    kind === "explicacao" && "bg-[#6a040f]/10 text-[#6a040f]",
                    kind === "topico" && "bg-muted text-muted-foreground",
                  )}
                >
                  {clip(kw, 22)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-[#1d3557]" />
      <Handle type="source" position={Position.Right} className="!bg-[#1d3557]" />
    </div>
  );
}

export const mindMapNodeTypes = { topic: TopicNode };
