/**
 * Extrai o conteúdo programático do edital e transforma em matérias + ETAPAS
 * (artigos, itens, capítulos) — sem resumir o que a banca cobra.
 */

import {
  stageFromProgramItem,
  stagesFromInformaticaBlob,
  stagesFromLawItem,
  stagesFromLegislacaoItem,
  stagesFromProseBlob,
  type StudyStage,
} from "./study-stages";

export type ExtractedTopic = {
  name: string;
  notes: string;
  weightHint: "alta" | "media" | "baixa";
  articleRef?: string;
  lawRef?: string;
  kind?: "artigo" | "assunto" | "capitulo" | "bloco";
};

export type ExtractedSubject = {
  name: string;
  questionCountHint: number | null;
  blockLabel: string | null;
  topics: ExtractedTopic[];
};

export type ExtractedProgram = {
  subjects: ExtractedSubject[];
  programText: string;
  warnings: string[];
};

function uid(): string {
  // 7 caracteres de Math.random colidem em trilhas com centenas de etapas;
  // id repetido faz o material de um artigo ser gravado em outro.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Chave de identidade de uma etapa: lei + artigo (ou o nome sem o prefixo "Etapa 3.1 —"). */
export function topicIdentityKey(t: { name?: string; articleRef?: string; lawRef?: string }): string {
  if (t.articleRef) return `art|${(t.lawRef ?? "").toLowerCase()}|${t.articleRef.toLowerCase()}`;
  const name = (t.name ?? "").replace(/^Etapa\s+[\d.]+\s*[—\-]\s*/i, "");
  return `txt|${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/** Remove etapas repetidas (mesmo artigo da mesma lei), mantendo a 1ª. */
export function dedupeTopics<T extends { name?: string; articleRef?: string; lawRef?: string }>(
  topics: T[],
): T[] {
  const seen = new Set<string>();
  return topics.filter((t) => {
    const k = topicIdentityKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function collapseSpacedLetters(line: string): string {
  if (!/^(?:[A-Za-zÀ-ÿ]\s+){3,}[A-Za-zÀ-ÿ]\s*$/.test(line.trim())) return line;
  return line.replace(/\s+/g, "");
}

function normalizeEditalText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .split("\n")
    .map((l) => collapseSpacedLetters(l.replace(/[ \t]+/g, " ").trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function stripPageNoise(text: string): string {
  return text
    .replace(/^--- Página \d+ ---\s*/gim, "")
    .replace(/^\d{1,3}\s*$/gm, "")
    .replace(/^PODER JUDICIÁRIO\s*$/gim, "")
    .replace(/^TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Início do conteúdo programático. O edital cita a expressão no corpo
 * ("…conteúdo programático constante do Anexo VIII…") dezenas de páginas
 * antes do anexo; pegar a 1ª ocorrência fazia o extrator ler as regras do
 * concurso (recursos, heteroidentificação…) como se fossem matérias.
 * Prefere o TÍTULO (linha só com a expressão) seguido de BLOCO/matéria.
 */
export function findProgramStart(text: string): number {
  const heading = /^[ \t]*CONTE[UÚ]DO\s+PROGRAM[AÁ]TICO[ \t]*:?[ \t]*$/gim;
  const headings: number[] = [];
  for (let m = heading.exec(text); m; m = heading.exec(text)) headings.push(m.index);
  const withBlocks = headings.filter((i) =>
    /\n\s*(BLOCO\s+[IVX\d]+|L[IÍ]NGUA\s+PORTUGUESA|DIREITO\s+[A-ZÀ-Ü])/i.test(
      text.slice(i, i + 4_000),
    ),
  );
  if (withBlocks.length) return withBlocks[withBlocks.length - 1]!;
  if (headings.length) return headings[headings.length - 1]!;
  const any = text.search(/CONTE[UÚ]DO\s+PROGRAM[AÁ]TICO/i);
  return any >= 0 ? any : text.search(/BLOCO\s+I\b/i);
}

function findProgramSlice(text: string): { slice: string; warning?: string } {
  const start = findProgramStart(text);
  if (start < 0) {
    return {
      slice: text,
      warning: "Não achei CONTEÚDO PROGRAMÁTICO; analisei o texto inteiro.",
    };
  }
  let slice = text.slice(start);
  const endMatch = slice.search(
    /\n\s*ANEXO\s+(?:IX|X|XI|XII|\d{1,2})\b|\n\s*CRONOGRAMA\b|\n\s*DAS DISPOSI[CÇ][OÕ]ES FINAIS\b/i,
  );
  if (endMatch > 400) slice = slice.slice(0, endMatch);
  return { slice };
}

const QUEST_RE = /(\d{1,3})\s*quest(?:[oõ]es|[aã]o)?/i;
const BLOCO_RE = /^BLOCO\s+([IVXLC\d]+)\s*[:.\-]?\s*(.*)$/i;
const SUBJECT_HINT_RE =
  /^(Atualidades|Matem[aá]tica|Inform[aá]tica|Racioc[ií]nio\s+L[oó]gico|L[ií]ngua\s+Portuguesa|Conhecimentos\s+em\s+Direito|Conhecimentos\s+Gerais)$/i;
const ITEM_START_RE = /^(\d+(?:\.\d+)*)\s*[.)\-]\s*(.+)$/;
const LAW_TITLE_RE =
  /^(DIREITO\s+[A-ZÀ-Ü][A-ZÀ-Ü\s]+|LEGISLA[CÇ][AÃ]O\s+INTERNA)\s*[:.\-]?\s*(.*)$/i;

function parseQuestionCount(line: string): number | null {
  const m = line.match(QUEST_RE);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function toTitleCasePt(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 2) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function stagesToTopics(stages: StudyStage[]): ExtractedTopic[] {
  return stages.map((st) => {
    const t: ExtractedTopic = {
      name: st.name,
      notes: st.notes,
      weightHint: st.weightHint,
      kind: st.kind,
    };
    if (st.articleRef) t.articleRef = st.articleRef;
    if (st.lawRef) t.lawRef = st.lawRef;
    return t;
  });
}

type DraftSubject = {
  name: string;
  questionCountHint: number | null;
  blockLabel: string | null;
  topicChunks: { code: string; body: string }[];
  /** Texto corrido sem numeração (Informática, Raciocínio Lógico…). */
  blobParts: string[];
};

function isLawSubjectName(name: string): boolean {
  return /direito|legisla[cç][aã]o\s+interna/i.test(name);
}

function buildTopicsForChunk(
  subjectName: string,
  chunk: { code: string; body: string },
  index: number,
): ExtractedTopic[] {
  const body = chunk.body.trim();

  // Subitem tipo 3.1 / 6.1
  if (/\d+\.\d+/.test(chunk.code)) {
    // Legislação interna: Resolução, LC, Regimento, Normas da Corregedoria
    if (
      /resolu|regimento|lei\s+complementar|normas\s+da\s+corregedoria|tomo\s+/i.test(
        body,
      )
    ) {
      return stagesToTopics(
        stagesFromLegislacaoItem({
          subjectName,
          body,
          itemCode: chunk.code,
        }),
      );
    }
    const lawish = /lei|c[oó]digo|estatuto|artigos/i.test(body);
    if (lawish) {
      const stages = stagesFromLawItem({
        subjectName,
        body,
        itemCode: chunk.code,
      });
      return stagesToTopics(
        stages.map((s) => ({
          ...s,
          name: s.name.startsWith("Etapa")
            ? s.name.replace(/^Etapa\s+\d+/, `Etapa ${chunk.code}`)
            : `Etapa ${chunk.code} — ${s.name}`,
          notes: s.notes.includes(chunk.code) ? s.notes : `Item ${chunk.code}. ${s.notes}`,
        })),
      );
    }
    return stagesToTopics([
      stageFromProgramItem({ code: chunk.code, body, index }),
    ]);
  }

  // DIREITO PENAL: artigos... / cabeçalho LEGISLAÇÃO INTERNA
  const lawHead = body.match(LAW_TITLE_RE);
  if (lawHead || isLawSubjectName(subjectName)) {
    if (/legisla[cç][aã]o\s+interna/i.test(subjectName) || /legisla[cç][aã]o\s+interna/i.test(body)) {
      return stagesToTopics(
        stagesFromLegislacaoItem({
          subjectName: lawHead ? toTitleCasePt(lawHead[1]!) : subjectName,
          body: lawHead ? `${lawHead[1]}: ${lawHead[2] ?? ""}` : body,
          itemCode: chunk.code,
        }),
      );
    }
    const stages = stagesFromLawItem({
      subjectName: lawHead ? toTitleCasePt(lawHead[1]!) : subjectName,
      body: lawHead ? `${lawHead[1]}: ${lawHead[2]}` : body,
      itemCode: chunk.code,
    });
    return stagesToTopics(stages);
  }

  if (/inform[aá]tica/i.test(subjectName) && body.length > 80) {
    return stagesToTopics(stagesFromInformaticaBlob(body));
  }

  // Texto corrido sem itens 1. 2. 3. (ex.: Raciocínio Lógico)
  if (
    (chunk.code === "bloco" || body.length > 220) &&
    !ITEM_START_RE.test(body.slice(0, 40))
  ) {
    return stagesToTopics(stagesFromProseBlob(body, subjectName));
  }

  return stagesToTopics([stageFromProgramItem({ code: chunk.code, body, index })]);
}

/**
 * Extrai matérias e etapas a partir do texto do edital.
 */
export function extractProgramFromEditalText(rawText: string): ExtractedProgram {
  const warnings: string[] = [];
  const normalized = stripPageNoise(normalizeEditalText(rawText));
  const { slice, warning } = findProgramSlice(normalized);
  if (warning) warnings.push(warning);

  const lines = slice
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const drafts: DraftSubject[] = [];
  let current: DraftSubject | null = null;
  let pendingSubjectName: string | null = null;
  let pendingBlock: string | null = null;
  let currentItem: { code: string; parts: string[] } | null = null;

  const flushItem = () => {
    if (!current || !currentItem) return;
    const body = currentItem.parts.join(" ").replace(/\s+/g, " ").trim();
    if (body) current.topicChunks.push({ code: currentItem.code, body });
    currentItem = null;
  };

  const flushBlob = () => {
    if (!current || !current.blobParts.length) return;
    // Se já há itens numerados, o blob solto costuma ser ruído — ignora.
    if (current.topicChunks.length) {
      current.blobParts = [];
      return;
    }
    const body = current.blobParts.join(" ").replace(/\s+/g, " ").trim();
    current.blobParts = [];
    if (body.length > 40) {
      current.topicChunks.push({ code: "bloco", body });
    }
  };

  const startSubject = (name: string, q: number | null, block: string | null) => {
    flushItem();
    flushBlob();
    current = {
      name: name.replace(/\s+/g, " ").trim(),
      questionCountHint: q,
      blockLabel: block,
      topicChunks: [],
      blobParts: [],
    };
    drafts.push(current);
    pendingSubjectName = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (/^ANEXO\b/i.test(line) && i > 5) break;
    if (/^Toda legisla/i.test(line)) continue;
    if (/^Todos os temas englobam/i.test(line)) continue;
    if (/^Os links que constam/i.test(line)) continue;
    if (/^Dispon[ií]vel em:/i.test(line)) continue;
    if (/^<?https?:/i.test(line)) continue;

    const bloco = line.match(BLOCO_RE);
    if (bloco) {
      flushItem();
      pendingBlock = `Bloco ${bloco[1]}`;
      const rest = (bloco[2] ?? "").trim();
      if (rest && !/^conhecimentos\s+gerais$/i.test(rest)) {
        const name = rest.replace(QUEST_RE, "").replace(/[:.\-]\s*$/, "").trim();
        if (name && !/^conhecimentos\s+gerais$/i.test(name)) {
          const next = lines[i + 1];
          const qInline = parseQuestionCount(rest);
          const qNext = next ? parseQuestionCount(next) : null;
          startSubject(name, qInline ?? qNext, pendingBlock);
          if (qNext != null && qInline == null && next && /^\d{1,3}\s*quest/i.test(next)) {
            i += 1;
          }
          continue;
        }
      }
      current = null;
      continue;
    }

    if (SUBJECT_HINT_RE.test(line)) {
      flushItem();
      pendingSubjectName = line.trim();
      const next = lines[i + 1];
      const q = next ? parseQuestionCount(next) : null;
      if (q != null && next && /^\d{1,3}\s*quest/i.test(next)) {
        startSubject(pendingSubjectName, q, pendingBlock);
        i += 1;
      } else {
        startSubject(pendingSubjectName, null, pendingBlock);
      }
      continue;
    }

    const onlyQuest = parseQuestionCount(line);
    if (
      onlyQuest != null &&
      /^\d{1,3}\s*quest/i.test(line) &&
      pendingSubjectName &&
      !current
    ) {
      startSubject(pendingSubjectName, onlyQuest, pendingBlock);
      continue;
    }
    if (
      onlyQuest != null &&
      /^\d{1,3}\s*quest/i.test(line) &&
      current &&
      current.questionCountHint == null
    ) {
      current.questionCountHint = onlyQuest;
      continue;
    }

    const item = line.match(ITEM_START_RE);
    if (item) {
      if (!current) {
        startSubject(
          pendingBlock ? `Conteúdo ${pendingBlock}` : "Conteúdo programático",
          null,
          pendingBlock,
        );
      }
      flushItem();
      currentItem = { code: item[1]!, parts: [item[2]!] };
      continue;
    }

    if (currentItem) {
      if (
        /^Tomo\b/i.test(line) ||
        /^Cap[ií]tulo\b/i.test(line) ||
        /artigo/i.test(line) ||
        /MS-/i.test(line) ||
        /\bLei\b/i.test(line) ||
        /Resolu/i.test(line) ||
        /OneDrive/i.test(line) ||
        /Teams/i.test(line) ||
        /Dispon[ií]vel\s+em/i.test(line) ||
        /https?:\/\//i.test(line) ||
        /^</.test(line) ||
        /Se[cç][aã]o/i.test(line) ||
        /subse[cç]/i.test(line) ||
        // Continuação curta da frase anterior: o PDF quebrou "994⏎a 1026;"
        // e a faixa virava só "Art. 994" (os outros 32 artigos sumiam).
        /^[a-zà-ü(\d]/.test(line) ||
        /[;,]$/.test(line) ||
        line.length > 24
      ) {
        currentItem.parts.push(line);
      }
      continue;
    }

    // Texto corrido sob a matéria atual (sem 1. / 2. / 3.1).
    if (
      current &&
      line.length > 20 &&
      !SUBJECT_HINT_RE.test(line) &&
      !BLOCO_RE.test(line) &&
      !/^\d{1,3}\s*quest/i.test(line)
    ) {
      current.blobParts.push(line);
    }
  }
  flushItem();
  flushBlob();

  // Monta matérias: Direito vira matérias separadas; cada lista de artigos → etapas
  const subjects: ExtractedSubject[] = [];

  for (const d of drafts) {
    if (!d.topicChunks.length && d.questionCountHint == null) continue;

    const isDireitoBundle = /conhecimentos\s+em\s+direito/i.test(d.name);

    if (isDireitoBundle) {
      const chunks = d.topicChunks;
      let i = 0;
      let firstSubject = true;
      /** Matéria aberta (ex.: Direito Processual Civil) — códigos/leis vão para dentro dela. */
      let open: ExtractedSubject | null = null;

      const pushOpen = () => {
        if (!open) return;
        // Cabeçalho só com o nome da matéria (sem conteúdo) → descarta etapa vazia.
        open.topics = open.topics.filter((t) => {
          const n = t.name.replace(/^Etapa\s+[\d.]+\s*[—\-]\s*/i, "").trim();
          return !new RegExp(`^${open!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:.]?$`, "i").test(n);
        });
        if (open.topics.length) {
          subjects.push(open);
          firstSubject = false;
        }
        open = null;
      };

      const ensureOpen = (name: string) => {
        if (open && open.name.toLowerCase() === name.toLowerCase()) return open;
        pushOpen();
        open = {
          name,
          questionCountHint: firstSubject ? d.questionCountHint : null,
          blockLabel: d.blockLabel,
          topics: [],
        };
        return open;
      };

      while (i < chunks.length) {
        const chunk = chunks[i]!;
        const lawMatch = chunk.body.match(LAW_TITLE_RE);
        const titleRest = (lawMatch?.[2] ?? "").trim();
        const isDireitoHeader = !!lawMatch && /^DIREITO\s+/i.test(lawMatch[1]!);
        const isLegislacaoHeader =
          !!lawMatch &&
          /LEGISLA[CÇ][AÃ]O\s+INTERNA/i.test(lawMatch[1]!) &&
          titleRest.length < 40;

        // Novo ramo: DIREITO PENAL / PROCESSUAL CIVIL / … ou LEGISLAÇÃO INTERNA
        if (isDireitoHeader || isLegislacaoHeader) {
          const subName = toTitleCasePt(lawMatch![1]!);
          const sub = ensureOpen(subName);

          if (isLegislacaoHeader) {
            const parentCode = chunk.code;
            i += 1;
            let added = 0;
            while (i < chunks.length) {
              const c = chunks[i]!;
              if (c.code === parentCode || c.code.startsWith(`${parentCode}.`)) {
                sub.topics.push(...buildTopicsForChunk(subName, c, sub.topics.length));
                added += 1;
                i += 1;
                continue;
              }
              const nextLaw = c.body.match(LAW_TITLE_RE);
              if (nextLaw && /^DIREITO\s+/i.test(nextLaw[1]!)) break;
              if (/^\d+$/.test(c.code) && !c.code.startsWith(parentCode)) break;
              break;
            }
            if (!added) {
              sub.topics.push(...buildTopicsForChunk(subName, chunk, sub.topics.length));
            }
            continue;
          }

          // DIREITO X: se o próprio chunk já traz artigos/lei, inclui; senão só abre o ramo.
          const rest = titleRest.replace(/^[:.\-\s]+/, "");
          if (rest.length > 8 || /artigo|lei|c[oó]digo|estatuto/i.test(chunk.body)) {
            const bodyForTopics =
              rest.length > 8
                ? { code: chunk.code, body: `${lawMatch![1]}: ${rest}` }
                : chunk;
            sub.topics.push(...buildTopicsForChunk(subName, bodyForTopics, sub.topics.length));
          }
          i += 1;
          continue;
        }

        // Código / Lei / Estatuto numerados → entram na matéria DIREITO aberta.
        const parent = open ?? ensureOpen("Direito");
        parent.topics.push(...buildTopicsForChunk(parent.name, chunk, parent.topics.length));
        i += 1;
      }
      pushOpen();
      continue;
    }

    const topics: ExtractedTopic[] = [];
    d.topicChunks.forEach((chunk, idx) => {
      topics.push(...buildTopicsForChunk(d.name, chunk, idx));
    });

    subjects.push({
      name: d.name,
      questionCountHint: d.questionCountHint,
      blockLabel: d.blockLabel,
      topics,
    });
  }

  const merged = mergeOrphanLawSubjects(subjects);

  if (!merged.length) {
    warnings.push("Não consegui montar matérias/etapas a partir do conteúdo programático.");
  } else {
    const etapas = merged.reduce((n, s) => n + s.topics.length, 0);
    if (etapas < 10) {
      warnings.push(
        `Poucas etapas detectadas (${etapas}). Confira se o PDF traz o anexo completo com texto selecionável.`,
      );
    }
  }

  return {
    subjects: merged,
    programText: slice.slice(0, 50_000),
    warnings,
  };
}

function isDireitoBranchName(name: string): boolean {
  return /^Direito\b/i.test(name.trim()) || /legisla[cç][aã]o\s+interna/i.test(name);
}

function isOrphanLawSubjectName(name: string): boolean {
  const n = name.trim();
  if (!n || isDireitoBranchName(n)) return false;
  if (
    /portuguesa|matem[aá]tica|inform[aá]tica|racioc[ií]nio|atualidades|conhecimentos\s+gerais/i.test(
      n,
    )
  ) {
    return false;
  }
  return (
    /^(c[oó]digo|lei\b|estatuto|resolu|regimento|tomo\b|arts?\b)/i.test(n) ||
    /artigos?\s+\d/i.test(n) ||
    /lei\s+n/i.test(n) ||
    /improbidade|processo\s+civil|processo\s+penal|funcion[aá]rios?\s+p[uú]blicos/i.test(n)
  );
}

function isEmptyDireitoHeaderTopic(
  subjectName: string,
  topic: { name?: string },
): boolean {
  const n = (topic.name ?? "").replace(/^Etapa\s+[\d.]+\s*[—\-]\s*/i, "").trim();
  if (!n) return true;
  const esc = subjectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}\\s*[:.]?$`, "i").test(n);
}

/**
 * Une "Código de Processo Civil…", "Lei n.º 9.099…" etc. dentro do
 * "Direito Processual Civil" (ou ramo DIREITO anterior).
 */
export function mergeOrphanLawSubjects<
  T extends {
    name: string;
    topics: { name?: string; articleRef?: string; lawRef?: string }[];
    questionCountHint?: number | null;
  },
>(subjects: T[]): T[] {
  const out: T[] = [];
  for (const s of subjects) {
    if (isOrphanLawSubjectName(s.name) && out.length) {
      let parentIdx = -1;
      for (let i = out.length - 1; i >= 0; i--) {
        if (isDireitoBranchName(out[i]!.name)) {
          parentIdx = i;
          break;
        }
      }
      if (parentIdx >= 0) {
        const parent = out[parentIdx]!;
        // A mesma lei pode vir no ramo E como "matéria" órfã: sem dedupe as
        // etapas apareciam duas vezes.
        const topics = dedupeTopics(
          [...parent.topics, ...s.topics].filter((t) => !isEmptyDireitoHeaderTopic(parent.name, t)),
        );
        out[parentIdx] = {
          ...parent,
          topics,
          questionCountHint: parent.questionCountHint ?? s.questionCountHint ?? null,
        };
        continue;
      }
    }
    out.push(s);
  }
  return out;
}

export function extractedToTrailSubjects(
  extracted: ExtractedSubject[],
): import("@/types/approval-trail").TrailSubject[] {
  return extracted.map((s, i) => ({
    id: `sub_${uid()}`,
    name: s.name,
    questionCountHint: s.questionCountHint,
    order: i + 1,
    topics: dedupeTopics(s.topics).map((t) => {
      const topic: import("@/types/approval-trail").TrailTopic = {
        id: `top_${uid()}`,
        name: t.name,
        weightHint: t.weightHint,
        notes: t.notes,
        status: "pendente",
      };
      if (t.kind) topic.kind = t.kind;
      if (t.articleRef) topic.articleRef = t.articleRef;
      if (t.lawRef) topic.lawRef = t.lawRef;
      return topic;
    }),
  }));
}

/**
 * Trilhas criadas pelo extrator antigo têm etapas-bloco ("Arts. 404 a 413",
 * articleRef "404-413"): a aula explicava o bloco, não cada artigo. Aqui cada
 * bloco vira uma etapa por artigo.
 *
 * Preserva o estudo: o 1º artigo herda o id do bloco (o progresso do dia
 * continua ligado pelo id) e todos herdam status e material do bloco (sem
 * material a etapa sairia do cronograma até "Gerar material").
 */
export function expandArticleBlockTopics<
  T extends { id: string; name: string; notes: string; articleRef?: string; kind?: string },
>(topics: T[]): { topics: T[]; changed: boolean } {
  let changed = false;
  const out: T[] = [];
  for (const t of topics) {
    const m = /^(\d{1,4})-(\d{1,4})$/.exec(t.articleRef ?? "");
    const a = m ? Number(m[1]) : NaN;
    const b = m ? Number(m[2]) : NaN;
    if (!m || !(b > a) || b - a > 60) {
      out.push(t);
      continue;
    }
    changed = true;
    const prefix = /^(Etapa\s+[\d.]+\s*[—-]\s*)/.exec(t.name)?.[1] ?? "";
    const suffix = /(\s*\([^)]*\))\s*$/.exec(t.name)?.[1] ?? "";
    for (let n = a; n <= b; n++) {
      out.push({
        ...t,
        id: n === a ? t.id : `${t.id}-a${n}`,
        name: `${prefix}Art. ${n}${suffix}`,
        notes: t.notes.replace(/estudar e explicar CADA artigo de [\d]+ a [\d]+/i, `explicar o que o Art. ${n} dispõe`),
        articleRef: String(n),
        kind: "artigo",
      });
    }
  }
  return { topics: out, changed };
}
