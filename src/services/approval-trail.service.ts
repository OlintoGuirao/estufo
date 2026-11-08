import { ApiError } from "./api";
import { analyzeEditalPdf } from "./approval-trail.fns";
import { generateSubjectStudyMaterialFn } from "./trail-subject-material.fns";
import { approvalTrailStore } from "./approval-trail-store";
import type { ApprovalTrail } from "@/types/approval-trail";

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

function parseErr(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const payload = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(payload.message ?? "Erro na análise.", payload.status ?? 500);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error ? new ApiError(e.message, 500) : new ApiError("Erro na análise.", 500);
}

function weeksNeedRebuild(trail: ApprovalTrail): boolean {
  if (!trail.weeks.length) return true;
  // Formato antigo: uma carta "Segunda–Sexta" com a semana inteira.
  if (
    trail.weeks.some((w) =>
      /Segunda\s*[–-]\s*(Sexta|Sábado)/i.test(w.dayLabel ?? ""),
    )
  ) {
    return true;
  }
  // Direito com poucos artigos por dia (<10) → remonta em blocos de ≥10.
  const articleDays = trail.weeks.filter((w) => /\bArts?\.?\s*\d/i.test(w.focus ?? ""));
  if (articleDays.some((w) => (w.topicIds?.length ?? 0) < 10)) return true;
  const soloArticles = articleDays.filter((w) => (w.topicIds?.length ?? 0) === 1);
  if (soloArticles.length >= 1) return true;

  // Português etc.: 1 assunto/dia → remonta em blocos de vários/dia.
  for (const s of trail.subjects) {
    const assuntos = s.topics.filter(
      (t) =>
        !!t.explanation?.trim() &&
        t.kind !== "artigo" &&
        !t.articleRef &&
        !/\bArts?\.?\s*\d/i.test(t.name),
    );
    if (assuntos.length < 3) continue;
    const ids = new Set(assuntos.map((t) => t.id));
    const days = trail.weeks.filter((w) => (w.topicIds ?? []).some((id) => ids.has(id)));
    if (days.length >= 3 && days.every((w) => (w.topicIds?.length ?? 0) === 1)) {
      return true;
    }
  }

  // Semanas “furadas” (matéria nova começava na segunda seguinte) → remonta contínuo.
  const byWeekNum = new Map<number, number>();
  for (const w of trail.weeks) {
    const wn = w.weekNumber ?? w.week;
    byWeekNum.set(wn, (byWeekNum.get(wn) ?? 0) + 1);
  }
  const weekCounts = [...byWeekNum.entries()].sort((a, b) => a[0] - b[0]);
  if (weekCounts.length >= 2) {
    const maxPerWeek = Math.max(...weekCounts.map(([, c]) => c));
    for (let i = 0; i < weekCounts.length - 1; i++) {
      if ((weekCounts[i]?.[1] ?? 0) < maxPerWeek) return true;
    }
  }

  // Quebra no meio da semana: Quarta → Segunda (matéria reiniciava o dayIdx).
  const ordered = [...trail.weeks].sort((a, b) => a.week - b.week);
  const weekdayVals = ordered
    .map((w) => w.weekday)
    .filter((x): x is number => typeof x === "number");
  const maxWd = weekdayVals.length ? Math.max(...weekdayVals) : 5;
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (prev.weekday == null || cur.weekday == null) continue;
    if (cur.weekday < prev.weekday && prev.weekday < maxWd) return true;
  }
  return false;
}

export const approvalTrailService = {
  get(): ApprovalTrail | null {
    return approvalTrailStore.get();
  },

  async hydrate(): Promise<ApprovalTrail | null> {
    const trail = await approvalTrailStore.hydrate();
    if (!trail) return null;

    // Códigos/leis órfãos (ex.: CPC) → dentro do Direito Processual Civil etc.
    const { mergeOrphanLawSubjects } = await import("@/lib/approval-trail/extract-program");
    const mergedSubjects = mergeOrphanLawSubjects(trail.subjects).map((s, i) => ({
      ...s,
      order: i + 1,
    }));
    const subjectsChanged =
      mergedSubjects.length !== trail.subjects.length ||
      mergedSubjects.some((s, i) => s.id !== trail.subjects[i]?.id);
    const withSubjects = subjectsChanged
      ? approvalTrailStore.save({ ...trail, subjects: mergedSubjects })
      : trail;

    if (
      !withSubjects.scheduleUnlocked &&
      !withSubjects.subjects.some((s) => s.topics.some((t) => !!t.explanation?.trim()))
    ) {
      return withSubjects;
    }
    // Remonta se matérias fundidas, formato antigo ou artigos isolados.
    if (subjectsChanged || weeksNeedRebuild(withSubjects)) {
      return approvalTrailService.rebuildDaySchedule(withSubjects);
    }
    return withSubjects;
  },

  /** Remonta o cronograma: 1 card por dia (assuntos vários/dia; artigos ≥10/dia). */
  async rebuildDaySchedule(existing?: ApprovalTrail | null): Promise<ApprovalTrail | null> {
    const trail = existing ?? approvalTrailStore.get();
    if (!trail) return null;

    const { studyScheduleStore } = await import("./study-schedule-store");
    await studyScheduleStore.hydrate();
    const studyDays = studyScheduleStore.get().studyDays;

    const { buildWeeksFromSubjects } = await import("@/lib/approval-trail/build-weeks");
    const weeks = buildWeeksFromSubjects({
      subjects: trail.subjects,
      weeksTarget: trail.weeksTarget ?? 10,
      hoursPerWeek: trail.hoursPerWeek ?? 2,
      studyDays,
      onlyWithMaterial: true,
    });

    const saved = approvalTrailStore.save({
      ...trail,
      weeks,
      scheduleUnlocked: weeks.length > 0 ? true : trail.scheduleUnlocked,
    });

    const { trailProgressService } = await import("./trail-progress.service");
    trailProgressService.remapByTopics(
      saved.id,
      weeks.map((w) => ({ week: w.week, topicIds: w.topicIds })),
    );

    return saved;
  },

  clear(): void {
    approvalTrailStore.clear();
  },

  setTopicStatus(
    subjectId: string,
    topicId: string,
    status: ApprovalTrail["subjects"][0]["topics"][0]["status"],
  ): ApprovalTrail | null {
    return approvalTrailStore.updateTopicStatus(subjectId, topicId, status);
  },

  setTopicsStatusByIds(
    topicIds: string[],
    status: ApprovalTrail["subjects"][0]["topics"][0]["status"],
  ): ApprovalTrail | null {
    return approvalTrailStore.updateTopicsStatusByIds(topicIds, status);
  },

  addCustomTopic(subjectId: string, name?: string): ApprovalTrail | null {
    return approvalTrailStore.addCustomTopic(subjectId, name ? { name } : undefined);
  },

  updateTopicName(subjectId: string, topicId: string, name: string): ApprovalTrail | null {
    return approvalTrailStore.updateTopicName(subjectId, topicId, name);
  },

  removeTopic(subjectId: string, topicId: string): ApprovalTrail | null {
    return approvalTrailStore.removeTopic(subjectId, topicId);
  },

  /**
   * Gera material didático (o que cada artigo/assunto significa) para uma matéria,
   * em lotes — sem resumir a lista do edital.
   */
  async generateSubjectMaterial(
    subjectId: string,
    opts?: {
      /** Em lote (Gerar tudo): monta o cronograma uma vez só no fim. */
      skipSchedule?: boolean;
      onProgress?: (done: number, total: number) => void;
    },
  ): Promise<ApprovalTrail> {
    const trail = approvalTrailStore.get();
    if (!trail) throw new ApiError("Nenhuma trilha encontrada.", 404);
    const subject = trail.subjects.find((s) => s.id === subjectId);
    if (!subject) throw new ApiError("Matéria não encontrada.", 404);

    const pending = subject.topics.filter((t) => !t.explanation?.trim());
    const queue = pending.length ? pending : subject.topics;
    // Lotes menores em paralelo (3 por vez): antes eram lotes de 10 um atrás do
    // outro — 40 etapas = 4 esperas longas em fila.
    const chunkSize = 6;
    const chunks: (typeof queue)[] = [];
    for (let i = 0; i < queue.length; i += chunkSize) chunks.push(queue.slice(i, i + chunkSize));
    let doneTopics = 0;
    let firstError: unknown = null;

    const runChunk = async (chunk: typeof queue) => {
      try {
        const res = await generateSubjectStudyMaterialFn({
          data: {
            subjectName: subject.name,
            contestName: trail.contestName,
            board: trail.board,
            items: chunk.map((t) => {
              const row: {
                id: string;
                name: string;
                notes: string;
                articleRef?: string;
                kind?: string;
              } = { id: t.id, name: t.name, notes: t.notes };
              if (t.articleRef) row.articleRef = t.articleRef.slice(0, 120);
              if (t.kind) row.kind = t.kind.slice(0, 40);
              return row;
            }),
          },
        });
        // Grava a cada lote: se algo falhar depois, o que já veio não se perde.
        approvalTrailStore.applyTopicExplanations(subjectId, res.items);
      } catch (e) {
        firstError ??= e;
      } finally {
        doneTopics += chunk.length;
        opts?.onProgress?.(doneTopics, queue.length);
      }
    };

    let next = 0;
    const workers = Array.from({ length: Math.min(3, chunks.length) }, async () => {
      while (next < chunks.length) await runChunk(chunks[next++]!);
    });
    await Promise.all(workers);

    const afterMaterial = approvalTrailStore.get();
    if (!afterMaterial) throw new ApiError("Falha ao salvar material.", 500);
    if (firstError) {
      // Salva o que deu certo antes de avisar o erro.
      await approvalTrailStore.saveNow(afterMaterial);
      return parseErr(firstError);
    }
    if (opts?.skipSchedule) return afterMaterial;
    return approvalTrailService.rebuildScheduleFromMaterial();
  },

  /** Monta o cronograma pelos dias de estudo × matérias com material. */
  async rebuildScheduleFromMaterial(): Promise<ApprovalTrail> {
    const afterMaterial = approvalTrailStore.get();
    if (!afterMaterial) throw new ApiError("Falha ao salvar material.", 500);

    // Monta cronograma pelos dias de estudo (Configurações) × matéria.
    const { studyScheduleStore } = await import("./study-schedule-store");
    await studyScheduleStore.hydrate();
    const studyDays = studyScheduleStore.get().studyDays;

    const { buildWeeksFromSubjects } = await import("@/lib/approval-trail/build-weeks");
    const weeks = buildWeeksFromSubjects({
      subjects: afterMaterial.subjects,
      weeksTarget: afterMaterial.weeksTarget ?? 10,
      hoursPerWeek: afterMaterial.hoursPerWeek ?? 2,
      studyDays,
      onlyWithMaterial: true,
    });

    const saved = await approvalTrailStore.saveNow({
      ...afterMaterial,
      weeks,
      scheduleUnlocked: true,
    });

    // Preserva progresso do aluno realinhando pelos topicIds das sessões.
    const { trailProgressService } = await import("./trail-progress.service");
    trailProgressService.remapByTopics(
      saved.id,
      weeks.map((w) => ({ week: w.week, topicIds: w.topicIds })),
    );

    return saved;
  },

  async analyzeFromPdf(input: {
    file: File;
    hoursPerWeek?: number;
    weeksTarget?: number;
  }): Promise<ApprovalTrail> {
    try {
      const pdfBase64 = await fileToBase64(input.file);
      const trail = await analyzeEditalPdf({
        data: {
          pdfBase64,
          fileName: input.file.name,
          mimeType: input.file.type || "application/pdf",
          hoursPerWeek: input.hoursPerWeek ?? 2,
          weeksTarget: input.weeksTarget ?? 10,
        },
      });
      return approvalTrailStore.save(trail);
    } catch (e) {
      return parseErr(e);
    }
  },
};
