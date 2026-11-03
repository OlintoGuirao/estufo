/**
 * Lê PDFs em C:/Users/xuniim/Downloads/Provas tjsp e gera
 * src/data/tjsp-official-provas.json para /simulados.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "C:/Users/xuniim/Downloads/Provas tjsp";
const OUT = resolve(root, "src/data/tjsp-official-provas.json");

const SUBJECT_HINTS = [
  [/L[IÍ]NGUA\s+PORTUGUESA/i, "Língua Portuguesa"],
  [/DIREITO\s+PENAL(?!\s+PROCESSUAL)/i, "Direito Penal"],
  [/DIREITO\s+PROCESSUAL\s+PENAL/i, "Direito Processual Penal"],
  [/DIREITO\s+PROCESSUAL\s+CIVIL/i, "Direito Processual Civil"],
  [/DIREITO\s+CONSTITUCIONAL/i, "Direito Constitucional"],
  [/DIREITO\s+ADMINISTRATIVO/i, "Direito Administrativo"],
  [/LEGISLA[CÇ][AÃ]O\s+INTERNA/i, "Legislação Interna"],
  [/ATUALIDADES/i, "Atualidades"],
  [/MATEM[AÁ]TICA/i, "Matemática"],
  [/INFORM[AÁ]TICA/i, "Informática"],
  [/RACI[OÓ]C[IÍ]NIO\s+L[OÓ]GICO/i, "Raciocínio Lógico"],
  [/NORMAS\s+DA\s+CORREGEDORIA/i, "Legislação Interna"],
];

function cleanPdfNoise(text) {
  return text
    .replace(/pcimarkpci\s+\S+/gi, " ")
    .replace(/www\.pciconcursos\.com\.br/gi, " ")
    .replace(/Confidencial até o momento da aplicação\.?/gi, " ")
    .replace(/tjsp\d+\/\S+/gi, " ")
    .replace(/\u0000/g, " ");
}

async function pdfPages(rel) {
  const path = resolve(SRC, rel);
  if (!existsSync(path)) throw new Error(`Arquivo não encontrado: ${path}`);
  const bytes = new Uint8Array(readFileSync(path));
  const pdf = await getDocumentProxy(bytes);
  const r = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(r.text) ? r.text : [String(r.text ?? "")]).map((t, i) => ({
    page: i + 1,
    text: cleanPdfNoise(String(t ?? "")),
    charCount: String(t ?? "").length,
  }));
  return pages;
}

function joinPages(pages) {
  return pages.map((p) => p.text).join("\n");
}

function parseGabarito(pages) {
  const text = joinPages(pages);
  const answers = new Map();
  const re = /(?:^|[;\s,])\s*(\d{1,3})\s*[\.\-\–\)\:]\s*([A-Ea-e])\b/g;
  let m;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 200) answers.set(n, m[2].toUpperCase());
  }
  return answers;
}

/** Fallback quando o PDF do gabarito é só imagem (ex.: 2021). */
function loadGabaritoFallback(year) {
  const p = resolve(root, `tmp-tjsp-provas/gab-${year}-keys.json`);
  if (!existsSync(p)) return new Map();
  try {
    const obj = JSON.parse(readFileSync(p, "utf8"));
    const map = new Map();
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(k);
      const letter = String(v).toUpperCase();
      if (n >= 1 && n <= 200 && /^[A-E]$/.test(letter)) map.set(n, letter);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Junta hifenização de quebra de linha do PDF: "reno-\nmado" / "reno- mado". */
function fixPdfText(s) {
  return String(s ?? "")
    .replace(/(\p{L})-\r?\n(\p{L})/gu, "$1$2")
    .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Só aceita linha que É o cabeçalho da matéria (não "…da matemática dei-").
 * Ex.: "LÍNgUA PORTUgUESA" no PDF.
 */
function matchSubjectHeader(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 8 || t.length > 70) return null;
  if (/\(A\)|\(B\)|\d+\.|Leia o texto|quest/i.test(t)) return null;
  // Quase só o nome da matéria (poucas palavras).
  if (t.split(/\s+/).length > 6) return null;
  const compact = t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, name] of SUBJECT_HINTS) {
    // Âncora no começo/fim da linha para não pegar palavra no meio do texto.
    const anchored = new RegExp(`^\\s*${re.source}\\s*$`, re.flags.includes("i") ? "i" : "i");
    if (anchored.test(t) || anchored.test(compact)) return name;
  }
  return null;
}

/** Varre o caderno e marca posição de cada matéria. */
function buildSubjectRanges(plain) {
  const ranges = [];
  const lines = plain.split(/\n/);
  let offset = 0;
  for (const line of lines) {
    const name = matchSubjectHeader(line);
    if (name) ranges.push({ index: offset, name });
    offset += line.length + 1;
  }
  return ranges;
}

function subjectAt(ranges, index) {
  let cur = "Geral";
  for (const r of ranges) {
    if (r.index <= index) cur = r.name;
    else break;
  }
  return cur;
}

/**
 * "Leia o texto para responder às questões de 01 a 05." + texto até a 1ª questão do bloco.
 */
function extractStimuli(plain, questionStarts) {
  const re =
    /Leia o texto para responder [^\n]*?(?:quest[oõ]es?\s+)?(?:de\s+)?(?:n[uú]meros?\s+)?(\d{1,3})\s*a\s*(\d{1,3})/gi;
  /** @type {Map<number, string>} */
  const byQ = new Map();
  let m;
  while ((m = re.exec(plain))) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (!from || !to || to < from) continue;
    const afterHeader = m.index + m[0].length;
    // Texto de apoio: até o início da primeira questão do intervalo.
    const firstQ = questionStarts.find((s) => s.number === from);
    const end = firstQ ? firstQ.index : afterHeader + 2500;
    let text = plain.slice(afterHeader, Math.max(afterHeader, end)).trim();
    // Corta lixo de rodapé/cabeçalho no meio.
    text = text
      .replace(/^\s*[\dA-Za-z./\-]+\s*/u, "")
      .replace(/confidential[^\n]*/gi, "")
      .trim();
    text = fixPdfText(text);
    if (text.length < 40) continue;
    const block = `Texto de apoio (questões ${String(from).padStart(2, "0")} a ${String(to).padStart(2, "0")}):\n\n${text}`;
    for (let n = from; n <= to; n++) byQ.set(n, block);
  }
  return byQ;
}

function splitStatementAndAlts(body) {
  const altRe = /(?:^|\n)\s*\(([A-Ea-e])\)\s*/g;
  const matches = [...body.matchAll(altRe)];
  const use = matches.length >= 2 ? matches : [...body.matchAll(/(?:^|\n)\s*([A-Ea-e])\s*[\)\.\-\–\:]\s+/g)];
  if (use.length < 2) return { statement: fixPdfText(body), alternatives: [] };

  const statement = fixPdfText(body.slice(0, use[0].index));
  const alternatives = [];
  for (let i = 0; i < use.length; i++) {
    const key = use[i][1].toUpperCase();
    if (!"ABCDE".includes(key) || alternatives.some((a) => a.key === key)) continue;
    const start = use[i].index + use[i][0].length;
    const end = i + 1 < use.length ? use[i + 1].index : body.length;
    alternatives.push({ key, text: fixPdfText(body.slice(start, end)) });
  }
  return { statement, alternatives };
}

function parseQuestions(pages, year, gabarito) {
  const plain = joinPages(pages);
  const subjectRanges = buildSubjectRanges(plain);

  // Vunesp: "01." … "70." / "100." — evita "001. PROVA OBJETIVA".
  const startRe = /(?:^|\n)\s*(\d{2,3})\.\s+(?![A-Za-z]*PROVA)/gi;
  const rawStarts = [];
  let sm;
  while ((sm = startRe.exec(plain))) {
    const number = Number(sm[1]);
    if (number < 1 || number > 120) continue;
    if (sm[1].length === 3 && number < 100) continue;
    const index = sm.index + (sm[0].startsWith("\n") ? 1 : 0);
    const matchLen = sm[0].startsWith("\n") ? sm[0].length - 1 : sm[0].length;
    rawStarts.push({ number, index, matchLen });
  }

  const byNumber = new Map();
  for (const s of rawStarts) {
    if (!byNumber.has(s.number)) byNumber.set(s.number, s);
  }
  const filtered = [...byNumber.values()].sort((a, b) => a.index - b.index);
  const stimuli = extractStimuli(plain, filtered);

  console.log(
    "  subjects headers",
    subjectRanges.map((r) => r.name).join(" → ") || "(nenhum)",
  );
  console.log("  textos de apoio", new Set(stimuli.values()).size);

  const questions = [];
  const warnings = [];

  for (let i = 0; i < filtered.length; i++) {
    const cur = filtered[i];
    const next = filtered[i + 1];
    const bodyStart = cur.index + cur.matchLen;
    const bodyEnd = next ? next.index : plain.length;
    const subject = subjectAt(subjectRanges, cur.index);
    const body = plain.slice(bodyStart, bodyEnd);
    const { statement: stem, alternatives } = splitStatementAndAlts(body);
    if (alternatives.length < 4) {
      warnings.push(`Q${cur.number} ignorada: ${alternatives.length} alts`);
      continue;
    }
    const support = stimuli.get(cur.number);
    const statement = support ? `${support}\n\n${stem}` : stem;
    const correctKey = gabarito.get(cur.number) ?? "";
    if (!correctKey) warnings.push(`Q${cur.number}: sem gabarito`);
    if (!stem || stem.length < 10) warnings.push(`Q${cur.number}: enunciado curto`);

    questions.push({
      id: `tjsp-oficial-${year}-q${String(cur.number).padStart(3, "0")}`,
      number: cur.number,
      statement,
      alternatives,
      subject,
      topic: subject,
      correctKey,
      board: "Vunesp",
      year,
      contest: "TJSP — Escrevente Técnico Judiciário",
      difficulty: "media",
      source: `Prova oficial TJSP ${year}`,
    });
  }

  return { questions, warnings };
}

const SPECS = [
  {
    year: 2018,
    title: "TJSP Escrevente 2018 — Prova objetiva",
    exam: "2018/escrevente_tecnico_judiciario2018.pdf",
    gab: "2018/gabarito2018.pdf",
    expected: 100,
    timeLimitMin: 300,
  },
  {
    year: 2021,
    title: "TJSP Escrevente 2021 — Prova objetiva",
    exam: "2021/escrevente_tecnico_judiciario2021.pdf",
    gab: "2021/gabarito2021.pdf",
    expected: 100,
    timeLimitMin: 300,
  },
  {
    year: 2025,
    title: "TJSP Escrevente 2025 — Prova objetiva",
    exam: "2025/escrevente_tecnico_judiciario2025.pdf",
    gab: "2025/gabarito2025.pdf",
    expected: 70,
    timeLimitMin: 300,
  },
];

const provas = [];
for (const spec of SPECS) {
  console.log("\n==", spec.year, "==");
  const examPages = await pdfPages(spec.exam);
  const gabPages = await pdfPages(spec.gab);
  let gabarito = parseGabarito(gabPages);
  if (gabarito.size < 20) {
    const fb = loadGabaritoFallback(spec.year);
    if (fb.size) {
      console.log("gabarito PDF vazio — usando fallback OCR", fb.size);
      gabarito = fb;
    }
  }
  console.log("gabarito keys", gabarito.size);
  const { questions, warnings } = parseQuestions(examPages, spec.year, gabarito);
  console.log("questions", questions.length, "warnings", warnings.length);
  if (warnings.length) console.log(warnings.slice(0, 15).join(" | "));
  const withKey = questions.filter((q) => q.correctKey).length;
  provas.push({
    id: `tjsp-oficial-${spec.year}`,
    year: spec.year,
    title: spec.title,
    contest: "TJSP — Escrevente Técnico Judiciário",
    board: "Vunesp",
    questionCount: questions.length,
    timeLimitMin: spec.timeLimitMin,
    hasFullAnswerKey: withKey === questions.length && questions.length > 0,
    answerKeyCount: withKey,
    subjects: [...new Set(questions.map((q) => q.subject))],
    questions,
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: {
        generatedAt: new Date().toISOString(),
        source: SRC,
        note: "Provas oficiais TJSP Escrevente (PDF local). Gabarito 2021 pode estar vazio se PDF for imagem.",
      },
      provas,
    },
    null,
    2,
  ),
  "utf8",
);
console.log("\nWrote", OUT);
for (const p of provas) {
  console.log(
    `${p.year}: ${p.questionCount} q, gabarito ${p.answerKeyCount}/${p.questionCount}, subjects=${p.subjects.length}`,
  );
}
