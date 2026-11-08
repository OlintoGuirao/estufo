import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Altura de cada linha da "folha" (px). Texto e pauta usam o mesmo valor. */
const LINE_PX = 32;
const PAD_TOP = 8;
/** Largura de texto que equivale a uma linha da folha oficial (~75 caracteres). */
const SHEET_WIDTH_PX = 640;

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Linhas da folha oficial (mostra o contador e marca o limite). */
  maxLines?: number;
  /** Ex.: "120 palavras" — aparece no topo e na tela cheia. */
  status?: ReactNode;
  /** Botões (Salvar / Concluir) — repetidos na barra da tela cheia. */
  actions?: ReactNode;
  title?: string;
};

/**
 * Editor de redação com pauta numerada (como a folha de prova),
 * botão de tela cheia e botão para diminuir.
 */
export function LinedEssayEditor({
  value,
  onChange,
  disabled,
  placeholder,
  maxLines = 30,
  status,
  actions,
  title = "Seu texto",
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [usedLines, setUsedLines] = useState(0);
  const [visibleLines, setVisibleLines] = useState(maxLines);

  // Conta linhas REAIS (com quebra automática) num "espelho" invisível com a
  // mesma largura e fonte — sem mexer no textarea (não perde a rolagem).
  const mirrorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = areaRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      // Largura fixa de "folha de prova": a contagem é a mesma no celular e no PC
      // (a numeração ao lado acompanha a tela; o contador estima a folha).
      mirror.style.width = `${SHEET_WIDTH_PX}px`;
      mirror.style.font = cs.font;
      mirror.style.letterSpacing = cs.letterSpacing;
      mirror.style.paddingLeft = "0px";
      mirror.style.paddingRight = "0px";
      // "\u200b" garante que a última linha vazia (Enter no fim) conte.
      mirror.textContent = `${value}\u200b`;
      const used = value.trim() ? Math.max(1, Math.round(mirror.scrollHeight / LINE_PX)) : 0;
      setUsedLines(used);
      const fit = Math.floor((el.clientHeight - PAD_TOP * 2) / LINE_PX);
      const screenLines = Math.round((el.scrollHeight - PAD_TOP * 2) / LINE_PX);
      setVisibleLines(Math.max(maxLines, screenLines + 2, fit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, maxLines, full]);

  // Esc sai da tela cheia; trava a rolagem da página por baixo.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    areaRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [full]);

  const syncScroll = () => {
    if (gutterRef.current && areaRef.current) {
      gutterRef.current.scrollTop = areaRef.current.scrollTop;
    }
  };

  const over = usedLines > maxLines;

  const sheet = (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-md border bg-[#fffdf8]",
        full ? "min-h-0 flex-1" : "",
        over ? "border-destructive/60" : "border-input",
      )}
    >
      {/* Numeração das linhas */}
      <div
        ref={gutterRef}
        aria-hidden
        className="absolute inset-y-0 left-0 w-10 select-none overflow-hidden border-r border-red-300/60 bg-[#fbf6ea] text-right text-[11px] tabular-nums text-muted-foreground"
        style={{ paddingTop: PAD_TOP }}
      >
        {Array.from({ length: visibleLines }, (_, i) => (
          <div
            key={i}
            className={cn("pr-2", i + 1 > maxLines && "text-destructive/70")}
            style={{ height: LINE_PX, lineHeight: `${LINE_PX}px` }}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck
        className={cn(
          "block w-full resize-none bg-transparent pl-[52px] pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70",
          full ? "h-full" : "h-[calc(32px*16+16px)] resize-y",
        )}
        style={{
          lineHeight: `${LINE_PX}px`,
          paddingTop: PAD_TOP,
          paddingBottom: PAD_TOP,
          // Pauta: uma linha a cada LINE_PX, acompanhando o texto ao rolar.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE_PX - 1}px, rgba(29,53,87,0.16) ${LINE_PX - 1}px, rgba(29,53,87,0.16) ${LINE_PX}px)`,
          backgroundPosition: `0 ${PAD_TOP}px`,
          backgroundAttachment: "local",
        }}
      />
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap break-words"
        style={{ lineHeight: `${LINE_PX}px`, overflowWrap: "break-word" }}
      />
    </div>
  );

  const lineCounter = (
    <span
      title="Estimativa de quantas linhas o texto ocupa numa folha de prova (igual no celular e no computador)."
      className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}
    >
      ≈ {usedLines}/{maxLines} linhas da folha{over ? " — passou do limite" : ""}
    </span>
  );

  const toggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setFull((f) => !f)}
      aria-label={full ? "Diminuir" : "Tela cheia"}
      title={full ? "Diminuir (Esc)" : "Tela cheia"}
    >
      {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      <span className="hidden sm:inline">{full ? "Diminuir" : "Tela cheia"}</span>
    </Button>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center bg-background p-3 sm:p-6">
        {/* Largura de folha: a contagem de linhas fica parecida com a da prova. */}
        <div className="flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            {status}
            {lineCounter}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
              {toggle}
            </div>
          </div>
          {sheet}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {status}
          {lineCounter}
        </div>
        {toggle}
      </div>
      {sheet}
      {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
    </div>
  );
}
