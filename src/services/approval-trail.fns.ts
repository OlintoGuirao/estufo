import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_TEXT = 90_000;

const inputSchema = z.object({
  pdfBase64: z.string().min(1),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().max(100),
  /** Horas por dia de estudo (campo do formulário; nome legado hoursPerWeek). */
  hoursPerWeek: z.number().min(1).max(12).optional().default(2),
  weeksTarget: z.number().int().min(4).max(24).optional().default(10),
});

export const analyzeEditalPdf = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const { validatePdfUpload, decodeBase64ToBytes, looksLikePdf } = await import(
      "@/lib/exam-import/validate"
    );
    const sizeApprox = Math.ceil((data.pdfBase64.length * 3) / 4);
    const check = validatePdfUpload({
      fileName: data.fileName,
      mimeType: data.mimeType || "application/pdf",
      sizeBytes: sizeApprox,
    });
    if (!check.ok) {
      throw new Error(JSON.stringify({ message: check.message, status: 400 }));
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64ToBytes(data.pdfBase64);
    } catch {
      throw new Error(JSON.stringify({ message: "PDF inválido (base64).", status: 400 }));
    }
    if (!looksLikePdf(bytes)) {
      throw new Error(JSON.stringify({ message: "O arquivo não parece um PDF.", status: 400 }));
    }
    const exact = validatePdfUpload({
      fileName: data.fileName,
      mimeType: data.mimeType || "application/pdf",
      sizeBytes: bytes.byteLength,
    });
    if (!exact.ok) {
      throw new Error(JSON.stringify({ message: exact.message, status: 400 }));
    }

    const { extractPdfPages } = await import("@/server/exam-import/extract-pdf");
    const extractedPdf = await extractPdfPages(bytes);
    if (extractedPdf.needsOcr || !extractedPdf.textExtractable) {
      throw new Error(
        JSON.stringify({
          message:
            "Não há texto selecionável neste PDF (possível escaneado). OCR não está habilitado — use um edital com texto ou um PDF pesquisável.",
          status: 422,
        }),
      );
    }

    const fullText = extractedPdf.pages
      .map((p) => `--- Página ${p.page} ---\n${p.text}`)
      .join("\n\n")
      .trim();
    if (fullText.length < 80) {
      throw new Error(
        JSON.stringify({
          message: "Texto extraído insuficiente para montar um plano.",
          status: 422,
        }),
      );
    }

    // 1) Fonte da verdade: conteúdo programático → matérias + etapas (artigos/itens)
    const { extractProgramFromEditalText, extractedToTrailSubjects } = await import(
      "@/lib/approval-trail/extract-program"
    );
    const program = extractProgramFromEditalText(fullText);
    const subjects = extractedToTrailSubjects(program.subjects);

    if (!subjects.length) {
      throw new Error(
        JSON.stringify({
          message:
            "Não encontrei o conteúdo programático detalhado no PDF. Confira se o anexo com blocos/matérias está com texto selecionável.",
          status: 422,
        }),
      );
    }

    // Cronograma só nasce depois de "Gerar material" na UI.
    const weeks: import("@/types/approval-trail").TrailWeek[] = [];

    // 2) IA só preenche metadados (nome, banca, cargo) — não resume matérias
    const clipped =
      fullText.length > MAX_TEXT
        ? `${fullText.slice(0, MAX_TEXT)}\n\n[…texto truncado…]`
        : fullText;

    const { EDITAL_PLAN_SYSTEM, buildTrailMetaFromAiText } = await import(
      "@/lib/approval-trail/parse-ai-plan"
    );
    const { tutorChat } = await import("@/server/tutor-llm");

    const etapasCount = subjects.reduce((n, s) => n + s.topics.length, 0);
    const mockText = JSON.stringify({
      contestName: /TJSP|S[AÃ]O PAULO/i.test(fullText)
        ? "TJSP — Escrevente Técnico Judiciário"
        : data.fileName.replace(/\.pdf$/i, ""),
      organ: /TRIBUNAL DE JUSTI[CÇ]A/i.test(fullText)
        ? "Tribunal de Justiça do Estado de São Paulo"
        : "Órgão do edital",
      role: /Escrevente/i.test(fullText) ? "Escrevente Técnico Judiciário" : "Cargo do edital",
      board: /VUNESP/i.test(fullText) ? "VUNESP" : "Banca do edital",
      examDate: null,
      summary: `Plano com ${subjects.length} matérias e ${etapasCount} etapas tiradas do conteúdo programático (artigos e itens do edital), sem resumir a cobrança.`,
      warnings: program.warnings,
    });

    const result = await tutorChat(
      [
        { role: "system", content: EDITAL_PLAN_SYSTEM },
        {
          role: "user",
          content: `Já extraí ${subjects.length} matérias e ${etapasCount} etapas de estudo do conteúdo programático (não altere isso).
Devolva só metadados do concurso.

Prévia das matérias: ${subjects.map((s) => `${s.name} (${s.topics.length} etapas)`).join("; ")}

TEXTO DO EDITAL (início):
${clipped.slice(0, 24_000)}`,
        },
      ],
      { task: "generic", json: true, mockText },
    );

    const meta = buildTrailMetaFromAiText(result.text, { fileName: data.fileName });
    const now = new Date().toISOString();

    return {
      id: `trail_${Date.now().toString(36)}`,
      createdAt: now,
      updatedAt: now,
      fileName: data.fileName,
      contestName: meta.contestName,
      organ: meta.organ,
      role: meta.role,
      board: meta.board,
      examDate: meta.examDate,
      summary: meta.summary,
      subjects,
      weeks,
      warnings: [
        ...program.warnings,
        ...meta.warnings,
        `Etapas montadas a partir do edital: ${etapasCount} (não resumidas pela IA).`,
        "O cronograma semanal aparece após você clicar em Gerar material em uma matéria.",
      ],
      sourceTextChars: fullText.length,
      mocked: !!result.mocked,
      hoursPerWeek: data.hoursPerWeek,
      weeksTarget: data.weeksTarget,
      scheduleUnlocked: false,
    };
  });
