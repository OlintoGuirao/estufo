import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { TUTOR_DIFFICULTY_OPTIONS, type TutorDifficultyCode } from "@/lib/tutor/types";
import { tutorService } from "@/services";

type Alt = { key: string; text: string };

export function TutorAssist({
  questionId,
  statement,
  alternatives,
  studentChoice,
  correctKey,
  subject,
  topic,
  onRetryAnswer,
}: {
  questionId: string;
  statement: string;
  alternatives: Alt[];
  studentChoice: string;
  /** Só para validar vazamento na saída — nunca vai no prompt de dica. */
  correctKey: string;
  subject: string;
  topic: string;
  onRetryAnswer?: () => void;
}) {
  const [tips, setTips] = useState<string[]>([]);
  const [level, setLevel] = useState(1);
  const [diff, setDiff] = useState<TutorDifficultyCode>("desconhecia");
  const [diffNote, setDiffNote] = useState("");
  const [practice, setPractice] = useState<{
    statement: string;
    alternatives: Alt[];
    label: string;
    answerToken: string;
    mocked: boolean;
  } | null>(null);
  const [practiceChoice, setPracticeChoice] = useState<string | null>(null);
  const [practiceResult, setPracticeResult] = useState<{
    correct: boolean;
    correctKey: string;
    explanation: string;
  } | null>(null);

  const tipMut = useMutation({
    mutationFn: () =>
      tutorService.tip({
        statement,
        alternatives,
        studentChoice,
        subject,
        topic,
        tipLevel: level,
        previousTips: tips,
        correctKeyForValidationOnly: correctKey,
      }),
    onMutate: () => {
      toast.loading("Gerando dica com o tutor… (pode levar alguns segundos)", { id: "tutor-tip" });
    },
    onSuccess: (r) => {
      toast.dismiss("tutor-tip");
      setTips((t) => [...t, r.tip]);
      setLevel((l) => Math.min(3, l + 1));
      if (r.mocked) toast.message("Dica mockada (GEMINI_USE_MOCK) — não veio do modelo real.");
      else toast.success("Dica pronta.");
    },
    onError: (e) => {
      toast.dismiss("tutor-tip");
      toast.error(errMsg(e));
    },
  });

  const practiceMut = useMutation({
    mutationFn: () =>
      tutorService.generatePractice({
        subject: subject || "Conhecimentos gerais",
        topic: topic || "Revisão",
        conceptHint: `Treinar o tópico após erro na escolha ${studentChoice}. Enunciado de referência (não copiar): ${statement.slice(0, 280)}`,
      }),
    onMutate: () => {
      toast.loading("Gerando questão de treino…", { id: "tutor-practice" });
    },
    onSuccess: (r) => {
      toast.dismiss("tutor-practice");
      setPractice({
        statement: r.publicQuestion.statement,
        alternatives: r.publicQuestion.alternatives,
        label: r.publicQuestion.label,
        answerToken: r.answerToken,
        mocked: r.mocked,
      });
      setPracticeChoice(null);
      setPracticeResult(null);
      if (r.mocked) toast.message("Questão de treino mockada (GEMINI_USE_MOCK).");
      else toast.success("Questão de treino gerada.");
    },
    onError: (e) => {
      toast.dismiss("tutor-practice");
      toast.error(errMsg(e));
    },
  });

  const gradeMut = useMutation({
    mutationFn: () =>
      tutorService.gradePractice({ answerToken: practice!.answerToken, choice: practiceChoice! }),
    onSuccess: setPracticeResult,
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-dashed border-highlight/40 bg-highlight-soft/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-highlight" aria-hidden />
        Tutor IA (Gemini)
      </div>
      <p className="text-xs text-muted-foreground">
        Dicas não recebem o gabarito. A correção oficial continua sendo a do sistema. Respostas da
        IA podem estar incorretas.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={tipMut.isPending}
          onClick={() => tipMut.mutate()}
        >
          <Lightbulb className="h-4 w-4" />
          {tipMut.isPending
            ? "Gerando dica…"
            : tips.length
              ? "Outra dica"
              : "Pedir dica"}
        </Button>
        {onRetryAnswer && (
          <Button
            size="sm"
            variant="ghost"
            disabled={tipMut.isPending || practiceMut.isPending}
            onClick={() => {
              onRetryAnswer();
              toast.message("Pode escolher outra alternativa e responder de novo.");
            }}
          >
            Tentar de novo
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={practiceMut.isPending || !subject}
          title={!subject ? "Matéria indisponível nesta questão" : undefined}
          onClick={() => practiceMut.mutate()}
        >
          {practiceMut.isPending ? "Gerando treino…" : "Questão de treino (IA)"}
        </Button>
      </div>
      {(tipMut.isPending || practiceMut.isPending) && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          Aguardando o tutor. O botão fica desabilitado até terminar — não é um clique “morto”.
        </p>
      )}

      {tips.length > 0 && (
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={i} className="rounded-lg bg-card p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Dica {i + 1}</p>
              <p className="mt-1">{t}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Tipo de dificuldade" htmlFor={`diff-${questionId}`}>
          <NativeSelect
            id={`diff-${questionId}`}
            value={diff}
            onChange={(e) => setDiff(e.target.value as TutorDifficultyCode)}
          >
            {TUTOR_DIFFICULTY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Nota (opcional)" htmlFor={`diffnote-${questionId}`}>
          <Input
            id={`diffnote-${questionId}`}
            value={diffNote}
            onChange={(e) => setDiffNote(e.target.value)}
            maxLength={200}
            placeholder="Breve, sem dados pessoais"
          />
        </Field>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (!subject || !topic) {
            toast.error("Matéria/tópico indisponíveis — não dá para associar com segurança.");
            return;
          }
          tutorService.recordDifficulty({
            subject,
            topic,
            code: diff,
            ...(diffNote.trim() ? { note: diffNote.trim() } : {}),
            questionId,
          });
          toast.success(
            "Dificuldade registrada localmente. Um único erro não vira diagnóstico recorrente.",
          );
        }}
      >
        Registrar dificuldade
      </Button>

      {practice && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold text-highlight">{practice.label}</p>
          {practice.mocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              Conteúdo mockado — não é saída real do Gemini.
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed">{practice.statement}</p>
          <div className="mt-3 space-y-2">
            {practice.alternatives.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={!!practiceResult}
                onClick={() => setPracticeChoice(a.key)}
                className={`flex w-full rounded-lg border p-2 text-left text-sm ${practiceChoice === a.key ? "border-primary bg-accent" : ""}`}
              >
                <span className="mr-2 font-semibold">{a.key})</span>
                {a.text}
              </button>
            ))}
          </div>
          {!practiceResult ? (
            <Button
              className="mt-3"
              size="sm"
              disabled={!practiceChoice || gradeMut.isPending}
              onClick={() => gradeMut.mutate()}
            >
              Responder treino
            </Button>
          ) : (
            <div className="mt-3 text-sm">
              <p className="font-medium">
                {practiceResult.correct
                  ? "Acertou o treino!"
                  : `Gabarito do treino (IA): ${practiceResult.correctKey}`}
              </p>
              <p className="mt-1 text-muted-foreground">{practiceResult.explanation}</p>
              <Button
                className="mt-2"
                size="sm"
                variant="ghost"
                onClick={() => toast.message("Obrigado — vamos melhorar as próximas gerações.")}
              >
                Sinalizar ambiguidade
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
