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
    const { enrichNotesWithSources } = await import(
      "@/lib/approval-trail/fetch-edital-source"
    );

    // Busca textos oficiais (TJSP/eSAJ) quando o edital traz link.
    const items = [];
    for (const it of data.items) {
      const rawNotes = it.notes ?? "";
      const notes =
        /https?:\/\//i.test(rawNotes) || /legisla|resolu|regimento|corregedoria/i.test(data.subjectName)
          ? await enrichNotesWithSources(rawNotes)
          : rawNotes;
      items.push({
        id: it.id,
        name: it.name,
        notes,
        ...(it.articleRef ? { articleRef: it.articleRef } : {}),
        ...(it.kind ? { kind: it.kind } : {}),
      });
    }

    const mock = mockSubjectMaterial(items, data.subjectName);
    const result = await tutorChat(
      buildSubjectMaterialMessages({
        subjectName: data.subjectName,
        contestName: data.contestName ?? "",
        board: data.board ?? "",
        items,
      }),
      {
        mockText: JSON.stringify({
          items: mock.map((m) => ({ id: m.id, explanation: m.explanation })),
        }),
      },
    );

    const parsed = parseSubjectMaterialJson(result.text, items, data.subjectName);
    return {
      items: parsed,
      model: result.model,
      mocked: !!result.mocked,
    };
  });
