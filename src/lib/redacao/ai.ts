import type { OllamaChatMessage } from "@/server/ollama/client";
import type {
  RedacaoCompetency,
  RedacaoCorrection,
  RedacaoImprovementPoint,
  RedacaoSupportText,
  RedacaoTheme,
} from "@/types/redacao";
import { VUNESP_REDACAO_COMMAND } from "@/types/redacao";

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

function parseSupportTexts(raw: unknown): RedacaoSupportText[] {
  if (!Array.isArray(raw)) return [];
  const out: RedacaoSupportText[] = [];
  for (let i = 0; i < raw.length && out.length < 3; i++) {
    const o = asObj(raw[i]);
    if (!o) continue;
    const body = String(o["body"] ?? o["text"] ?? "").trim();
    if (body.length < 40) continue;
    out.push({
      label: String(o["label"] ?? `TEXTO ${out.length + 1}`)
        .trim()
        .toUpperCase()
        .slice(0, 20) || `TEXTO ${out.length + 1}`,
      body: body.slice(0, 1800),
      source: String(o["source"] ?? o["citation"] ?? "").trim().slice(0, 400) ||
        "(Fonte adaptada para treino.)",
    });
  }
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
      content: `Você elabora PROPOSTAS DE REDAÇÃO no padrão VUNESP (TJSP / concursos paulistas).

Formato OBRIGATÓRIO de cada tema (como na prova impressa):
1) Exatamente 3 textos motivadores (TEXTO 1, TEXTO 2, TEXTO 3), com vieses diferentes:
   - um com dado/estatística ou trecho jornalístico;
   - um com ângulo social/opinião;
   - um com desafio/crítica/contraste.
2) Cada texto: 4–8 linhas + "source" no estilo da banca, ex.:
   (Nome. Título da matéria. www.site.com.br, DD.MM.AAAA. Adaptado)
3) "prompt" = SEMPRE este comando (copie igual):
   "${VUNESP_REDACAO_COMMAND}"
4) "title" = tema em CAIXA ALTA, formulado como dilema/tensão (ex.: "ENTRE X E Y"), 1 linha.
5) "context" = 1–2 frases só para o card da lista (não aparece na prova).

PROIBIDO: inventar lei/artigo; tema genérico sem textos; menos de 3 textos.
Responda SOMENTE JSON:
{"themes":[{"title":"...","prompt":"...","context":"...","likelihood":"alta"|"media","supportTexts":[{"label":"TEXTO 1","body":"...","source":"(...)"},{"label":"TEXTO 2","body":"...","source":"(...)"},{"label":"TEXTO 3","body":"...","source":"(...)"}]}]}
Exatamente ${input.count} temas, todos distintos e atuais.`,
    },
    {
      role: "user",
      content: `Concurso: ${input.contestName}
Órgão: ${input.organ}
Cargo: ${input.role}
Banca: ${input.board || "VUNESP"}
Resumo do edital: ${input.summary || "(sem resumo)"}
Matérias do edital: ${input.subjects.join("; ") || "(não listadas)"}
Pontos que o aluno ainda precisa melhorar (varie os temas sem fugir do padrão VUNESP): ${
        input.openImprovements.length
          ? input.openImprovements.join(" | ")
          : "(nenhum ainda)"
      }
Gere ${input.count} propostas completas (3 textos + comando + tema).`,
    },
  ];
}

function mockSupportAging(): RedacaoSupportText[] {
  return [
    {
      label: "TEXTO 1",
      body: "A expectativa de vida no Brasil sobe, e parte da população já se vê chegando aos 80 anos. Pesquisas mostram que, aos 65, muitos ainda se sentem produtivos e esperam viver mais de uma década com autonomia — mas o desejo de longevidade convive com ansiedade sobre o que essa fase realmente reserva.",
      source:
        "(Gabriela Maraccini. Brasileiros acreditam que vão viver até os 80 anos, mostra pesquisa. www.cnnbrasil.com.br, 04.08.2025. Adaptado)",
    },
    {
      label: "TEXTO 2",
      body: "A “revolução da longevidade” muda o mapa demográfico: em breve, o país terá mais pessoas com 60 anos ou mais do que crianças. Envelhecer não significa, automaticamente, adoecer; em São Paulo, milhares de idosos mantêm independência e até sustentam famílias — o desafio é desenhar políticas que acompanhem essa realidade.",
      source:
        "(Cristiane Segatto. Envelhecer com saúde: hora de desenhar o novo mapa da vida. www.estadao.com.br, 05.01.2022. Adaptado)",
    },
    {
      label: "TEXTO 3",
      body: "No Japão, o abandono e a pobreza na velhice já empurram idosos a crimes por sobrevivência. O Brasil caminha para dobrar sua população idosa nas próximas décadas, ainda com rede de cuidados frágil, aposentadorias apertadas e sobrecarga familiar — sobretudo feminina.",
      source:
        "(Francisco Iglesias. No Japão, idosos matam, morrem ou vão para a prisão por abandono. www.em.com.br, 03.07.2025. Adaptado)",
    },
  ];
}

export function mockThemes(input: {
  contestName: string;
  board: string;
  count: number;
}): RedacaoTheme[] {
  const now = new Date().toISOString();
  const bank = input.board || "VUNESP";
  const meta = themeMeta(input.contestName, input.board);
  const cmd = VUNESP_REDACAO_COMMAND;
  const base: Omit<RedacaoTheme, "id" | "createdAt" | "contestName" | "board" | "genre">[] = [
    {
      title:
        "O ENVELHECIMENTO DA POPULAÇÃO: ENTRE A CAPACIDADE PRODUTIVA DOS IDOSOS E OS DESAFIOS DE CUIDAR DELES",
      prompt: cmd,
      context: `Proposta estilo ${bank}: longevidade, produtividade e cuidado (textos motivadores).`,
      likelihood: "alta",
      supportTexts: mockSupportAging(),
    },
    {
      title:
        "DESINFORMAÇÃO NAS REDES: ENTRE A LIBERDADE DE EXPRESSÃO E A RESPONSABILIDADE SOCIAL",
      prompt: cmd,
      context: "Fake news, cidadania digital e dever de informação.",
      likelihood: "alta",
      supportTexts: [
        {
          label: "TEXTO 1",
          body: "O volume de conteúdos falsos nas redes cresce na mesma velocidade da conectividade. Estudos apontam que notícias enganosas circulam mais rápido que as verificadas, afetando escolhas eleitorais, saúde e confiança nas instituições.",
          source: "(Reportagem adaptada sobre desinformação digital. 2024. Adaptado)",
        },
        {
          label: "TEXTO 2",
          body: "Defensores da liberdade de expressão alertam que a moderação excessiva pode censurar o debate público. Ao mesmo tempo, plataformas e o Estado são cobrados a conter discursos que colocam em risco direitos coletivos.",
          source: "(Artigo de opinião sobre regulação de redes. 2025. Adaptado)",
        },
        {
          label: "TEXTO 3",
          body: "Escolas e serviços públicos já enfrentam o custo da desinformação: mutirões de checagem, campanhas educativas e perda de tempo em desmentir boatos que atrasam políticas públicas.",
          source: "(Levantamento sobre impacto da desinformação no serviço público. 2025. Adaptado)",
        },
      ],
    },
    {
      title: "ACESSO À JUSTIÇA NO BRASIL: ENTRE O DIREITO GARANTIDO E OS OBSTÁCULOS DO COTIDIANO",
      prompt: cmd,
      context: "Cidadania, tribunais e barreiras práticas ao acesso à justiça.",
      likelihood: "alta",
      supportTexts: [
        {
          label: "TEXTO 1",
          body: "A Constituição assegura o acesso à justiça, mas filas, custos e a complexidade processual ainda afastam parcela da população dos seus direitos.",
          source: "(Texto adaptado sobre acesso à justiça. 2024. Adaptado)",
        },
        {
          label: "TEXTO 2",
          body: "Juizados especiais, Defensoria e mediação ampliam portas de entrada — porém a oferta é desigual entre capitais e interior.",
          source: "(Matéria sobre Defensoria e juizados. 2025. Adaptado)",
        },
        {
          label: "TEXTO 3",
          body: "Sem informação clara e linguagem acessível, o cidadão desiste antes mesmo de protocolar um pedido. O problema não é só jurídico: é também de cidadania e comunicação.",
          source: "(Ensaio sobre linguagem e cidadania. 2023. Adaptado)",
        },
      ],
    },
    {
      title: "TRABALHO E TECNOLOGIA: ENTRE A INOVAÇÃO E A DIGNIDADE HUMANA",
      prompt: cmd,
      context: "Automação, IA e mundo do trabalho.",
      likelihood: "media",
      supportTexts: [
        {
          label: "TEXTO 1",
          body: "Ferramentas de inteligência artificial já reorganizam rotinas em escritórios, fábricas e no próprio serviço público, prometendo ganho de produtividade.",
          source: "(Reportagem sobre automação no trabalho. 2025. Adaptado)",
        },
        {
          label: "TEXTO 2",
          body: "Sindicatos e pesquisadores alertam para precarização, vigilância e exclusão de quem não acompanha a requalificação digital.",
          source: "(Análise sobre trabalho e tecnologia. 2024. Adaptado)",
        },
        {
          label: "TEXTO 3",
          body: "O desafio ético é simples de enunciar e difícil de cumprir: inovar sem transformar a pessoa em peça descartável da engrenagem.",
          source: "(Artigo sobre dignidade e inovação. 2025. Adaptado)",
        },
      ],
    },
    {
      title: "EDUCAÇÃO PÚBLICA: ENTRE A PROMESSA DE EQUIDADE E AS DESIGUALDADES PERSISTENTES",
      prompt: cmd,
      context: `Educação e oportunidades — perfil ${input.contestName || "concurso"}.`,
      likelihood: "media",
      supportTexts: [
        {
          label: "TEXTO 1",
          body: "Indicadores de aprendizagem ainda revelam abismos entre redes públicas e privadas e entre regiões do país.",
          source: "(Dados educacionais adaptados. 2024. Adaptado)",
        },
        {
          label: "TEXTO 2",
          body: "Professores apontam falta de infraestrutura, formação continuada e valorização como entraves cotidianos à qualidade.",
          source: "(Reportagem sobre carreira docente. 2025. Adaptado)",
        },
        {
          label: "TEXTO 3",
          body: "Sem escola pública forte, a mobilidade social fica refém da renda familiar — e o discurso da meritocracia perde sentido.",
          source: "(Ensaio sobre equidade educacional. 2023. Adaptado)",
        },
      ],
    },
  ];
  return base.slice(0, Math.max(1, Math.min(input.count, base.length))).map((t) => ({
    id: uid("theme"),
    title: t.title,
    prompt: t.prompt,
    context: t.context,
    supportTexts: t.supportTexts,
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
      if (!title) continue;
      const likelihood = o["likelihood"] === "media" ? "media" : "alta";
      let supportTexts = parseSupportTexts(o["supportTexts"] ?? o["texts"]);
      if (supportTexts.length < 2) {
        // Sem textos motivadores no padrão da prova → descarta (preenchemos com mock se faltar lote).
        continue;
      }
      // Garante rótulos TEXTO 1…N
      supportTexts = supportTexts.map((t, i) => ({
        ...t,
        label: t.label || `TEXTO ${i + 1}`,
      }));
      themes.push({
        id: uid("theme"),
        title: title.slice(0, 220).toUpperCase(),
        prompt: VUNESP_REDACAO_COMMAND,
        context:
          String(o["context"] ?? "").trim().slice(0, 800) ||
          "Proposta no padrão VUNESP (textos motivadores + tema).",
        supportTexts,
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
Banca: ${input.board || "VUNESP"}
Tema (após os textos motivadores): ${input.themeTitle}
Comando da prova: ${input.themePrompt}
Pontos de foco desta redação (corrigir com atenção especial): ${
        input.focusPoints.length
          ? input.focusPoints.map((p) => `${p.area}: ${p.tip}`).join(" | ")
          : "(nenhum)"
      }
Avalie se o aluno dialogou com o tema e com a proposta (não precisa citar os textos literalmente).

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
