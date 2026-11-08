import { useEffect, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Lightbulb,
  Map,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errMsg } from "@/components/forms";
import { tutorService } from "@/services";
import { cn } from "@/lib/utils";

type Section = { title: string; body: string };

export type ActiveTest = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
};

const HIDDEN_SECTIONS =
  /teste ativo|resposta do teste|olhe depois|elimina[cç][aã]o das alternativas/i;

const SECTION_META: {
  match: RegExp;
  icon: LucideIcon;
  accent: string;
  chip: string;
}[] = [
  {
    match: /contextualiza/i,
    icon: Map,
    accent: "border-l-[#5b7c99]",
    chip: "bg-[#e8eef5] text-[#3d5a73] dark:bg-sky-500/15 dark:text-sky-200",
  },
  {
    match: /conceito/i,
    icon: Lightbulb,
    accent: "border-l-[#c4a35a]",
    chip: "bg-[#f5efe0] text-[#7a5c28] dark:bg-amber-500/15 dark:text-amber-200",
  },
  {
    match: /resumo|did[aá]tico/i,
    icon: BookOpen,
    accent: "border-l-[#1a3d32]",
    chip: "bg-[#e8f2ee] dark:bg-emerald-500/15 text-[#1a3d32] dark:text-emerald-300",
  },
  {
    match: /resolu[cç][aã]o|passo a passo|exemplo/i,
    icon: CheckCircle2,
    accent: "border-l-[#1a3d32]",
    chip: "bg-[#e8f2ee] dark:bg-emerald-500/15 text-[#1a3d32] dark:text-emerald-300",
  },
  {
    match: /memoriz|mnem[oô]nico|associa/i,
    icon: Sparkles,
    accent: "border-l-[#c4a35a]",
    chip: "bg-[#f5efe0] text-[#7a5c28] dark:bg-amber-500/15 dark:text-amber-200",
  },
  {
    match: /pegadinha|banca|induz/i,
    icon: AlertTriangle,
    accent: "border-l-[#b56a3a]",
    chip: "bg-[#f8eee8] text-[#8a4a28] dark:bg-orange-500/15 dark:text-orange-200",
  },
  {
    match: /funda|norma|artigo|fonte|legal/i,
    icon: Scale,
    accent: "border-l-[#1a3d32]",
    chip: "bg-[#e8f2ee] dark:bg-emerald-500/15 text-[#1a3d32] dark:text-emerald-300",
  },
];

function stripMdNoise(s: string): string {
  return s
    .replace(/\*{1,2}/g, "")
    .replace(/^#+\s*/g, "")
    .trim();
}

function displayTitle(title: string): string {
  const t = stripMdNoise(title.replace(/^\d+\.\s*/, ""));
  if (/resolu[cç][aã]o/i.test(t)) return "Exemplo resolvido";
  return t;
}

export function parseMastigadoSections(text: string): Section[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const headingRe = /(?:^|\n)\s*(?:\*{1,2})?\s*(\d+)\.\s+(.+?)\s*(?:\*{1,2})?\s*(?=\n|$)/g;
  const matches = [...normalized.matchAll(headingRe)];
  if (matches.length < 2) {
    return [{ title: "Resumo", body: normalized }];
  }

  const sections: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : normalized.length;
    const title = `${m[1]}. ${stripMdNoise(m[2] ?? "")}`;
    if (HIDDEN_SECTIONS.test(title)) continue;
    const body = normalized.slice(start, end).trim();
    if (!body) continue;
    sections.push({ title, body });
  }
  return sections.length ? sections : [{ title: "Resumo", body: normalized }];
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {bold[1]}
        </strong>
      );
    }
    const em = part.match(/^\*([^*]+)\*$/);
    if (em) {
      return (
        <em key={i} className="italic text-foreground/90">
          {em[1]}
        </em>
      );
    }
    return <span key={i}>{part.replace(/\*{1,2}/g, "")}</span>;
  });
}

function renderBody(body: string) {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mt-1.5 space-y-1.5 pl-0">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground/90 sm:text-sm">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]!);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-[13px] leading-relaxed text-foreground/90 sm:text-sm">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

function metaFor(title: string) {
  return (
    SECTION_META.find((m) => m.match.test(title)) ?? {
      icon: BookOpen,
      accent: "border-l-[#1a3d32]/60",
      chip: "bg-[#eef2f0] text-[#1a3d32] dark:bg-emerald-500/10 dark:text-emerald-300",
    }
  );
}

function McqBlock({
  statement,
  alternatives,
  draft,
  locked,
  result,
  onPick,
  onConfirm,
  badge,
}: {
  statement: string;
  alternatives: { key: string; text: string }[];
  draft: string | null;
  locked: boolean;
  result: { correct: boolean; explanation?: string } | null;
  onPick: (key: string) => void;
  onConfirm: () => void;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {badge && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#b56a3a] dark:text-orange-300">
          {badge}
        </p>
      )}
      <p className="font-serif text-base font-semibold leading-snug text-foreground">{statement}</p>
      <div className="mt-4 space-y-2">
        {alternatives.map((alt) => {
          const isSelected = draft === alt.key;
          const isCorrect = locked && result?.correct && draft === alt.key;
          const isWrong = locked && result && !result.correct && draft === alt.key;
          return (
            <button
              key={alt.key}
              type="button"
              disabled={locked}
              onClick={() => onPick(alt.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-left transition-colors",
                "border-border bg-card hover:border-foreground/30",
                isSelected && !locked && "border-[#1a3d32] bg-[#1a3d32]/[0.04] ring-1 ring-[#1a3d32]/30 dark:border-emerald-400 dark:bg-emerald-400/10 dark:ring-emerald-400/40",
                isCorrect && "border-[#1a3d32]/50 bg-[#e8f2ee] dark:bg-emerald-500/15 dark:border-emerald-400/50",
                isWrong && "border-destructive/40 bg-destructive/5",
                locked && !isSelected && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                  isWrong ? "bg-destructive" : "bg-[#1a3d32] dark:bg-emerald-700",
                )}
              >
                {alt.key}
              </span>
              <span className="text-sm leading-snug">{alt.text}</span>
            </button>
          );
        })}
      </div>
      {!locked ? (
        <Button
          type="button"
          className="mt-4 h-10 w-full rounded-xl bg-[#6f7f72] text-white hover:bg-[#5f6e62]"
          disabled={!draft}
          onClick={onConfirm}
        >
          Confirmar
        </Button>
      ) : (
        <p
          className={cn(
            "mt-4 text-center text-sm font-medium",
            result?.correct ? "text-[#1a3d32] dark:text-emerald-300" : "text-destructive",
          )}
        >
          {result?.correct ? "Acertou." : "Errou — revise o raciocínio abaixo."}
        </p>
      )}
      {locked && result?.explanation && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{result.explanation}</p>
      )}
    </div>
  );
}

type Props = {
  text: string;
  fonteUrl?: string | null;
  activeTest?: ActiveTest | null;
  subject?: string;
  topic?: string;
  /** Enunciado da questão original — usado para gerar semelhante. */
  sourceStatement?: string;
  className?: string;
};

export function MastigadoPanel({
  text,
  fonteUrl,
  activeTest,
  subject,
  topic,
  sourceStatement,
  className,
}: Props) {
  const sections = parseMastigadoSections(text);
  const [testOpen, setTestOpen] = useState(false);
  const [testDraft, setTestDraft] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    correct: boolean;
    explanation?: string;
  } | null>(null);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarDraft, setSimilarDraft] = useState<string | null>(null);
  const [similarResult, setSimilarResult] = useState<{
    correct: boolean;
    explanation?: string;
  } | null>(null);
  const [similar, setSimilar] = useState<{
    statement: string;
    alternatives: { key: string; text: string }[];
    answerToken: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    setTestOpen(false);
    setTestDraft(null);
    setTestResult(null);
  }, [activeTest?.statement, text]);

  const similarMut = useMutation({
    mutationFn: async () => {
      const subj = subject?.trim() || "Conhecimentos gerais";
      const top = topic?.trim() || "Revisão";
      const hint = `Crie questão ORIGINAL semelhante (mesmo conceito), sem copiar. Referência (não copiar): ${(sourceStatement ?? "").slice(0, 320)}`;
      return tutorService.generatePractice({
        subject: subj,
        topic: top,
        conceptHint: hint,
      });
    },
    onMutate: () => {
      toast.loading("Criando questão semelhante…", { id: "similar-q" });
      setSimilar(null);
      setSimilarDraft(null);
      setSimilarResult(null);
      setSimilarOpen(true);
    },
    onSuccess: (r) => {
      toast.dismiss("similar-q");
      setSimilar({
        statement: r.publicQuestion.statement,
        alternatives: r.publicQuestion.alternatives,
        answerToken: r.answerToken,
        label: r.publicQuestion.label,
      });
      if (r.mocked) toast.message("Questão mockada (GEMINI_USE_MOCK).");
      else toast.success("Questão pronta.");
    },
    onError: (e) => {
      toast.dismiss("similar-q");
      toast.error(errMsg(e));
      setSimilarOpen(false);
    },
  });

  const gradeSimilarMut = useMutation({
    mutationFn: async () => {
      if (!similar || !similarDraft) throw new Error("Escolha uma alternativa.");
      return tutorService.gradePractice({
        answerToken: similar.answerToken,
        choice: similarDraft,
      });
    },
    onSuccess: (r) => {
      setSimilarResult({
        correct: r.correct,
        ...(r.explanation ? { explanation: r.explanation } : {}),
      });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <aside
      className={cn(
        "mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#f6faf7] to-[#eef5f1] dark:from-card dark:to-card shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a3d32] dark:bg-emerald-700 text-white">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1a3d32] dark:text-emerald-300">
              Mastigado pela IA
            </p>
            <p className="text-[11px] text-muted-foreground">
              Professor particular — do zero até a prova
            </p>
          </div>
        </div>
        {fonteUrl && (
          <a
            href={fonteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-[#1a3d32] dark:text-emerald-300 transition-colors hover:bg-white"
          >
            Fonte
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </header>

      <div className="space-y-2.5 p-3 sm:p-4">
        {sections.map((section) => {
          const meta = metaFor(section.title);
          const Icon = meta.icon;
          return (
            <section
              key={section.title}
              className={cn(
                "rounded-xl border border-white/70 bg-card/75 p-3 pl-3 shadow-[0_1px_0_rgba(26,61,50,0.04)] border-l-4",
                meta.accent,
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                    meta.chip,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {displayTitle(section.title)}
                </h3>
              </div>
              {renderBody(section.body)}
            </section>
          );
        })}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          {activeTest && (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl border-[#6b7280]/35 bg-card text-[#374151] dark:text-foreground hover:bg-[#f3f4f6] dark:hover:bg-muted"
              onClick={() => setTestOpen(true)}
            >
              <CircleHelp className="h-4 w-4" />
              Abrir teste
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl border-[#1a3d32]/30 bg-card dark:border-emerald-400/40 text-[#1a3d32] dark:text-emerald-300 hover:bg-[#e8f2ee] dark:hover:bg-emerald-500/15"
            disabled={similarMut.isPending}
            onClick={() => similarMut.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {similarMut.isPending ? "Criando…" : "Criar questão semelhante"}
          </Button>
        </div>
      </div>

      <Dialog
        open={testOpen}
        onOpenChange={(o) => {
          setTestOpen(o);
          if (!o) {
            setTestDraft(null);
            setTestResult(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-[#f7f5f0] dark:bg-background p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border bg-card px-5 py-4">
            <DialogTitle className="font-serif text-lg text-foreground">Teste ativo</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Responda como na prova — a correção só aparece depois de confirmar
            </p>
          </DialogHeader>
          <div className="p-4 sm:p-5">
            {activeTest ? (
              <McqBlock
                badge="Teste"
                statement={activeTest.statement}
                alternatives={activeTest.alternatives}
                draft={testDraft}
                locked={!!testResult}
                result={testResult}
                onPick={setTestDraft}
                onConfirm={() => {
                  if (!testDraft || !activeTest) return;
                  const correct =
                    testDraft.toUpperCase() === activeTest.correctKey.toUpperCase();
                  setTestResult({
                    correct,
                    explanation: activeTest.explanation,
                  });
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={similarOpen}
        onOpenChange={(o) => {
          setSimilarOpen(o);
          if (!o) {
            setSimilar(null);
            setSimilarDraft(null);
            setSimilarResult(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-[#f7f5f0] dark:bg-background p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border bg-card px-5 py-4">
            <DialogTitle className="font-serif text-lg text-foreground">
              Questão semelhante
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Gerada por IA — não é questão oficial de banca
            </p>
          </DialogHeader>
          <div className="p-4 sm:p-5">
            {similarMut.isPending && !similar ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Gerando enunciado…</p>
            ) : similar ? (
              <McqBlock
                badge={similar.label}
                statement={similar.statement}
                alternatives={similar.alternatives}
                draft={similarDraft}
                locked={!!similarResult}
                result={similarResult}
                onPick={setSimilarDraft}
                onConfirm={() => gradeSimilarMut.mutate()}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Não foi possível montar a questão.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
