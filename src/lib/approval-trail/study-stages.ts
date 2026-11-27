/**
 * Transforma o que o edital pede em ETAPAS de estudo.
 * Faixas de artigos viram Art. por Art. (para explicar o que cada um significa).
 */

export type StudyStage = {
  /** Ex.: "Art. 293 — Código Penal" */
  name: string;
  /** Escopo do edital + lei. */
  notes: string;
  weightHint: "alta" | "media" | "baixa";
  refs: string[];
  /** Artigo isolado quando aplicável (ex.: "293", "311-A"). */
  articleRef?: string;
  /**
   * Lei do artigo (ex.: "CPP", "Lei 9.099/1995"). O mesmo número de artigo
   * existe em leis diferentes da mesma matéria — sem isto "Art. 60" do CPP e
   * da Lei 9.099 colidiam (etapa repetida / explicação da lei errada).
   */
  lawRef?: string;
  kind: "artigo" | "assunto" | "capitulo" | "bloco";
};

function clean(s: string): string {
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_EXPAND_RANGE = 80;
const CHUNK_WHEN_HUGE = 10;

export function splitArticleSegments(text: string): string[] {
  const t = clean(text);
  const idx = t.search(/\b(?:artigos?|arts?\.?)\s+/i);
  const from = idx >= 0 ? t.slice(idx).replace(/^\s*(?:artigos?|arts?\.?)\s+/i, "") : t;
  const cut = from.split(/\be\s+Lei\b|\bLei\s+n/i)[0] ?? from;

  return cut
    .split(";")
    .map((p) => clean(p).replace(/[.,]\s*$/, ""))
    .filter((p) => p.length > 0 && /\d/.test(p));
}

/** "293 a 305" | "307" | "311-A" | "336 e 337" | "do 318 a 538" → tokens. */
export function expandSegmentToArticleTokens(seg: string): string[] {
  let s = clean(seg)
    .replace(/^do\s+/i, "")
    .replace(/^arts?\.?\s+/i, "");

  // 336 e 337 / 336, 337
  if (/\d/.test(s) && /\be\b|,/.test(s) && !/\ba\b/i.test(s)) {
    return s
      .split(/\s*,\s*|\s+e\s+/i)
      .map((x) => clean(x))
      .filter((x) => /^\d{1,4}(?:-[A-Za-z])?$/.test(x));
  }

  // 293 a 305
  const range = s.match(/^(\d{1,4})\s*a\s*(\d{1,4})$/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [s];
    const span = b - a + 1;
    if (span > MAX_EXPAND_RANGE) {
      // faixas enormes (ex. 394–497): blocos de N artigos, ainda listando cada um
      const out: string[] = [];
      for (let start = a; start <= b; start += CHUNK_WHEN_HUGE) {
        const end = Math.min(b, start + CHUNK_WHEN_HUGE - 1);
        // Último bloco de 1 artigo só ("538-538") vira artigo isolado.
        out.push(end > start ? `${start}-${end}` : String(start));
      }
      return out;
    }
    const out: string[] = [];
    for (let n = a; n <= b; n++) out.push(String(n));
    return out;
  }

  if (/^\d{1,4}(?:-[A-Za-z])?$/.test(s)) return [s];
  if (/^\d{1,4}-\d{1,4}$/.test(s)) return [s]; // bloco compacto
  // Não tratar texto de lei/assunto (ex.: "Lei Federal n.º 8.429/92…") como artigo.
  return [];
}

function detectLawName(body: string, fallback: string): string {
  const lawHint = body.match(
    /\b(C[oó]digo\s+Penal|C[oó]digo\s+de\s+Processo\s+Penal|C[oó]digo\s+de\s+Processo\s+Civil|Constitui[cç][aã]o\s+Federal|Lei\s+n[ºo°.\s]*[\d./]+|Estatuto[^;.]{0,60}|Resolu[cç][aã]o[^;.]{0,40}|Regimento\s+Interno[^;.]{0,40})/i,
  );
  return lawHint?.[1] ? clean(lawHint[1]) : fallback;
}

/** URLs citadas no edital (fontes oficiais). */
export function extractSourceUrls(text: string): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    const u = m[0]!.replace(/[),.;]+$/g, "");
    if (u.length > 12 && !out.includes(u)) out.push(u);
  }
  return out;
}

/**
 * Legislação interna TJSP: Resoluções, LC, Regimento, Normas da Corregedoria.
 * Cada ato/trecho vira etapa; URLs ficam nas notes para a IA buscar o texto.
 */
export function stagesFromLegislacaoItem(input: {
  subjectName: string;
  body: string;
  itemCode?: string;
}): StudyStage[] {
  const body = clean(input.body);
  const urls = extractSourceUrls(input.body);
  const urlLine = urls.length ? `\nFontes oficiais: ${urls.join(" | ")}` : "";
  const code = input.itemCode ? `Item ${input.itemCode}. ` : "";

  // Cabeçalho vazio "LEGISLAÇÃO INTERNA:" — sem etapa própria.
  if (/^LEGISLA[CÇ][AÃ]O\s+INTERNA\s*:?\s*$/i.test(body)) {
    return [];
  }

  // Normas da Corregedoria: expandir Tomo/Capítulo/Seção.
  if (/Normas\s+da\s+Corregedoria|Tomo\s+[IVXLC\d]+/i.test(body)) {
    const tomoRe =
      /Tomo\s+[IVXLC\d]+\s*[-–—]?\s*Cap[ií]tulo\s+[IVXLC\d]+[^;.]{0,120}/gi;
    const hits = body.match(tomoRe) ?? [];
    if (hits.length >= 1) {
      return hits.map((h, i) => ({
        name: clean(h).slice(0, 120),
        notes: `${code}Normas da Corregedoria Geral da Justiça — estudar: ${clean(h)}.${urlLine}\nBuscar o texto oficial no site da Corregedoria e explicar o que cada seção dispõe para o cargo.`,
        weightHint: (i < 2 ? "alta" : "media") as "alta" | "media",
        refs: [clean(h).slice(0, 80)],
        kind: "capitulo" as const,
      }));
    }
    return [
      {
        name: "Normas da Corregedoria Geral da Justiça",
        notes: `${code}${body.slice(0, 1500)}${urlLine}`,
        weightHint: "alta",
        refs: ["Corregedoria"],
        kind: "bloco" as const,
      },
    ];
  }

  const resolucao = body.match(
    /Resolu[cç][aã]o\s+(?:TJSP\s+)?n[ºo°.\s]*([\d./]+)\s*(?:\(([^)]{10,200})\))?/i,
  );
  if (resolucao) {
    const num = resolucao[1]!;
    const ementa = resolucao[2] ? clean(resolucao[2]) : "";
    return [
      {
        name: ementa
          ? `Resolução TJSP nº ${num} — ${ementa.slice(0, 80)}`
          : `Resolução TJSP nº ${num}`,
        notes: `${code}${body.slice(0, 1500)}${urlLine}\nBuscar o texto integral no link oficial e explicar os pontos cobrados em prova.`,
        weightHint: "alta",
        refs: [`Res. ${num}`],
        kind: "assunto" as const,
      },
    ];
  }

  const lc = body.match(
    /Lei\s+Complementar\s+n[ºo°.\s]*([\d./]+)\s*(?:\(([^)]{10,200})\))?/i,
  );
  if (lc) {
    const num = lc[1]!;
    const ementa = lc[2] ? clean(lc[2]) : "";
    return [
      {
        name: ementa
          ? `Lei Complementar nº ${num} — ${ementa.slice(0, 80)}`
          : `Lei Complementar nº ${num}`,
        notes: `${code}${body.slice(0, 1500)}${urlLine}\nBuscar a LC no site oficial e explicar cargos/carreiras cobrados no edital.`,
        weightHint: "alta",
        refs: [`LC ${num}`],
        kind: "assunto" as const,
      },
    ];
  }

  if (/Regimento\s+Interno/i.test(body)) {
    return [
      {
        name: "Regimento Interno do Tribunal de Justiça",
        notes: `${code}${body.slice(0, 1500)}${urlLine}\nBuscar o PDF oficial do Regimento Interno e mapear títulos/seções relevantes ao cargo.`,
        weightHint: "alta",
        refs: ["Regimento Interno"],
        kind: "assunto" as const,
      },
    ];
  }

  const shortName = body.length <= 160 ? body : `${body.slice(0, 120).trim()}…`;
  return [
    {
      name: shortName,
      notes: `${code}${body.slice(0, 1500)}${urlLine}`,
      weightHint: "alta",
      refs: input.itemCode ? [input.itemCode] : [],
      kind: "assunto" as const,
    },
  ];
}

/** Menção a um diploma legal no texto do edital. */
const LAW_MENTION_RE =
  /(C[oó]digo\s+de\s+Processo\s+Penal|C[oó]digo\s+de\s+Processo\s+Civil|C[oó]digo\s+Penal|Constitui[cç][aã]o\s+(?:Federal|da\s+Rep[uú]blica)|Estatuto\s+dos\s+Funcion[aá]rios[^()]{0,80}\(\s*Lei\s+n[.º°o\s]*[\d.]+\/\d{2,4}\s*\)|Lei(?:\s+Federal|\s+Complementar|\s+Estadual)?\s+n[.º°o]*\s*[\d.]+(?:\s*\/\s*\d{2,4}|,?\s+de\s+\d{1,2}[./]\d{1,2}[./]\d{2,4})?)/gi;

/** Rótulo curto e estável do diploma (vai no nome da etapa e em `lawRef`). */
export function shortLawLabel(mention: string): string {
  const m = clean(mention);
  if (/processo\s+penal/i.test(m)) return "CPP";
  if (/processo\s+civil/i.test(m)) return "CPC";
  if (/c[oó]digo\s+penal/i.test(m)) return "CP";
  if (/constitui/i.test(m)) return "CF";
  const num = m.match(/Lei(?:\s+Federal|\s+Complementar|\s+Estadual)?\s+n[.º°o]*\s*([\d.]+)/i);
  if (num) {
    const n = num[1]!.replace(/\.$/, "");
    // Data por extenso primeiro: em "de 22/12/2009" a barra não é o ano.
    const year =
      m.match(/de\s+\d{1,2}[./]\d{1,2}[./](\d{2,4})/i)?.[1] ??
      m.match(/[\d.]+\s*\/\s*(\d{2,4})\b/)?.[1];
    const kind = /complementar/i.test(m) ? "LC" : "Lei";
    return year ? `${kind} ${n}/${year}` : `${kind} ${n}`;
  }
  return m.slice(0, 40);
}

/**
 * Lista de artigos do edital → tokens. Aceita "1º a 86", "5º ao 13",
 * "294 a 311 e do 318 a 538", "994 a 1.044", "336 e 337", "311-A" e o "e"
 * solto no fim ("239 a 323 e").
 */
export function articleSpecToTokens(spec: string): string[] {
  const s = clean(spec)
    .replace(/\).*$/, "")
    .replace(/(\d)\s*[º°ª]/g, "$1")
    .replace(/(\d)\.(\d{3})\b/g, "$1$2")
    .replace(/\bao\b/gi, "a")
    .replace(/\b(?:do|dos)\s+(?=\d)/gi, "")
    .replace(/[\s.;,]+e\s*$/i, "")
    .replace(/[.\s]+$/, "");
  const parts = s
    .split(/\s*[;,]\s*|\s+e\s+/i)
    .map((p) => clean(p))
    .filter((p) => /^\d/.test(p));
  const out: string[] = [];
  for (const p of parts) {
    const cut = p.match(/^\d{1,4}(?:-[A-Za-z])?(?:\s*a\s*\d{1,4})?/i)?.[0];
    if (cut) out.push(...expandSegmentToArticleTokens(cut));
  }
  return out;
}

/** Estrutura da CF/88 cobrada por título/capítulo/seção (arts. de cada parte). */
const CF_PARTS: Record<string, { name: string; arts: string }> = {
  "II.I": { name: "Direitos e deveres individuais e coletivos", arts: "art. 5º" },
  "II.II": { name: "Direitos sociais", arts: "arts. 6º a 11" },
  "II.III": { name: "Nacionalidade", arts: "arts. 12 e 13" },
  "II.IV": { name: "Direitos políticos", arts: "arts. 14 a 16" },
  "II.V": { name: "Partidos políticos", arts: "art. 17" },
  "III.VII": { name: "Administração Pública", arts: "arts. 37 a 43" },
  "III.VII.I": { name: "Administração Pública — disposições gerais", arts: "arts. 37 e 38" },
  "III.VII.II": { name: "Servidores públicos", arts: "arts. 39 a 41" },
  "III.VII.III": { name: "Militares dos Estados, DF e Territórios", arts: "art. 42" },
  "III.VII.IV": { name: "Regiões", arts: "art. 43" },
};

function romanList(s: string): string[] {
  return clean(s)
    .split(/\s*,\s*|\s+e\s+/i)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[IVXL]+$/.test(x));
}

/** "Título II – Capítulos I, II e III; e Título III – Capítulo VII com Seções I e II". */
function cfStructureStages(scope: string, itemCode?: string): StudyStage[] {
  const out: StudyStage[] = [];
  const re =
    /T[ií]tulo\s+([IVXL]+)\s*[-:]?\s*Cap[ií]tulos?\s+([IVXL]+(?:\s*(?:,|\be\b)\s*[IVXL]+)*)(?:\s+com\s+Se[cç][oõ]es?\s+([IVXL]+(?:\s*(?:,|\be\b)\s*[IVXL]+)*))?/gi;
  for (let m = re.exec(scope); m; m = re.exec(scope)) {
    const titulo = m[1]!.toUpperCase();
    for (const cap of romanList(m[2]!)) {
      const secs = m[3] ? romanList(m[3]) : [];
      const keys = secs.length ? secs.map((sec) => `${titulo}.${cap}.${sec}`) : [`${titulo}.${cap}`];
      for (const key of keys) {
        const part = CF_PARTS[key];
        const sec = key.split(".")[2];
        const label = `Título ${titulo}, Cap. ${cap}${sec ? `, Seção ${sec}` : ""}`;
        out.push({
          name: part ? `${label} — ${part.name} (CF, ${part.arts})` : `${label} (CF)`,
          notes: `Edital (Constituição Federal): ${label}${part ? ` — ${part.name}, ${part.arts}` : ""}. Explicar o conteúdo e como a banca cobra${itemCode ? ` — item ${itemCode}` : ""}.`,
          weightHint: "alta",
          refs: [label],
          lawRef: "CF",
          kind: "capitulo",
        });
      }
    }
  }
  return out;
}

function articleStages(
  tokens: string[],
  law: string,
  lawLong: string,
  itemCode: string | undefined,
  startIdx: number,
): StudyStage[] {
  return tokens.map((tok, i) => {
    const isBlock = /^\d+-\d+$/.test(tok);
    const label = isBlock ? `Arts. ${tok.replace("-", " a ")}` : `Art. ${tok}`;
    const item = itemCode ? ` — item ${itemCode}` : "";
    return {
      name: `${label} (${law})`,
      notes: isBlock
        ? `Edital (${lawLong}): estudar e explicar CADA artigo de ${tok.replace("-", " a ")} do(a) ${law}${item}.`
        : `Edital (${lawLong}): explicar o que o ${label} do(a) ${law} tipifica/dispõe e como a banca cobra${item}.`,
      weightHint: (startIdx + i < 3 ? "alta" : "media") as "alta" | "media",
      refs: [`${label} ${law}`],
      articleRef: tok,
      lawRef: law,
      kind: "artigo" as const,
    };
  });
}

/**
 * Direito: cada artigo vira etapa para depois explicar o que significa.
 * O item pode citar várias leis ("CPP – artigos …; e Lei 9.099 (artigos …)"):
 * cada lei fica com os artigos que vêm depois dela, até a próxima lei.
 */
export function stagesFromLawItem(input: {
  subjectName: string;
  body: string;
  itemCode?: string;
}): StudyStage[] {
  const body = clean(input.body);
  const mentions: { index: number; end: number; text: string }[] = [];
  LAW_MENTION_RE.lastIndex = 0;
  for (let m = LAW_MENTION_RE.exec(body); m; m = LAW_MENTION_RE.exec(body)) {
    mentions.push({ index: m.index, end: m.index + m[0].length, text: m[0] });
  }

  const stages: StudyStage[] = [];
  const seen = new Set<string>();
  const push = (list: StudyStage[]) => {
    for (const st of list) {
      const key = `${st.lawRef ?? ""}|${st.articleRef ?? st.name}`.toLowerCase();
      if (seen.has(key)) continue; // mesmo artigo citado duas vezes no item
      seen.add(key);
      stages.push(st);
    }
  };

  mentions.forEach((mention, i) => {
    const scope = body.slice(mention.end, mentions[i + 1]?.index ?? body.length);
    const law = shortLawLabel(mention.text);
    const lawLong = clean(mention.text);

    if (law === "CF") push(cfStructureStages(scope, input.itemCode));

    const artIdx = scope.search(/\b(?:artigos?|arts?\.?)\s+\d/i);
    if (artIdx >= 0) {
      const spec = scope.slice(artIdx).replace(/^\s*(?:artigos?|arts?\.?)\s+/i, "");
      const tokens = articleSpecToTokens(spec);
      if (tokens.length) {
        push(articleStages(tokens, law, lawLong, input.itemCode, stages.length));
        return;
      }
    }
    if (law === "CF" && stages.some((s) => s.lawRef === "CF")) return;

    // Lei cobrada inteira (ex.: "Lei n.º 12.153/2009", "Lei 8.429/92 (Improbidade)").
    const desc = scope.match(/^\s*\(([^)]{3,120})\)/)?.[1];
    push([
      {
        name: desc ? `${law} — ${clean(desc)}` : `${law} — lei inteira`,
        notes: `Edital (${lawLong}${desc ? ` — ${clean(desc)}` : ""}): estudar a lei inteira, artigo por artigo, e como a banca cobra${input.itemCode ? ` — item ${input.itemCode}` : ""}.`,
        weightHint: "alta",
        refs: [law],
        lawRef: law,
        kind: "assunto",
      },
    ]);
  });
  if (stages.length) return stages;

  // Sem diploma reconhecido: lista de artigos solta ou capítulos.
  const law = detectLawName(body, input.subjectName);
  const segments = splitArticleSegments(body);
  const tokens = segments.flatMap((seg) => articleSpecToTokens(seg));
  if (tokens.length) {
    push(articleStages(tokens, shortLawLabel(law), law, input.itemCode, 0));
    return stages;
  }

  const chapters = splitChapterSegments(body);
  if (chapters.length >= 2) {
    return chapters.map((ch, i) => ({
      name: ch,
      notes: `Estudar ${input.subjectName}: ${ch}. Explicar o conteúdo cobrado no edital${input.itemCode ? ` (item ${input.itemCode})` : ""}.`,
      weightHint: (i < 2 ? "alta" : "media") as "alta" | "media",
      refs: [ch],
      kind: "capitulo" as const,
    }));
  }

  const shortName = body.length <= 180 ? body : `${body.slice(0, 140)}…`;
  return [
    {
      name: shortName,
      notes: body.slice(0, 1200),
      weightHint: "alta",
      refs: [],
      kind: "assunto",
    },
  ];
}

function splitChapterSegments(body: string): string[] {
  const t = clean(body);
  const cap = t.match(/Cap[ií]tulos?\s+(.+?)(?:;|$)/i);
  if (cap) {
    const list = cap[1]!
      .split(/,|\be\b/i)
      .map((x) => clean(x))
      .filter(Boolean)
      .map((x) => `Capítulo ${x.replace(/^Cap[ií]tulo\s+/i, "")}`);
    if (list.length >= 2) {
      const titulo = t.match(/T[ií]tulo\s+[IVXLC\d]+/i)?.[0];
      return list.map((c) => (titulo ? `${titulo} — ${c}` : c));
    }
  }
  const sec = t.match(/Se[cç][oõ]es?\s+([IVXLC\d,\se]+)/i);
  if (sec) {
    const list = sec[1]!
      .split(/,|\be\b/i)
      .map((x) => clean(x))
      .filter(Boolean)
      .map((x) => `Seção ${x}`);
    if (list.length >= 2) return list;
  }
  return [];
}

export function stageFromProgramItem(input: {
  code: string;
  body: string;
  index: number;
}): StudyStage {
  const body = clean(input.body);
  const name = body.length <= 160 ? body : `${body.slice(0, 110).trim()}…`;
  return {
    name,
    notes: `Item ${input.code} do edital. Gerar material explicando o que é, como cai na prova e exemplos.`,
    weightHint: input.index < 3 ? "alta" : "media",
    refs: [input.code],
    kind: "assunto",
  };
}

export function stagesFromInformaticaBlob(body: string): StudyStage[] {
  const t = clean(body);
  const markers = [
    { re: /MS-?Windows[^:]{0,40}:/i, label: "MS-Windows" },
    { re: /Microsoft\s*365\s*:/i, label: "Microsoft 365" },
    { re: /MS-?Word[^:]{0,40}:/i, label: "MS-Word" },
    { re: /MS-?Excel[^:]{0,40}:/i, label: "MS-Excel" },
    { re: /MS-?PowerPoint[^:]{0,40}:/i, label: "MS-PowerPoint" },
    { re: /Correio\s+Eletr[oô]nico\s*:/i, label: "Correio eletrônico" },
    { re: /\bInternet\s*:/i, label: "Internet" },
    { re: /MS\s*Teams\s*:/i, label: "MS Teams" },
    { re: /OneDrive\s*:/i, label: "OneDrive" },
    { re: /SharePoint\s*:/i, label: "SharePoint" },
  ];

  const hits: { label: string; start: number }[] = [];
  for (const m of markers) {
    const match = m.re.exec(t);
    if (match && match.index != null) hits.push({ label: m.label, start: match.index });
  }
  hits.sort((a, b) => a.start - b.start);

  // Fallback: seções "Título: texto" genéricas (comum em editais de informática).
  if (hits.length < 2) {
    const colonHits: { label: string; start: number }[] = [];
    const colonRe =
      /(?:^|[.|;]\s+)([A-ZÀ-Ü][A-Za-zÀ-ÿ0-9\-/\s]{2,40}?)\s*:\s+/g;
    let cm: RegExpExecArray | null;
    while ((cm = colonRe.exec(t)) != null) {
      const label = clean(cm[1]!).slice(0, 48);
      if (label.length < 3) continue;
      if (/quest|bloco|anexo/i.test(label)) continue;
      colonHits.push({ label, start: cm.index + (cm[0].startsWith(".") ? 2 : 0) });
    }
    if (colonHits.length >= 2) {
      hits.length = 0;
      hits.push(...colonHits);
    }
  }

  if (hits.length < 2) {
    return stagesFromProseBlob(t, "Informática");
  }

  return hits.map((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1]!.start : t.length;
    const chunk = t.slice(h.start, end).trim();
    return {
      name: h.label,
      notes: `${chunk.slice(0, 1200)}\n\nExplicar o que cobram neste tópico e como usar na prática.`,
      weightHint: (i < 2 ? "alta" : "media") as "alta" | "media",
      refs: [h.label],
      kind: "assunto" as const,
    };
  });
}

/**
 * Quebra texto corrido do edital (sem 1. 2. 3.) em etapas de estudo.
 * Usado em Informática / Raciocínio Lógico quando o PDF vem em parágrafo único.
 */
export function stagesFromProseBlob(body: string, subjectName: string): StudyStage[] {
  const t = clean(body);
  if (!t) return [];

  // Temas típicos de Raciocínio Lógico no edital TJ/FCC etc.
  if (/racioc[ií]nio|l[oó]gico/i.test(subjectName)) {
    const markers = [
      {
        re: /Compreens[aã]o\s+de\s+estrutura\s+l[oó]gica/i,
        label: "Estrutura lógica de relações",
      },
      {
        re: /Deduzir\s+novas\s+informa[cç]/i,
        label: "Dedução de novas informações",
      },
      {
        re: /Identificar\s+regularidades|sequ[eê]ncia/i,
        label: "Sequências e regularidades",
      },
      {
        re: /estruturas\s+l[oó]gicas/i,
        label: "Estruturas lógicas",
      },
      {
        re: /l[oó]gica\s+da\s+argumenta[cç]/i,
        label: "Lógica da argumentação",
      },
      {
        re: /diagramas\s+l[oó]gicos/i,
        label: "Diagramas lógicos",
      },
    ];
    const hits: { label: string; start: number }[] = [];
    for (const m of markers) {
      const match = m.re.exec(t);
      if (match && match.index != null) hits.push({ label: m.label, start: match.index });
    }
    hits.sort((a, b) => a.start - b.start);
    // dedupe overlapping starts
    const uniq: typeof hits = [];
    for (const h of hits) {
      if (uniq.some((u) => Math.abs(u.start - h.start) < 8)) continue;
      uniq.push(h);
    }
    if (uniq.length >= 2) {
      return uniq.map((h, i) => {
        const end = i + 1 < uniq.length ? uniq[i + 1]!.start : t.length;
        const chunk = t.slice(h.start, end).trim();
        return {
          name: h.label,
          notes: `${chunk.slice(0, 1200)}\n\nExplicar o que cobram e treinar com exercícios.`,
          weightHint: (i < 2 ? "alta" : "media") as "alta" | "media",
          refs: [h.label],
          kind: "assunto" as const,
        };
      });
    }
  }

  // Frases longas → etapas (agrupa ~2 frases se curtas).
  const sentences = t
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ü])/)
    .map((s) => clean(s))
    .filter((s) => s.length > 40);

  if (sentences.length >= 2) {
    const stages: StudyStage[] = [];
    let buf = "";
    let n = 0;
    const flush = () => {
      if (!buf) return;
      n += 1;
      const name =
        buf.length <= 90 ? buf.replace(/\.$/, "") : `${buf.slice(0, 80).trim()}…`;
      stages.push({
        name: `Etapa ${n} — ${name}`,
        notes: `${buf}\n\nGerar material explicando o conceito e como cai na prova.`,
        weightHint: n <= 2 ? "alta" : "media",
        refs: [`${n}`],
        kind: "assunto",
      });
      buf = "";
    };
    for (const s of sentences) {
      buf = buf ? `${buf} ${s}` : s;
      if (buf.length >= 160) flush();
    }
    flush();
    if (stages.length) return stages;
  }

  return [
    {
      name: `${subjectName} (edital)`,
      notes: t.slice(0, 2000),
      weightHint: "alta",
      refs: [],
      kind: "bloco",
    },
  ];
}
