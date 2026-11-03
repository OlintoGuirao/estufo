import { useCallback, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileUp, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Field, errMsg } from "@/components/forms";
import { examImportService } from "@/services/exam-import.service";
import { questionTaxonomyStore } from "@/services/question-taxonomy-store";
import { EXAM_IMPORT_MAX_BYTES } from "@/lib/exam-import/validate";
import { cn } from "@/lib/utils";

type QueueItem = {
  id: string;
  file: File;
  subject: string;
  topic: string;
  status: "pending" | "processing" | "done" | "error";
  batchId?: string;
  error?: string;
  questionsFound?: number;
  needsOcr?: boolean;
};

type Summary = {
  filesOk: number;
  filesError: number;
  questionsFound: number;
  ocrNeeded: number;
};

export function PdfImportPanel({ actorEmail }: { actorEmail: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [authOk, setAuthOk] = useState(false);
  const [force, setForce] = useState(false);
  const [board, setBoard] = useState("Vunesp");
  const [year, setYear] = useState(new Date().getFullYear());
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const taxonomy = useMemo(() => questionTaxonomyStore.list(), [queue.length, summary]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!list.length) {
      toast.error("Selecione apenas arquivos PDF.");
      return;
    }
    const oversized = list.filter((f) => f.size > EXAM_IMPORT_MAX_BYTES);
    if (oversized.length) {
      toast.error(
        `${oversized.length} arquivo(s) acima de ${Math.round(EXAM_IMPORT_MAX_BYTES / (1024 * 1024))} MB.`,
      );
    }
    const ok = list.filter((f) => f.size <= EXAM_IMPORT_MAX_BYTES);
    setQueue((prev) => [
      ...prev,
      ...ok.map((file) => ({
        id: `q_${Math.random().toString(36).slice(2, 9)}`,
        file,
        subject: "",
        topic: "",
        status: "pending" as const,
      })),
    ]);
    setSummary(null);
  }, []);

  const registerSubject = () => {
    try {
      const s = questionTaxonomyStore.ensureSubject(newSubject);
      toast.success(`Matéria cadastrada: ${s.name}`);
      setNewSubject("");
      setQueue((q) => [...q]); // refresh taxonomy memo
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const processQueue = async () => {
    if (!actorEmail) {
      toast.error("Faça login para importar.");
      return;
    }
    if (!authOk) {
      toast.error("Confirme a autorização para processar os PDFs.");
      return;
    }
    if (!queue.length) {
      toast.error("Adicione ao menos um PDF.");
      return;
    }
    setRunning(true);
    setSummary(null);
    let filesOk = 0;
    let filesError = 0;
    let questionsFound = 0;
    let ocrNeeded = 0;

    for (const item of queue) {
      if (item.status === "done") continue;
      setQueue((prev) =>
        prev.map((x) => {
          if (x.id !== item.id) return x;
          const { error: _e, ...rest } = x;
          return { ...rest, status: "processing" as const };
        }),
      );
      try {
        const subject = item.subject.trim() || "Sem matéria";
        questionTaxonomyStore.ensureSubject(subject);
        if (item.topic.trim()) questionTaxonomyStore.ensureTopic(subject, item.topic);

        const batch = await examImportService.submit({
          examFile: item.file,
          answerKeyFile: answerFile,
          authorizationConfirmed: true,
          actorEmail,
          force,
          metadata: {
            board: board.trim() || "Não informada",
            organ: subject,
            role: "Importação PDF",
            year,
            examName: item.file.name.replace(/\.pdf$/i, ""),
            bookletType: "",
            sourceUrl: "",
            defaultSubject: subject,
            defaultTopic: item.topic.trim(),
          },
        });
        filesOk += 1;
        questionsFound += batch.questions.length;
        if (batch.needsOcr) ocrNeeded += 1;
        setQueue((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: "done",
                  batchId: batch.id,
                  questionsFound: batch.questions.length,
                  needsOcr: batch.needsOcr,
                }
              : x,
          ),
        );
      } catch (e) {
        filesError += 1;
        setQueue((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? { ...x, status: "error", error: errMsg(e) }
              : x,
          ),
        );
      }
    }

    setSummary({ filesOk, filesError, questionsFound, ocrNeeded });
    setRunning(false);
    if (filesOk) toast.success(`${filesOk} arquivo(s) processado(s). Revise antes de importar.`);
    if (filesError) toast.error(`${filesError} arquivo(s) com erro.`);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Extração local com <code className="text-xs">unpdf</code> (sem enviar PDF a serviços externos).
        Sem OCR nesta versão — PDFs escaneados ficam sinalizados. Nada entra em{" "}
        <Link to="/questoes" className="underline">
          Questões
        </Link>{" "}
        até você confirmar na revisão.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20",
        )}
      >
        <FileUp className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Arraste PDFs aqui ou selecione arquivos</p>
        <p className="text-xs text-muted-foreground">
          Máx. {Math.round(EXAM_IMPORT_MAX_BYTES / (1024 * 1024))} MB por arquivo · vários arquivos na fila
        </p>
        <Input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="max-w-xs cursor-pointer"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Banca (metadado)" htmlFor="board">
          <Input id="board" value={board} onChange={(e) => setBoard(e.target.value)} />
        </Field>
        <Field label="Ano" htmlFor="year">
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          />
        </Field>
        <Field label="Gabarito opcional (PDF único para a fila)" htmlFor="gab">
          <Input
            id="gab"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <div className="space-y-2">
          <Field label="Cadastrar matéria" htmlFor="ns">
            <div className="flex gap-2">
              <Input
                id="ns"
                placeholder="Ex.: Direito Penal"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={registerSubject}>
                +
              </Button>
            </div>
          </Field>
          {!!taxonomy.subjects.length && (
            <p className="text-xs text-muted-foreground">
              Cadastradas: {taxonomy.subjects.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {!!queue.length && (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <StatusBadge item={item} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="Matéria" htmlFor={`sub-${item.id}`}>
                  <Input
                    id={`sub-${item.id}`}
                    list="taxonomy-subjects"
                    value={item.subject}
                    disabled={item.status === "processing" || item.status === "done"}
                    placeholder="Informe ou escolha"
                    onChange={(e) =>
                      setQueue((prev) =>
                        prev.map((x) =>
                          x.id === item.id ? { ...x, subject: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Assunto (opcional)" htmlFor={`top-${item.id}`}>
                  <Input
                    id={`top-${item.id}`}
                    value={item.topic}
                    disabled={item.status === "processing" || item.status === "done"}
                    onChange={(e) =>
                      setQueue((prev) =>
                        prev.map((x) =>
                          x.id === item.id ? { ...x, topic: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              {item.error && (
                <p className="mt-2 text-xs text-destructive">{item.error}</p>
              )}
              {item.batchId && (
                <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs">
                  <Link to="/importacao/$id" params={{ id: item.batchId }}>
                    Abrir revisão ({item.questionsFound ?? 0} questões)
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <datalist id="taxonomy-subjects">
        {taxonomy.subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="auth"
            checked={authOk}
            onCheckedChange={(v) => setAuthOk(v === true)}
          />
          <Label htmlFor="auth" className="text-sm font-normal leading-snug">
            Confirmo que tenho autorização para enviar e processar estes PDFs neste dispositivo.
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="force" checked={force} onCheckedChange={(v) => setForce(v === true)} />
          <Label htmlFor="force" className="text-sm font-normal leading-snug">
            Forçar reprocessamento se o arquivo/metadados já existirem na fila local
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={running || !queue.length} onClick={() => void processQueue()}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processando…
            </>
          ) : (
            "Extrair e preparar revisão"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={running}
          onClick={() => {
            setQueue([]);
            setSummary(null);
            setAnswerFile(null);
          }}
        >
          Limpar fila
        </Button>
        <Button asChild variant="ghost">
          <Link to="/importacao">Ver importações anteriores</Link>
        </Button>
      </div>

      {summary && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">Resumo da fila</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            <li>Arquivos OK: {summary.filesOk}</li>
            <li>Arquivos com erro: {summary.filesError}</li>
            <li>Questões identificadas: {summary.questionsFound}</li>
            <li>Arquivos sem texto / possível OCR: {summary.ocrNeeded}</li>
            <li>Importadas no banco: 0 (só após aprovação na revisão)</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ item }: { item: QueueItem }) {
  if (item.status === "pending") return <Badge variant="outline">Na fila</Badge>;
  if (item.status === "processing")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Extraindo
      </Badge>
    );
  if (item.status === "done")
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Pronto
        {item.needsOcr ? " · sem texto" : ""}
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" /> Erro
    </Badge>
  );
}

export function TaxonomyManagerPanel() {
  const [tax, setTax] = useState(() => questionTaxonomyStore.list());
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [forSubject, setForSubject] = useState("");

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Matérias e assuntos usados na importação e em Questões. Cadastro livre — não há lista fixa no
        código.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Nova matéria"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            try {
              questionTaxonomyStore.ensureSubject(subject);
              setTax(questionTaxonomyStore.list());
              setSubject("");
              toast.success("Matéria salva.");
            } catch (e) {
              toast.error(errMsg(e));
            }
          }}
        >
          Adicionar matéria
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          list="taxonomy-subjects-mgr"
          placeholder="Matéria do assunto"
          value={forSubject}
          onChange={(e) => setForSubject(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Novo assunto"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            try {
              questionTaxonomyStore.ensureTopic(forSubject, topic);
              setTax(questionTaxonomyStore.list());
              setTopic("");
              toast.success("Assunto salvo.");
            } catch (e) {
              toast.error(errMsg(e));
            }
          }}
        >
          Adicionar assunto
        </Button>
      </div>
      <datalist id="taxonomy-subjects-mgr">
        {tax.subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      {!tax.subjects.length ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> Nenhuma matéria cadastrada ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {tax.subjects.map((s) => (
            <li key={s.id} className="rounded-md border px-3 py-2">
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.topics.length
                  ? s.topics.map((t) => t.name).join(" · ")
                  : "Sem assuntos"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
