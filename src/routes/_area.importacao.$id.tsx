import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { useMe } from "@/hooks/use-auth";
import { examImportService } from "@/services/exam-import.service";
import { getExamImportPdfPreview } from "@/services/exam-import.fns";
import { questionTaxonomyStore } from "@/services/question-taxonomy-store";
import type { ExamImportDraftQuestion, ExamImportItemStatus } from "@/types/exam-import";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/importacao/$id")({
  head: () => ({
    meta: [{ title: "Revisar importação — Estufoo" }],
  }),
  component: ImportReviewPage,
});

function statusLabel(s: ExamImportItemStatus): string {
  if (s === "draft") return "Pendente";
  if (s === "reviewed") return "Revisada";
  if (s === "approved") return "Importada";
  return "Excluída";
}

function ImportReviewPage() {
  const { id } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const email = me.data?.email ?? "";

  const batchQ = useQuery({
    queryKey: ["exam-import", id],
    queryFn: () => {
      const b = examImportService.get(id);
      if (!b) throw new Error("Importação não encontrada neste navegador (mock local).");
      return b;
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const batch = batchQ.data;
  const selected =
    batch?.questions.find((q) => q.id === selectedId) ?? batch?.questions[0] ?? null;

  useEffect(() => {
    if (!selectedId && batch?.questions[0]) setSelectedId(batch.questions[0].id);
  }, [batch, selectedId]);

  const pageText = useMemo(() => {
    if (!batch || !selected?.pageStart) return batch?.pages[0]?.text ?? "";
    return batch.pages.find((p) => p.page === selected.pageStart)?.text ?? "";
  }, [batch, selected]);

  const counts = useMemo(() => {
    const qs = batch?.questions ?? [];
    return {
      total: qs.length,
      pending: qs.filter((q) => q.status === "draft").length,
      reviewed: qs.filter((q) => q.status === "reviewed").length,
      imported: qs.filter((q) => q.status === "approved").length,
      rejected: qs.filter((q) => q.status === "rejected").length,
      duplicates: qs.filter((q) => q.possibleDuplicateIds?.length).length,
    };
  }, [batch]);

  const preview = useQuery({
    queryKey: ["exam-import-pdf", batch?.examFile.storageKey, email],
    queryFn: async () => {
      if (!batch?.examFile.storageKey || !email) return null;
      const r = await getExamImportPdfPreview({
        data: { actorEmail: email, storageKey: batch.examFile.storageKey },
      });
      return `data:${r.mimeType};base64,${r.base64}`;
    },
    enabled: !!batch?.examFile.storageKey && !!email,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<ExamImportDraftQuestion>) => {
      if (!selected) throw new Error("Nenhuma questão selecionada.");
      return examImportService.updateQuestion(id, selected.id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-import", id] });
      toast.success("Rascunho salvo.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const setStatus = useMutation({
    mutationFn: async (args: {
      status: ExamImportDraftQuestion["status"];
      patch?: Partial<ExamImportDraftQuestion>;
    }) => {
      if (!selected) throw new Error("Nenhuma questão selecionada.");
      return examImportService.setQuestionStatus(id, selected.id, args.status, args.patch);
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["exam-import", id] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success(
        args.status === "approved"
          ? "Importada no banco local (visível em /questoes)."
          : args.status === "rejected"
            ? "Excluída da importação."
            : args.status === "reviewed"
              ? "Marcada como revisada (ainda não no banco)."
              : "Salva como pendente.",
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (batchQ.isLoading) return <ListSkeleton />;
  if (batchQ.error) return <ErrorState error={batchQ.error} onRetry={() => batchQ.refetch()} />;
  if (!batch) return <EmptyState title="Importação não encontrada" />;

  return (
    <>
      <PageHeader
        title={batch.metadata.examName}
        description={`${batch.metadata.board} · ${batch.metadata.organ} · ${batch.metadata.year} · ${batch.examFile.fileName}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/configuracoes">Configurações</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/importacao">Voltar</Link>
            </Button>
          </div>
        }
      />

      <Panel className="mb-4 text-sm">
        <p className="font-medium">Resumo</p>
        <p className="text-muted-foreground">
          {counts.total} identificadas · {counts.pending} pendentes · {counts.reviewed} revisadas ·{" "}
          {counts.imported} importadas · {counts.rejected} excluídas
          {counts.duplicates ? ` · ${counts.duplicates} possível(is) duplicata(s)` : ""}
        </p>
      </Panel>

      {batch.needsOcr && (
        <Alert className="mb-4" variant="destructive">
          <AlertTitle>Texto insuficiente / possível PDF escaneado</AlertTitle>
          <AlertDescription>
            OCR não está habilitado neste projeto. Use PDF com texto selecionável ou preencha
            manualmente na revisão. Não presumimos leitura correta de imagem.
          </AlertDescription>
        </Alert>
      )}

      {!!batch.alerts.length && (
        <Panel className="mb-4 space-y-1 text-sm">
          <p className="font-medium">Alertas da importação</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {batch.alerts.slice(0, 12).map((a, i) => (
              <li key={`${a.code}-${i}`}>
                {a.message}
                {a.questionNumber != null ? ` (#${a.questionNumber})` : ""}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_1fr]">
        <Panel className="max-h-[70vh] overflow-auto p-2">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Questões</p>
          <ul className="space-y-1">
            {batch.questions.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                    selected?.id === q.id ? "bg-accent" : "hover:bg-muted/60",
                  )}
                >
                  <span>
                    #{q.number}
                    {q.possibleDuplicateIds?.length ? " ⚠" : ""}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {statusLabel(q.status)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="space-y-3">
          {!selected ? (
            <EmptyState title="Nenhuma questão extraída" />
          ) : (
            <QuestionEditor
              key={selected.id}
              q={selected}
              onSave={(patch) => save.mutate(patch)}
              onStatus={(s, patch) =>
                setStatus.mutate(patch ? { status: s, patch } : { status: s })
              }
              busy={save.isPending || setStatus.isPending}
            />
          )}
        </Panel>

        <Panel className="space-y-3">
          <p className="text-sm font-medium">
            Origem: {selected?.sourceFileName || batch.examFile.fileName}
            {selected?.pageStart != null ? ` · página ${selected.pageStart}` : ""}
          </p>
          {preview.data ? (
            <iframe
              title="PDF da prova"
              src={preview.data}
              className="h-72 w-full rounded border bg-white"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {preview.isLoading
                ? "Carregando preview privado…"
                : "Preview do PDF indisponível — exibindo texto extraído."}
            </p>
          )}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs">
            {pageText || "(sem texto nesta página)"}
          </pre>
          {!!selected?.figureRefs.length && (
            <div className="text-xs text-muted-foreground">
              Figuras referenciadas: {selected.figureRefs.map((f) => f.label).join(", ")}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function Uncertain({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
      {label}
    </span>
  );
}

function QuestionEditor({
  q,
  onSave,
  onStatus,
  busy,
}: {
  q: ExamImportDraftQuestion;
  onSave: (patch: Partial<ExamImportDraftQuestion>) => void;
  onStatus: (
    s: ExamImportDraftQuestion["status"],
    patch?: Partial<ExamImportDraftQuestion>,
  ) => void;
  busy: boolean;
}) {
  const tax = questionTaxonomyStore.list();
  const [statement, setStatement] = useState(q.statement);
  const [subject, setSubject] = useState(q.subject);
  const [topic, setTopic] = useState(q.topic);
  const [correctKey, setCorrectKey] = useState(q.correctKey ?? "");
  const [alts, setAlts] = useState(q.alternatives);
  const [explanation, setExplanation] = useState(q.explanation);
  const [kind, setKind] = useState(q.kind ?? "multiple_choice");

  const topicsForSubject =
    tax.subjects.find((s) => s.name.toLowerCase() === subject.trim().toLowerCase())?.topics ??
    [];

  const patch = (): Partial<ExamImportDraftQuestion> => ({
    statement,
    alternatives: alts,
    correctKey: correctKey || null,
    subject,
    topic,
    explanation,
    explanationSource: explanation.trim() ? "official" : "none",
    kind,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Questão {q.number}</h2>
        <Badge variant="outline">confiança {(q.confidence * 100).toFixed(0)}%</Badge>
        <Badge>{statusLabel(q.status)}</Badge>
        <Badge variant="secondary">
          {kind === "true_false" ? "Certo/Errado" : "Múltipla escolha"}
        </Badge>
      </div>

      {!!q.possibleDuplicateIds?.length && (
        <Alert>
          <AlertTitle>Possível duplicata</AlertTitle>
          <AlertDescription>
            Enunciado semelhante a: {q.possibleDuplicateIds.join(", ")}. Importar cria um novo
            registro — não sobrescreve o existente.
          </AlertDescription>
        </Alert>
      )}

      {!!q.alerts.length && (
        <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
          {q.alerts.map((a, i) => (
            <li key={i}>{a.message}</li>
          ))}
        </ul>
      )}

      <Field label="Tipo" htmlFor="kind">
        <NativeSelect
          id="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ExamImportDraftQuestion["kind"])}
        >
          <option value="multiple_choice">Múltipla escolha</option>
          <option value="true_false">Certo / Errado</option>
        </NativeSelect>
      </Field>

      <Field label="Enunciado" htmlFor="st">
        <Uncertain show={!statement.trim()} label="vazio" />
        <Textarea
          id="st"
          rows={5}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          className={cn(!statement.trim() && "border-amber-500")}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Alternativas
          <Uncertain show={alts.length < 2} label="incompleto" />
        </p>
        {alts.map((a, i) => (
          <div key={a.key} className="flex gap-2">
            <span className="w-6 pt-2 text-sm font-medium">{a.key}</span>
            <Input
              value={a.text}
              className={cn(!a.text.trim() && "border-amber-500")}
              onChange={(e) => {
                const next = [...alts];
                next[i] = { ...a, text: e.target.value };
                setAlts(next);
              }}
            />
          </div>
        ))}
        {kind === "true_false" && alts.length < 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setAlts([
                { key: "C", text: "Certo" },
                { key: "E", text: "Errado" },
              ])
            }
          >
            Preencher C/E
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Gabarito" htmlFor="gk">
          <Uncertain show={!correctKey} label="pendente" />
          <NativeSelect
            id="gk"
            value={correctKey}
            onChange={(e) => setCorrectKey(e.target.value)}
            className={cn(!correctKey && "border-amber-500")}
          >
            <option value="">— em branco (não inventar) —</option>
            {alts.map((a) => (
              <option key={a.key} value={a.key}>
                {a.key}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tipo já refletido nas alternativas" htmlFor="_">
          <p className="pt-2 text-xs text-muted-foreground">
            Gabarito só é preenchido com associação segura ao número da questão.
          </p>
        </Field>
        <Field label="Matéria" htmlFor="subj">
          <Uncertain show={!subject.trim()} label="vazio" />
          <Input
            id="subj"
            list="review-subjects"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={cn(!subject.trim() && "border-amber-500")}
          />
        </Field>
        <Field label="Assunto" htmlFor="top">
          <Input
            id="top"
            list="review-topics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
      </div>

      <datalist id="review-subjects">
        {tax.subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="review-topics">
        {topicsForSubject.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>

      <Field label="Comentário / explicação (só do PDF ou digitado — nunca inventado)" htmlFor="exp">
        <Textarea
          id="exp"
          rows={3}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Deixe vazio se não houver no material"
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        O texto extraído não é alterado silenciosamente — edite só aqui. Explicações de IA não são
        geradas neste fluxo.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            if (subject.trim()) questionTaxonomyStore.ensureSubject(subject);
            if (subject.trim() && topic.trim()) {
              questionTaxonomyStore.ensureTopic(subject, topic);
            }
            onSave({ ...patch(), status: "draft" });
          }}
        >
          Salvar pendente
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (subject.trim()) questionTaxonomyStore.ensureSubject(subject);
            if (subject.trim() && topic.trim()) {
              questionTaxonomyStore.ensureTopic(subject, topic);
            }
            onStatus("reviewed", patch());
          }}
        >
          Marcar revisada
        </Button>
        <Button
          variant="highlight"
          disabled={busy}
          onClick={() => {
            if (subject.trim()) questionTaxonomyStore.ensureSubject(subject);
            if (subject.trim() && topic.trim()) {
              questionTaxonomyStore.ensureTopic(subject, topic);
            }
            onStatus("approved", patch());
          }}
        >
          Confirmar importação
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onStatus("rejected")}>
          Excluir item
        </Button>
      </div>
    </div>
  );
}
