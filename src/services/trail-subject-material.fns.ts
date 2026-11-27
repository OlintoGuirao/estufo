import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(300),
  notes: z.string().max(14_000).optional().default(""),
  articleRef: z.string().max(120).optional(),
  kind: z.string().max(40).optional(),
});

/** Gera explicação didática de cada etapa/artigo de uma matéria. */
export const generateSubjectStudyMaterialFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subjectName: z.string().min(1).max(200),
      contestName: z.string().max(240).optional().default(""),
      board: z.string().max(120).optional().default(""),
      items: z.array(itemSchema).min(1).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const {
      buildSubjectMaterialMessages,
      mockSubjectMaterial,
      parseSubjectMaterialJson,
    } = await import("@/lib/approval-trail/study-material-ai");
    const { tutorChat } = await import("@/server/tutor-llm");

    const needsSources =
      /legisla|resolu|regimento|corregedoria/i.test(data.subjectName) ||
      data.items.some((it) => /https?:\/\//i.test(it.notes ?? ""));
    const sourceMod = needsSources ? await import("@/lib/approval-trail/fetch-edital-source") : null;
    // Um fetcher por requisição: itens com o mesmo link baixam uma vez só,
    // sem compartilhar Promise com outra requisição (proibido no Workers).
    const fetchSource = sourceMod?.createSourceFetcher();
    const enrichNotesWithSources =
      sourceMod && fetchSource ? (n: string) => sourceMod.enrichNotesWithSources(n, fetchSource) : null;

    // Busca textos oficiais (TJSP/eSAJ) quando o edital traz link — todos os
    // itens em paralelo (antes era um por vez, até 12 s cada).
    const items = await Promise.all(
      data.items.map(async (it) => {
        const rawNotes = it.notes ?? "";
        const notes =
          enrichNotesWithSources &&
          (/https?:\/\//i.test(rawNotes) ||
            /legisla|resolu|regimento|corregedoria/i.test(data.subjectName))
            ? await enrichNotesWithSources(rawNotes)
            : rawNotes;
        return {
          id: it.id,
          name: it.name,
          notes,
          ...(it.articleRef ? { articleRef: it.articleRef } : {}),
          ...(it.kind ? { kind: it.kind } : {}),
        };
      }),
    );

    const ask = async (list: typeof items) => {
      const mock = mockSubjectMaterial(list, data.subjectName);
      const result = await tutorChat(
        buildSubjectMaterialMessages({
          subjectName: data.subjectName,
          contestName: data.contestName ?? "",
          board: data.board ?? "",
          items: list,
        }),
        {
          task: "material",
          mockText: JSON.stringify({
            items: mock.map((m) => ({ id: m.id, explanation: m.explanation })),
          }),
        },
      );
      return {
        result,
        parsed: parseSubjectMaterialJson(result.text, list, data.subjectName, {
          mocked: !!result.mocked,
        }),
      };
    };

    const first = await ask(items);
    let parsed = first.parsed;
    // Uma nova tentativa SÓ com o que veio faltando/errado (lote menor).
    if (parsed.missingIds.length) {
      console.warn(
        "[material] itens recusados:",
        parsed.rejected.map((r) => `${r.id}: ${r.reason}`).join(" | "),
      );
      const retryItems = items.filter((i) => parsed.missingIds.includes(i.id));
      const second = await ask(retryItems);
      parsed = {
        items: [...parsed.items, ...second.parsed.items],
        missingIds: second.parsed.missingIds,
        rejected: second.parsed.rejected,
      };
    }

    return {
      items: parsed.items,
      missingIds: parsed.missingIds,
      model: first.result.model,
      mocked: !!first.result.mocked,
    };
  });
