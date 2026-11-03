import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Loader2, Network, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, GridSkeleton, PageHeader, formatDate } from "@/components/common";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { mindMapsService, tutorService } from "@/services";
import { EXAM_IMPORT_MAX_BYTES } from "@/lib/exam-import/validate";
import { syncStudyMindPack } from "@/services/study-mind-pack-db";
import type { Flashcard, MindPracticeQuestion } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/mapas/")({
  head: () => ({
    meta: [
      { title: "Mapas mentais — Estufoo" },
      {
        name: "description",
        content: "Envie seu material: a IA monta o mapa mental e os flashcards.",
      },
    ],
  }),
  component: Maps,
});

const SUBJECTS = [
  "Direito Processual Civil",
  "Direito Constitucional",
  "Direito Administrativo",
  "Direito Penal",
  "Língua Portuguesa",
  "Legislação Especial",
  "Informática",
  "Atualidades",
  "Outra",
];

function Maps() {
  const q = useQuery({ queryKey: ["mind-maps"], queryFn: mindMapsService.list });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Mapas mentais"
        description="Envie anotações ou PDF. A IA cria o mapa mental e os flashcards com base no que você mandar."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Novo projeto
          </Button>
        }
      />
      {q.isLoading ? (
        <GridSkeleton count={3} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data!.length ? (
        <EmptyState
          title="Nenhum projeto ainda"
          description="Clique em Novo projeto, envie o material e a IA monta o mapa."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> Novo projeto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((m) => (
            <Link
              key={m.id}
              to="/mapas/$id"
              params={{ id: m.id }}
              className="rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-primary"
            >
              <Network className="h-5 w-5 text-highlight" />
              <p className="mt-3 font-semibold">{m.title}</p>
              <p className="text-sm text-muted-foreground">
                {m.subject} · {m.nodeCount} nós
                {typeof m.flashcardCount === "number" ? ` · ${m.flashcardCount} cards` : ""}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Atualizado em {formatDate(m.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
      {open && <NewStudyProject onClose={() => setOpen(false)} />}
    </>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function NewStudyProject({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [material, setMaterial] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [detail, setDetail] = useState<"resumo" | "padrao" | "detalhado">("padrao");

  const create = useMutation({
    mutationFn: async () => {
      const text = material.trim();
      if (!title.trim()) throw new Error("Informe um título para o projeto.");
      if (text.length < 40 && !pdf) {
        throw new Error("Cole pelo menos um trecho do material (ou envie um PDF com texto).");
      }

      const pdfBase64 = pdf ? await fileToBase64(pdf) : undefined;
      const { pack, mocked } = await tutorService.generateStudyPack({
        title: title.trim(),
        subject,
        material: text || "(material apenas no PDF)",
        detail,
        flashcardCount: 10,
        ...(pdfBase64 ? { pdfBase64, fileName: pdf!.name } : {}),
      });

      const flashcards: Flashcard[] = pack.flashcards.map((c, i) => ({
        id: `fc_${i}_${Math.random().toString(36).slice(2, 7)}`,
        front: c.front,
        back: c.back,
        topic: c.topic,
        tags: c.tags,
        nodeId: c.nodeId ?? null,
        status: "novo" as const,
      }));

      const practiceQuestions: MindPracticeQuestion[] = (pack.questions ?? []).map(
        (c, i) => ({
          id: `pq_${i}_${Math.random().toString(36).slice(2, 7)}`,
          statement: c.statement,
          alternatives: c.alternatives,
          correctKey: c.correctKey,
          explanation: c.explanation,
          topic: c.topic,
          nodeId: c.nodeId ?? null,
        }),
      );

      const map = await mindMapsService.create({
        title: title.trim(),
        subject,
        ai: true,
        mocked,
        material: text,
        summary: pack.summary,
        warnings: pack.warnings,
        flashcards,
        practiceQuestions,
        studyPack: {
          centralTitle: pack.centralTitle,
          nodes: pack.nodes,
          links: pack.links,
        },
      });
      syncStudyMindPack(map);
      return { map, mocked };
    },
    onSuccess: ({ map, mocked }) => {
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      toast.success(
        mocked
          ? "Mapa demonstrativo criado (configure GEMINI_API_KEY para usar seu material de verdade)."
          : "Mapa criado: revise nós, flashcards e questões geradas pela IA.",
      );
      nav({ to: "/mapas/$id", params: { id: map.id } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const canSubmit =
    title.trim().length > 0 &&
    (material.trim().length >= 40 || !!pdf) &&
    !create.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo mapa a partir do material</DialogTitle>
          <DialogDescription>
            Cole anotações, lei seca ou resumo de aula — ou envie um PDF com texto. A IA monta o
            mapa mental e os flashcards só com o que você enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Título do projeto" htmlFor="t">
            <Input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: D. Processual Civil — CPC"
              disabled={create.isPending}
            />
          </Field>

          <Field label="Matéria" htmlFor="s">
            <NativeSelect
              id="s"
              value={subject}
              disabled={create.isPending}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Seu material" htmlFor="mat">
            <Textarea
              id="mat"
              rows={8}
              value={material}
              disabled={create.isPending}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Cole aqui o texto que você quer transformar em mapa mental…"
            />
          </Field>

          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center text-sm",
              pdf ? "border-primary bg-primary/5" : "border-muted-foreground/30",
            )}
          >
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">Ou envie um PDF</p>
            <label
              className={cn(
                "cursor-pointer text-sm text-primary underline-offset-2 hover:underline",
                create.isPending && "pointer-events-none opacity-50",
              )}
            >
              Escolher arquivo
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={create.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > EXAM_IMPORT_MAX_BYTES) {
                    toast.error("PDF muito grande.");
                    return;
                  }
                  setPdf(file);
                }}
              />
            </label>
            {pdf ? (
              <p className="text-xs text-muted-foreground">
                {pdf.name}{" "}
                <button
                  type="button"
                  className="underline"
                  disabled={create.isPending}
                  onClick={() => setPdf(null)}
                >
                  remover
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Somente PDF com texto selecionável</p>
            )}
          </div>

          <Field label="Nível de detalhe do mapa" htmlFor="det">
            <NativeSelect
              id="det"
              value={detail}
              disabled={create.isPending}
              onChange={(e) => setDetail(e.target.value as typeof detail)}
            >
              <option value="resumo">Resumo (menos nós)</option>
              <option value="padrao">Padrão</option>
              <option value="detalhado">Detalhado (mais ramos)</option>
            </NativeSelect>
          </Field>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-highlight" aria-hidden />
            Conteúdo gerado por IA — revise no editor depois. Sem inventar fora do material.
          </p>

          {create.isPending && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              A IA está lendo seu material e montando o mapa…
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => create.mutate()}>
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Criando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Criar mapa com a IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
