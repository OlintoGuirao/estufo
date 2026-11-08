import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Reinicia o canvas ao mudar (ex.: id da questão). */
  resetKey?: string;
};

type Tool = "pencil" | "eraser";

/** Bloco de rascunho com desenho por mouse/toque/caneta. */
export function ScratchPad({ className, resetKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef<Tool>("pencil");
  const [tool, setTool] = useState<Tool>("pencil");
  const [ready, setReady] = useState(false);

  const setActiveTool = (next: Tool) => {
    toolRef.current = next;
    setTool(next);
  };

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setReady(true);
  };

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    clear();
    setActiveTool("pencil");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const erasing = toolRef.current === "eraser";
    ctx.save();
    if (erasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = 14 + pressure * 10;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#1a3d32";
      ctx.lineWidth = 1.2 + pressure * 2.8;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    stroke(p, p, pressure);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    stroke(last.current, p, pressure);
    last.current = p;
  };

  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    resize();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-[#1a3d32] dark:text-emerald-300">Bloco de rascunho</h3>
          <p className="text-[11px] text-muted-foreground">
            {tool === "eraser"
              ? "Borracha ativa · passe por cima do traço para apagar"
              : "Caneta ou dedo · pressão da caneta quando disponível"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {tool === "pencil" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setActiveTool("eraser")}
            >
              <Eraser className="h-3.5 w-3.5" />
              Borracha
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setActiveTool("pencil")}
            >
              <Pencil className="h-3.5 w-3.5" />
              Lápis
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={clear}>
            Limpar
          </Button>
        </div>
      </div>
      <div
        className="relative h-48 overflow-hidden rounded-xl border border-[#d8d5ce] bg-[#faf9f6] sm:h-56"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #e5e2da 27px, #e5e2da 28px)",
          backgroundPosition: "0 12px",
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full touch-none",
            tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
          )}
          aria-label={tool === "eraser" ? "Borracha no rascunho" : "Área de rascunho"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {!ready && <span className="sr-only">Carregando rascunho</span>}
      </div>
    </div>
  );
}
