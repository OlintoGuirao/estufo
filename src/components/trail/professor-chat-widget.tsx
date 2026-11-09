import { useEffect, useRef, useState } from "react";
import { GraduationCap, Loader2, SendHorizonal, X } from "lucide-react";
import { ProfessorText } from "@/components/professor-text";
import { cn } from "@/lib/utils";
import type { TrailProfessorChatMessage } from "@/types/trail-progress";

/**
 * Chat flutuante "Tire dúvida com o professor".
 * Botão redondo no canto inferior direito; abre uma janela de conversa
 * (no celular ocupa a parte de baixo da tela inteira).
 */
export function ProfessorChatWidget({
  messages,
  pending,
  pendingQuestion,
  onSend,
  contextLabel,
}: {
  messages: TrailProfessorChatMessage[];
  /** Professor respondendo agora. */
  pending: boolean;
  /** Pergunta já enviada, aguardando resposta (aparece na hora). */
  pendingQuestion?: string | null;
  onSend: (question: string) => void;
  /** Ex.: título do módulo aberto — o professor responde com ele em mente. */
  contextLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(messages.length);

  // Resposta nova com o chat fechado → bolinha de "não lida".
  useEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added > 0 && !open && messages[messages.length - 1]?.role === "professor") {
      setUnread((n) => n + 1);
    }
  }, [messages, open]);

  // Sempre mostra a última mensagem.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length, pending]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Esc fecha.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = () => {
    const q = draft.trim();
    if (q.length < 3 || pending) return;
    onSend(q);
    setDraft("");
  };

  return (
    <>
      {/* Janela do chat */}
      {open && (
        <div
          role="dialog"
          aria-label="Tire dúvida com o professor"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border bg-card shadow-2xl",
            // celular: folha de baixo; telas maiores: janela no canto
            "inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl",
            "sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[min(600px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-2xl",
          )}
        >
          <header className="flex items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Professor</p>
              <p className="truncate text-xs opacity-80">
                {pending ? "digitando…" : contextLabel ? `Sobre: ${contextLabel}` : "Tire suas dúvidas"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 hover:bg-primary-foreground/15"
              aria-label="Fechar chat"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-muted/30 px-3 py-4">
            {!messages.length && !pendingQuestion && (
              <div className="mx-auto mt-6 max-w-[85%] rounded-xl bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
                Olá! Ficou alguma dúvida nesta aula? Pergunte do seu jeito — eu explico de forma simples. 🙂
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} />
            ))}
            {pendingQuestion && <Bubble role="aluno" text={pendingQuestion} />}
            {pending && (
              <div className="flex">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3 shadow-sm">
                  <Dot delay="0ms" />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </div>
              </div>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia; Shift+Enter quebra linha.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Escreva sua dúvida…"
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={draft.trim().length < 3 || pending}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label="Enviar pergunta"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6",
          open && "hidden sm:flex",
        )}
        aria-label={open ? "Fechar chat do professor" : "Tire dúvida com o professor"}
        title="Tire dúvida com o professor"
      >
        {open ? <X className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}

function Bubble({ role, text }: { role: "aluno" | "professor"; text: string }) {
  const mine = role === "aluno";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
          mine
            ? "rounded-br-sm bg-primary text-primary-foreground [&_.prose]:text-primary-foreground"
            : "rounded-bl-sm bg-card",
        )}
      >
        {mine ? <p className="whitespace-pre-wrap">{text}</p> : <ProfessorText text={text} />}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
