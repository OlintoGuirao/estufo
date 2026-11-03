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

function detectSubject(line, current) {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 5 || t.length > 80) return current;
  // Cabeçalhos de matéria costumam ser curtos e em caixa alta.
  for (const [re, name] of SUBJECT_HINTS) {
    if (re.test(t) && !/\(A\)|\(B\)|quest/i.test(t)) return name;
  }
  return current;
}

function splitStatementAndAlts(body) {
  const altRe = /(?:^|\n)\s*\(([A-Ea-e])\)\s*/g;
  const matches = [...body.matchAll(altRe)];
  if (matches.length < 2) {
    // fallback: A) / A.
    const altRe2 = /(?:^|\n)\s*([A-Ea-e])\s*[\)\.\-\–\:]\s+/g;
    const m2 = [...body.matchAll(altRe2)];
    if (m2.length < 2) return { statement: body.trim(), alternatives: [] };
    const statement = body.slice(0, m2[0].index).trim();
    const alternatives = [];
    for (let i = 0; i < m2.length; i++) {
      const key = m2[i][1].toUpperCase();
      if (!"ABCDE".includes(key) || alternatives.some((a) => a.key === key)) continue;
      const start = m2[i].index + m2[i][0].length;
      const end = i + 1 < m2.length ? m2[i + 1].index : body.length;
      alternatives.push({
        key,
        text: body
          .slice(start, end)
          .replace(/\s+/g, " ")
          .trim(),
      });
    }
    return { statement: statement.replace(/\s+/g, " ").trim(), alternatives };
  }
  const statement = body.slice(0, matches[0].index).replace(/\s+/g, " ").trim();
  const alternatives = [];
  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1].toUpperCase();
    if (!"ABCDE".includes(key) || alternatives.some((a) => a.key === key)) continue;
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    alternatives.push({
      key,
      text: body
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim(),
    });
  }
  return { statement, alternatives };
}

function parseQuestions(pages, year, gabarito) {
  const plain = joinPages(pages);
  // Vunesp: "01." … "70." / "100." — evita "001. PROVA OBJETIVA".
  const startRe = /(?:^|\n)\s*(\d{2,3})\.\s+(?![A-Za-z]*PROVA)/gi;
  const rawStarts = [];
  let sm;
  while ((sm = startRe.exec(plain))) {
    const number = Number(sm[1]);
    if (number < 1 || number > 120) continue;
    // Ignora códigos tipo 001 (capa) — questões reais são 01–100 com 2 dígitos, ou 100.
    if (sm[1].length === 3 && number < 100) continue;
    const index = sm.index + (sm[0].startsWith("\n") ? 1 : 0);
    const matchLen = sm[0].startsWith("\n") ? sm[0].length - 1 : sm[0].length;
    rawStarts.push({ number, index, matchLen });
  }

  // Uma entrada por número (primeira ocorrência), na ordem do caderno (índice no texto).
  const byNumber = new Map();
  for (const s of rawStarts) {
    if (!byNumber.has(s.number)) byNumber.set(s.number, s);
  }
  const filtered = [...byNumber.values()].sort((a, b) => a.index - b.index);

  let subject = "Geral";
  const questions = [];
  const warnings = [];

  for (let i = 0; i < filtered.length; i++) {
    const cur = filtered[i];
    const next = filtered[i + 1];
    const bodyStart = cur.index + cur.matchLen;
    const bodyEnd = next ? next.index : plain.length;

    const before = plain.slice(Math.max(0, cur.index - 250), cur.index);
    for (const line of before.split(/\n/).reverse()) {
      const s = detectSubject(line, null);
      if (s) {
        subject = s;
        break;
      }
    }
    const body = plain.slice(bodyStart, bodyEnd);
    const { statement, alternatives } = splitStatementAndAlts(body);
    // Descarta falsos positivos sem alternativas A–E.
    if (alternatives.length < 4) {
      warnings.push(`Q${cur.number} ignorada: ${alternatives.length} alts`);
      continue;
    }
    const correctKey = gabarito.get(cur.number) ?? "";
    if (!correctKey) warnings.push(`Q${cur.number}: sem gabarito`);
    if (!statement || statement.length < 10) warnings.push(`Q${cur.number}: enunciado curto`);

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
