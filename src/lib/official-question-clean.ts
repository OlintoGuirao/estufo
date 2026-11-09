/**
 * Limpeza das questões oficiais extraídas dos PDFs da VUNESP.
 *
 * Problemas reais da extração (ex.: prova 2024):
 * - O texto de apoio ("Leia trecho do conto ... para responder às questões
 *   de números 03 a 11. ...") vai parar grudado na ÚLTIMA alternativa da
 *   questão anterior, e as questões 03–11 ficam sem o texto.
 * - A marca "(5º parágrafo)" se quebra: o "º" vira um "o" solto e o
 *   "parágrafo)" cai no meio de outra palavra ("deso parágrafo) pertava").
 *
 * Aqui o texto é reposto nas questões certas e as marcas são remontadas.
 */

export type RawOfficialQ = {
  id: string;
  number?: number;
  statement: string;
  alternatives: { key: string; text: string }[];
  [k: string]: unknown;
};

const SUPPORT_PREFIX = /^Texto de apoio \(([^)]*)\):\s*\n\n/;

/** "Leia o texto para responder às questões de números 03 a 11." */
const LEAKED_PASSAGE =
  /\s*\b(?:Leia|Considere|Observe|Analise)\b[^.]{0,220}?para responder [àa]s? quest(?:ões|ão)(?: de números?)? (\d{1,3})(?: a| e) (\d{1,3})\.\s*/i;

const ORD = (n: string) => `(${n}º parágrafo)`;

/** Remonta "(Nº parágrafo)" e tira os "o" soltos que a extração deixou. */
export function fixParagraphMarks(raw: string): string {
  // Rodapé do caderno ("16 confidencial até o momento da aplicação. CONHECIMENTOS…") grudado no fim
  const input = raw.replace(/\s*\d{0,3}\s*confidencial até o m\s*omento da aplicação\.[\s\S]*$/i, "").trimEnd();
  if (!/par[aá]grafo|\(\d+\s*(?:–|$)/.test(input)) return input;
  let s = input;
  s = s.replace(/(\w)- -(\w)/g, "$1-$2");
  // marca inteira, só com o "º" virado "o"
  s = s.replace(/\((\d+) ?o parágrafo\)/g, (_, n: string) => ORD(n));
  // marca partida em duas: "(2 o pa- … (2 rágrafo)"
  s = s.replace(/\((\d+) o pa-\s*/g, (_, n: string) => `${ORD(n)} `);
  s = s.replace(/\((\d+) rágrafo\)/g, (_, n: string) => ORD(n));
  // "o parágrafo)" caído no meio de uma palavra: "deso parágrafo) pertava" → "despertava"
  s = s.replace(/([A-Za-zÀ-ÿ])o parágrafo\) ([a-zà-ÿ])/g, "$1$2");
  // "o parágrafo)" solto entre palavras
  s = s.replace(/\s+o parágrafo\)(?=\s|$)/g, "");
  // "… o (6 parágrafo)" → "… (6º parágrafo)"
  s = s.replace(/\bo \((\d+) parágrafo\)/g, (_, n: string) => ORD(n));
  // "(4 parágrafo)" sem o "º": o "o" ficou perdido antes, no mesmo trecho
  s = s.replace(/([^•–]*?)\((\d+) parágrafo\)/g, (_m, before: string, n: string) => {
    let b = before;
    const lone = b.lastIndexOf(" o ");
    if (lone >= 0) b = b.slice(0, lone) + b.slice(lone + 2);
    else {
      // "imao gem" → "imagem": o último "o " grudado no meio de uma palavra
      const re = /[a-zà-ÿ]o [a-zà-ÿ]/g;
      let last = -1;
      for (let m = re.exec(b); m; m = re.exec(b)) last = m.index;
      if (last >= 0) b = b.slice(0, last + 1) + b.slice(last + 3);
    }
    return `${b}${ORD(n)}`;
  });
  // número sozinho no fim do trecho: "… pularem... (5 –" / "… grandes rios... (2"
  s = s.replace(/\((\d{1,2})(?=\s*–)/g, (_, n: string) => `${ORD(n)} `);
  s = s.replace(/\((\d{1,2})\s*$/g, (_, n: string) => ORD(n));
  // "… importação... (7 Os termos destacados" → número órfão antes do comando
  s = s.replace(/(\.\.\.|…)\s*\((\d{1,2})\s+(?=[A-ZÀ-Ú])/g, (_, dots: string, n: string) => `${dots} ${ORD(n)} `);
  // "(3 paráo grafo)" → marca com o "o" no meio da palavra
  s = s.replace(/\((\d{1,2}) par[aá]\s*o\s*grafo\)/g, (_, n: string) => ORD(n));
  // sobra no fim: "… (1º parágrafo) 4 o" / "… (4º parágrafo) o"
  s = s.replace(/(º parágrafo\))\s+(?:\d{1,2}\s+)?o\s*$/g, "$1");
  // "(5º parágrafo) o • …" → "o" do º que sobrou depois da marca
  s = s.replace(/(º parágrafo\)) o (?=•|$)/g, "$1 ");
  s = s.replace(/\)\s+ –/g, ") –").replace(/[ \t]{2,}/g, " ");
  return s;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Limpa uma prova inteira (as questões na ordem da prova): repõe textos de
 * apoio vazados e corrige as marcas de parágrafo. Não altera o original.
 */
export function cleanOfficialProva<T extends RawOfficialQ>(questions: T[]): T[] {
  const out = questions.map((q) => ({
    ...q,
    statement: q.statement,
    alternatives: q.alternatives.map((a) => ({ ...a })),
  }));
  const byNumber = new Map<number, (typeof out)[number]>();
  out.forEach((q, i) => byNumber.set(q.number ?? i + 1, q));

  for (const q of out) {
    const fields: { get: () => string; set: (v: string) => void }[] = [
      { get: () => q.statement, set: (v) => (q.statement = v) },
      ...q.alternatives.map((a) => ({ get: () => a.text, set: (v: string) => (a.text = v) })),
    ];
    for (const f of fields) {
      const text = f.get();
      const m = LEAKED_PASSAGE.exec(text);
      if (!m || m.index === undefined) continue;
      const from = Number(m[1]);
      const to = Number(m[2]);
      const passage = text.slice(m.index + m[0].length).trim();
      if (!(to >= from) || to - from > 20 || passage.length < 80) continue;
      f.set(text.slice(0, m.index).trim());
      for (let n = from; n <= to; n++) {
        const target = byNumber.get(n);
        if (!target || SUPPORT_PREFIX.test(target.statement)) continue;
        target.statement = `Texto de apoio (questões ${pad(from)} a ${pad(to)}):\n\n${passage}\n\n${target.statement}`;
      }
    }
  }

  for (const q of out) {
    q.statement = fixParagraphMarks(q.statement);
    for (const a of q.alternatives) a.text = fixParagraphMarks(a.text);
    const { passage } = splitSupportText(q.statement);
    if (passage) {
      const sp = splitSupportText(q.statement);
      const fixedQ = repairQuotes(sp.question, passage);
      if (fixedQ !== sp.question) q.statement = q.statement.slice(0, q.statement.length - sp.question.length) + fixedQ;
      for (const a of q.alternatives) a.text = repairQuotes(a.text, passage);
    }
  }
  return out as T[];
}

/** Separa "Texto de apoio (…):\n\n<texto>\n\n<pergunta>" para exibir em caixas. */
export function splitSupportText(statement: string): {
  label: string | null;
  passage: string | null;
  question: string;
} {
  const m = SUPPORT_PREFIX.exec(statement);
  if (!m) return { label: null, passage: null, question: statement };
  const rest = statement.slice(m[0].length);
  const cut = rest.lastIndexOf("\n\n");
  if (cut < 0) return { label: null, passage: null, question: statement };
  return {
    label: `Texto de apoio (${m[1]})`,
    passage: rest.slice(0, cut).replace(/^[\s,.;:]+/, "").trim(),
    question: rest.slice(cut + 2).trim(),
  };
}

/** A questão faz sentido sozinha? (Desafio do dia evita as quebradas.) */
export function isCleanOfficialQuestion(q: RawOfficialQ): boolean {
  const all = [q.statement, ...q.alternatives.map((a) => a.text)].join("\n");
  if (/\bo parágrafo\)|rágrafo\)\s|\bpa-\s|\(\d+ parágrafo\)/.test(all.replace(/\(\d+º parágrafo\)/g, ""))) {
    return false;
  }
  // Pede o texto mas não tem texto de apoio
  const needsText = /\b(n?o texto|do texto|narrador|autor do texto|segundo o texto|de acordo com o texto|conto|crônica)\b(?! (constitucional|legal|da lei|normativo))/i;
  if (needsText.test(q.statement) && !SUPPORT_PREFIX.test(q.statement)) return false;
  // Alternativa com texto vazado gigante
  if (q.alternatives.some((a) => a.text.length > 600)) return false;
  return q.statement.trim().length >= 20;
}

/** Passagens em lista ("• … • …") ficam uma por linha. */
export function formatQuestionText(question: string): string {
  return question.replace(/\s+•\s+/g, "\n• ").replace(/^•\s+/, "• ").trim();
}

/** Separa a referência final do texto: "(Editorial. Folha de S.Paulo, 29.03.2023. Adaptado)". */
export function splitPassageSource(passage: string): { body: string; source: string | null } {
  const m = /\s*\(([^()]{6,160}(?:\d{4}|Adaptado)[^()]{0,40})\)\s*$/.exec(passage);
  if (!m || m.index === undefined) return { body: passage, source: null };
  return { body: passage.slice(0, m.index).trim(), source: m[1]!.trim() };
}

function escapeRe(c: string): string {
  return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trechos citados do texto ("… amplmostra… (3º parágrafo)") perderam letras na
 * extração (o "º" levou um "o" junto). Se o trecho existe no texto de apoio
 * com essa diferença, usa a versão do texto.
 */
export function repairQuotes(text: string, passage: string): string {
  const flat = passage.replace(/\s+/g, " ");
  return text.replace(/(?<=^|\.\.\.|…|\/|•|–)([^./•…–()]{12,160}?)(?=\.\.\.|…|\(\d+º parágrafo\)|\/|•|$)/g, (seg) => {
    const core = seg.trim();
    if (core.length < 12 || flat.includes(core)) return seg;
    const chars = [...core.replace(/\s+/g, "")];
    if (chars.length > 140) return seg;
    const re = new RegExp(chars.map(escapeRe).join("\\s?o?\\s?"), "g");
    const hits = flat.match(re);
    if (!hits || hits.length !== 1) return seg;
    const lead = seg.match(/^\s*/)![0];
    const trail = seg.match(/\s*$/)![0];
    return `${lead}${hits[0]}${trail}`;
  });
}
