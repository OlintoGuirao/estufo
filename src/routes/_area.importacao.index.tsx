import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { useMe } from "@/hooks/use-auth";
import { examImportService } from "@/services/exam-import.service";
import { EXAM_IMPORT_MAX_BYTES } from "@/lib/exam-import/validate";
import type { ExamImportMetadata } from "@/types/exam-import";

export const Route = createFileRoute("/_area/importacao/")({
  head: () => ({
    meta: [
      { title: "Importar provas — Estufoo" },
      {
        name: "description",
        content: "Envio manual de PDF de prova e gabarito para revisão antes da publicação.",
      },
    ],
  }),
  component: ImportacaoPage,
});

function ImportacaoPage() {
  const me = useMe();
  const qc = useQueryClient();
  const email = me.data?.email ?? "";

  const access = useQuery({
    queryKey: ["exam-import-access", email],
    queryFn: () => examImportService.canAccess(email),
    enabled: !!email,
  });

  const list = useQuery({
    queryKey: ["exam-imports"],
    queryFn: () => examImportService.list(),
  });

  const [examFile, setExamFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [authOk, setAuthOk] = useState(false);
  const [force, setForce] = useState(false);
  const [meta, setMeta] = useState<ExamImportMetadata>({
    board: "Vunesp",
    organ: "",
    role: "",
    year: new Date().getFullYear(),
    examName: "",
    bookletType: "",
    sourceUrl: "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!examFile) throw new Error("Selecione o PDF da prova.");
      if (!email) throw new Error("Faça login para importar.");
      return examImportService.submit({
        examFile,
        answerKeyFile: answerFile,
        metadata: meta,
        authorizationConfirmed: authOk,
        actorEmail: email,
        force,
      });
    },
    onSuccess: (batch) => {
      qc.invalidateQueries({ queryKey: ["exam-imports"] });
      toast.success("Prova processada — revise antes de publicar.");
      window.location.assign(`/importacao/${batch.id}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const blocked = access.data && !access.data.allowed;

  return (
    <>
      <PageHeader
        title="Importar provas (PDF)"
        description="Envio manual por usuário autorizado. Sem scraping automático. Rascunhos não aparecem para alunos até aprovação."
      />

      <Panel className="mb-6 border-amber-500/40 bg-amber-500/5">
        <div className="flex gap-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-medium">Persistência mock (localStorage)</p>
            <p className="text-muted-foreground">
              Metadados e rascunhos ficam em <code className="text-xs">estufoo.exam-imports</code>. PDFs
              vão para pasta privada do servidor (<code className="text-xs">.data/exam-imports</code>), não
              para o frontend público. Isso{" "}
              <strong>não</strong> é persistência de produção.
            </p>
          </div>
        </div>
      </Panel>

      {access.isLoading ? (
        <ListSkeleton />
      ) : access.error ? (
        <ErrorState error={access.error} onRetry={() => access.refetch()} />
      ) : blocked ? (
        <EmptyState title="Sem permissão" description={access.data?.reason} />
      ) : (
        <Panel className="mb-8 space-y-4">
          {access.data?.mode === "local-open" && (
            <p className="text-sm text-muted-foreground" role="status">
              {access.data.reason}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="PDF da prova *" htmlFor="exam-pdf">
              <Input
                id="exam-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Máx. {Math.round(EXAM_IMPORT_MAX_BYTES / (1024 * 1024))} MB · apenas PDF
              </p>
            </Field>
            <Field label="PDF do gabarito (opcional)" htmlFor="answer-pdf">
              <Input
                id="answer-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Banca *" htmlFor="board">
              <NativeSelect
                id="board"
                value={meta.board}
                onChange={(e) => setMeta({ ...meta, board: e.target.value })}
              >
                <option>Vunesp</option>
                <option>Cebraspe</option>
                <option>FGV</option>
                <option>FCC</option>
                <option>Outra</option>
              </NativeSelect>
            </Field>
            <Field label="Ano *" htmlFor="year">
              <Input
                id="year"
                type="number"
                value={meta.year}
                onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) })}
              />
            </Field>
            <Field label="Órgão *" htmlFor="organ">
              <Input
                id="organ"
                value={meta.organ}
                onChange={(e) => setMeta({ ...meta, organ: e.target.value })}
                placeholder="Ex.: Tribunal de Justiça de SP"
              />
            </Field>
            <Field label="Cargo *" htmlFor="role">
              <Input
                id="role"
                value={meta.role}
                onChange={(e) => setMeta({ ...meta, role: e.target.value })}
                placeholder="Ex.: Escrevente Técnico Judiciário"
              />
            </Field>
            <Field label="Nome da prova *" htmlFor="examName">
              <Input
                id="examName"
                value={meta.examName}
                onChange={(e) => setMeta({ ...meta, examName: e.target.value })}
              />
            </Field>
            <Field label="Tipo / caderno" htmlFor="booklet">
              <Input
                id="booklet"
                value={meta.bookletType}
                onChange={(e) => setMeta({ ...meta, bookletType: e.target.value })}
                placeholder="Ex.: Tipo 1 / Caderno A"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="URL de origem" htmlFor="sourceUrl">
                <Input
                  id="sourceUrl"
                  value={meta.sourceUrl}
                  onChange={(e) => setMeta({ ...meta, sourceUrl: e.target.value })}
                  placeholder="https://… (referência manual, sem download automático)"
                />
              </Field>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="auth"
              checked={authOk}
              onCheckedChange={(v) => setAuthOk(v === true)}
            />
            <Label htmlFor="auth" className="text-sm font-normal leading-snug">
              Confirmo que tenho autorização legal para enviar e processar estes arquivos e que não estou
              automatizando acesso a sites de bancas.
            </Label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="force" checked={force} onCheckedChange={(v) => setForce(v === true)} />
            <Label htmlFor="force" className="text-sm font-normal leading-snug">
              Forçar reimportação se o hash ou metadados já existirem (não sobrescreve questões já
              publicadas).
            </Label>
          </div>

          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !examFile || !authOk || !meta.organ || !meta.role || !meta.examName}
          >
            <FileUp />
            {submit.isPending ? "Processando…" : "Enviar e extrair"}
          </Button>
        </Panel>
      )}

      <h2 className="mb-3 text-lg font-semibold">Importações recentes</h2>
      {list.isLoading ? (
        <ListSkeleton />
      ) : !list.data?.length ? (
        <EmptyState title="Nenhuma importação ainda" />
      ) : (
        <ul className="space-y-2">
          {list.data.map((b) => (
            <li key={b.id}>
              <Link
                to="/importacao/$id"
                params={{ id: b.id }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-accent/40"
              >
                <span>
                  <span className="font-medium">{b.metadata.examName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {b.metadata.board} {b.metadata.year} · {b.questions.length} questões
                  </span>
                </span>
                <Badge variant="outline">{b.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
