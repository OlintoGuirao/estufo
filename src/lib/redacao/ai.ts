import type { OllamaChatMessage } from "@/server/ollama/client";
import type {
  RedacaoCompetency,
  RedacaoCorrection,
  RedacaoImprovementPoint,
  RedacaoTheme,
} from "@/types/redacao";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  return (m?.[1] ?? t).trim();
}

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}_${Date.now().toString(36)}`;
}

function themeMeta(contestName: string, board: string): Pick<RedacaoTheme, "contestName" | "board"> {
  const out: Pick<RedacaoTheme, "contestName" | "board"> = {};
  if (contestName) out.contestName = contestName;
  if (board) out.board = board;
  return out;
}

export function buildThemeMessages(input: {
  contestName: string;
  organ: string;
  role: string;
  board: string;
  summary: string;
  subjects: string[];
  openImprovements: string[];
  count: number;
}): OllamaChatMessage[] {
  return [
    {
      role: "system",
      content: `Você é professor de redação para concursos públicos brasileiros.
Gere temas ATUAIS e PROVÁVEIS de redação com base no edital/banca informados.
Priorize dissertativa-argumentativa (padrão da maioria das bancas).
Responda SOMENTE JSON válido:
{"themes":[{"title":"...","prompt":"proposta completa (comando da redação)","context":"2-4 linhas com motivadores/atualidade","likelihood":"alta"|"media"}]}
Regras: exatamente ${input.count} temas; títulos distintos; prompt com comando claro (posição, argumentos, conclusão); sem inventar lei inexistente.`,
    },
    {
      role: "user",
      content: `Concurso: ${input.contestName}
Órgão: ${input.organ}
Cargo: ${input.role}
Banca: ${input.board || "não informada"}
Resumo do edital: ${input.summary || "(sem resumo)"}
Matérias do edital: ${input.subjects.join("; ") || "(não listadas)"}
Pontos que o aluno ainda precisa melhorar (leve em conta ao variar os temas): ${
        input.openImprovements.length
          ? input.openImprovements.join(" | ")
          : "(nenhum ainda)"
      }
Gere ${input.count} temas prováveis e atuais.`,
    },
  ];
}

export function mockThemes(input: {
  contestName: string;
  board: string;
  count: number;
}): RedacaoTheme[] {
  const now = new Date().toISOString();
  const bank = input.board || "banca do concurso";
  const meta = themeMeta(input.contestName, input.board);
  const base = [
    {
      title: "Desinformação e responsabilidade social nas redes",
      prompt: `Com base nos textos motivadores e nos seus conhecimentos, redija um texto dissertativo-argumentativo sobre os desafios do combate à desinformação nas redes sociais e o papel do cidadão e do Estado. Apresente tese clara, dois argumentos e proposta de intervenção.`,
      context: `Tema recorrente em provas recentes (${bank}): fake news, liberdade de expressão e dever de informação.`,
      likelihood: "alta" as const,
    },
    {
      title: "Acesso à justiça e cidadania no Brasil",
      prompt: `Redija um texto dissertativo-argumentativo discutindo obstáculos ao acesso à justiça no Brasil e caminhos para ampliar a cidadania. Defenda um ponto de vista com argumentos e conclusão.`,
      context: `Alinhado a editais de tribunais e órgãos públicos; cidadania e direitos fundamentais.`,
      likelihood: "alta" as const,
    },
    {
      title: "Trabalho, tecnologia e dignidade humana",
      prompt: `Elabore uma dissertação argumentativa sobre os impactos da automação e da inteligência artificial no mundo do trabalho, defendendo medidas que preservem a dignidade humana.`,
      context: `Atualidades + ética no serviço público; comum em bancas objetivas com redação.`,
      likelihood: "media" as const,
    },
    {
      title: "Educação pública e equidade de oportunidades",
      prompt: `Produza um texto dissertativo-argumentativo sobre a importância da educação pública de qualidade para a redução das desigualdades no Brasil.`,
      context: `Tema clássico e atual; encaixa bem no perfil de ${input.contestName || "concursos"}.`,
      likelihood: "media" as const,
    },
    {
      title: "Saúde mental no serviço público",
      prompt: `Redija um texto dissertativo-argumentativo sobre a valorização da saúde mental dos servidores e o impacto no atendimento ao cidadão.`,
      context: `Tema contemporâneo com boa aderência a editais de administração pública.`,
      likelihood: "alta" as const,
    },
  ];
  return base.slice(0, Math.max(1, Math.min(input.count, base.length))).map((t) => ({
    id: uid("theme"),
    title: t.title,
    prompt: t.prompt,
    context: t.context,
    genre: "dissertativa-argumentativa" as const,
    likelihood: t.likelihood,
    ...meta,
    createdAt: now,
  }));
}

export function parseThemesJson(
  text: string,
  meta: { contestName: string; board: string; count: number },
): RedacaoTheme[] {
  try {
    const raw = JSON.parse(stripJsonFence(text)) as unknown;
    const obj = asObj(raw);
    const arr = Array.isArray(obj?.["themes"])
      ? (obj!["themes"] as unknown[])
      : Array.isArray(raw)
        ? raw
        : null;
    if (!arr?.length) return mockThemes(meta);
    const now = new Date().toISOString();
    const themeExtras = themeMeta(meta.contestName, meta.board);
    const themes: RedacaoTheme[] = [];
    for (const item of arr) {
      const o = asObj(item);
      if (!o) continue;
      const title = String(o["title"] ?? "").trim();
      const prompt = String(o["prompt"] ?? "").trim();
      if (!title || !prompt) continue;
      const likelihood = o["likelihood"] === "media" ? "media" : "alta";
      themes.push({
        id: uid("theme"),
        title: title.slice(0, 180),
        prompt: prompt.slice(0, 2500),
        context: String(o["context"] ?? "").trim().slice(0, 800) || "Tema alinhado ao edital.",
        genre: "dissertativa-argumentativa",
        likelihood,
        ...themeExtras,
        createdAt: now,
      });
      if (themes.length >= meta.count) break;
    }
    return themes.length ? themes : mockThemes(meta);
  } catch {
    return mockThemes(meta);
  }
}

export function buildCorrectionMessages(input: {
  contestName: string;
  board: string;
  themeTitle: string;
  themePrompt: string;
  essayBody: string;
  focusPoints: { area: string; tip: string }[];
}): OllamaChatMessage[] {
  return [
    {
      role: "system",
      content: `Você corrige redações de concurso (dissertativa-argumentativa).
Critérios típicos: tese, argumentação, coesão/coerência, repertório, norma culta, conclusão/proposta.
Responda SOMENTE JSON válido:
{"score":0-100,"maxScore":100,"competencies":[{"name":"...","score":0-20,"max":20,"feedback":"..."}],"strengths":["..."],"improvements":[{"area":"...","tip":"..."}],"overallFeedback":"...","resolvedFocus":["area que melhorou"]}
Regras: 4 a 5 competências; 2 a 4 melhorias acionáveis (sem reescrever a redação inteira); se o aluno melhorou um foco anterior, cite em resolvedFocus; tom didático e encorajador.`,
    },
    {
      role: "user",
      content: `Concurso: ${input.contestName || "não informado"}
Banca: ${input.board || "não informada"}
Tema: ${input.themeTitle}
Proposta: ${input.themePrompt}
Pontos de foco desta redação (corrigir com atenção especial): ${
        input.focusPoints.length
          ? input.focusPoints.map((p) => `${p.area}: ${p.tip}`).join(" | ")
          : "(nenhum)"
      }

TEXTO DO ALUNO:
${input.essayBody.slice(0, 12000)}`,
    },
  ];
}

export function mockCorrection(input: {
  essayId: string;
  focusPoints: { id: string; area: string; tip: string }[];
}): RedacaoCorrection {
  const now = new Date().toISOString();
  const competencies: RedacaoCompetency[] = [
    {
      name: "Tese e adequação ao tema",
      score: 16,
      max: 20,
      feedback: "Há tese reconhecível; aprofunde o recorte no 1º parágrafo.",
    },
    {
      name: "Argumentação",
      score: 14,
      max: 20,
      feedback: "Argumentos presentes, mas precisam de exemplos mais concretos.",
    },
    {
      name: "Coesão e coerência",
      score: 15,
      max: 20,
      feedback: "Sequência lógica ok; varie conectivos e evite repetições.",
    },
    {
      name: "Norma culta",
      score: 13,
      max: 20,
      feedback: "Revise concordância e pontuação em períodos longos.",
    },
    {
      name: "Conclusão / proposta",
      score: 14,
      max: 20,
      feedback: "Feche com proposta clara (agente, ação, meio e finalidade).",
    },
  ];
  const improvements: RedacaoImprovementPoint[] = [
    {
      id: uid("imp"),
      area: "Argumentação",
      tip: "Em cada parágrafo de desenvolvimento, cite um dado, fato ou repertório ligado ao tema.",
      fromEssayId: input.essayId,
      createdAt: now,
      status: "aberto",
    },
    {
      id: uid("imp"),
      area: "Norma culta",
      tip: "Releia em voz alta e quebre períodos com mais de três linhas.",
      fromEssayId: input.essayId,
      createdAt: now,
      status: "aberto",
    },
    {
      id: uid("imp"),
      area: "Conclusão",
      tip: "Na última seção, deixe explícitos agente + ação + meio + finalidade.",
      fromEssayId: input.essayId,
      createdAt: now,
      status: "aberto",
    },
  ];
  return {
    score: competencies.reduce((s, c) => s + c.score, 0),
    maxScore: competencies.reduce((s, c) => s + c.max, 0),
    competencies,
    strengths: [
      "Texto alinhado ao gênero dissertativo-argumentativo.",
      "Há esforço de organização em introdução, desenvolvimento e fechamento.",
    ],
    improvements,
    overallFeedback:
      "Boa base. Na próxima redação, foque nos pontos listados — eles serão cobrados de novo na correção.",
    correctedAt: now,
  };
}

export function parseCorrectionJson(
  text: string,
  meta: {
    essayId: string;
    focusPoints: { id: string; area: string; tip: string }[];
  },
): { correction: RedacaoCorrection; resolvedFocusAreas: string[] } {
  try {
    const raw = JSON.parse(stripJsonFence(text)) as unknown;
    const obj = asObj(raw);
    if (!obj) {
      return { correction: mockCorrection(meta), resolvedFocusAreas: [] };
    }
    const now = new Date().toISOString();
    const compsRaw = Array.isArray(obj["competencies"])
      ? (obj["competencies"] as unknown[])
      : [];
    const competencies: RedacaoCompetency[] = [];
    for (const c of compsRaw) {
      const o = asObj(c);
      if (!o) continue;
      const name = String(o["name"] ?? "").trim();
      if (!name) continue;
      const max = Math.max(1, Number(o["max"]) || 20);
      const score = Math.min(max, Math.max(0, Number(o["score"]) || 0));
      competencies.push({
        name: name.slice(0, 80),
        score,
        max,
        feedback: String(o["feedback"] ?? "").trim().slice(0, 400) || "—",
      });
    }

    const improvements: RedacaoImprovementPoint[] = [];
    const impsRaw = Array.isArray(obj["improvements"])
      ? (obj["improvements"] as unknown[])
      : [];
    for (const it of impsRaw) {
      const o = asObj(it);
      if (!o) continue;
      const area = String(o["area"] ?? "").trim();
      const tip = String(o["tip"] ?? "").trim();
      if (!area || !tip) continue;
      improvements.push({
        id: uid("imp"),
        area: area.slice(0, 80),
        tip: tip.slice(0, 400),
        fromEssayId: meta.essayId,
        createdAt: now,
        status: "aberto",
      });
    }

    const strengths = (
      Array.isArray(obj["strengths"]) ? (obj["strengths"] as unknown[]) : []
    )
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 6);

    const resolvedFocusAreas = (
      Array.isArray(obj["resolvedFocus"]) ? (obj["resolvedFocus"] as unknown[]) : []
    )
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    let score = Number(obj["score"]);
    let maxScore = Number(obj["maxScore"]) || 100;
    if (!Number.isFinite(score) || score < 0) {
      score = competencies.reduce((s, c) => s + c.score, 0);
      maxScore = competencies.reduce((s, c) => s + c.max, 0) || 100;
    }

    if (!competencies.length || !improvements.length) {
      return { correction: mockCorrection(meta), resolvedFocusAreas };
    }

    return {
      correction: {
        score: Math.min(maxScore, Math.round(score)),
        maxScore,
        competencies,
        strengths: strengths.length
          ? strengths
          : ["Há estrutura de dissertação reconhecível."],
        improvements,
        overallFeedback:
          String(obj["overallFeedback"] ?? "").trim().slice(0, 1200) ||
          "Continue praticando com foco nos pontos a melhorar.",
        correctedAt: now,
      },
      resolvedFocusAreas,
    };
  } catch {
    return { correction: mockCorrection(meta), resolvedFocusAreas: [] };
  }
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
