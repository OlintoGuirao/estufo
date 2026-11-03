/**
 * Converte data/banco_questoes_tjsp_400.md → src/data/tjsp-banco-400.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = resolve(root, "data/banco_questoes_tjsp_400.md");
const outPath = resolve(root, "src/data/tjsp-banco-400.json");

type Alt = { key: string; text: string };
type Q = {
  id: string;
  code: string;
  number: number;
  statement: string;
  alternatives: Alt[];
  subject: string;
  subjectKey: string;
  topic: string;
  correctKey: string;
  explanation: string;
  board: string;
  year: number;
  contest: string;
  difficulty: "facil" | "media" | "dificil";
  source: string;
};

const SUBJECT_META: Record<string, { subject: string; subjectKey: string }> = {
  LEGISLACAO_ESPECIAL: { subject: "Legislação Especial", subjectKey: "LEGISLACAO_ESPECIAL" },
  ATUALIDADES: { subject: "Atualidades", subjectKey: "ATUALIDADES" },
  MATEMATICA_RACIOCINIO_LOGICO: {
    subject: "Matemática e Raciocínio Lógico",
    subjectKey: "MATEMATICA_RACIOCINIO_LOGICO",
  },
  INFORMATICA: { subject: "Informática", subjectKey: "INFORMATICA" },
};

function parseBlock(block: string, subjectKey: string): Q[] {
  const meta = SUBJECT_META[subjectKey];
  if (!meta) throw new Error(`Matéria desconhecida: ${subjectKey}`);

  const gabIdx = block.search(/^###\s+Gabarito do banco e fundamentos\s*$/m);
  if (gabIdx < 0) throw new Error(`Gabarito ausente em ${subjectKey}`);
  const body = block.slice(0, gabIdx);
  const gab = block.slice(gabIdx);

  const keys = new Map<string, { key: string; explanation: string }>();
  const gabRe =
    /(\d+)\s*\(`([A-Z0-9_]+-\d+)`\)\s*:\s*\*\*([A-E])\*\*\s*—\s*(.+?)(?=\n\d+\s*\(`|$)/gs;
  let gm: RegExpExecArray | null;
  while ((gm = gabRe.exec(gab))) {
    const code = gm[2]!;
    keys.set(code, {
      key: gm[3]!.toUpperCase(),
      explanation: gm[4]!.replace(/\s+/g, " ").trim(),
    });
  }

  const questions: Q[] = [];
  const qRe =
    /\*\*(\d+)\.\*\*\s*`([A-Z0-9_]+-\d+)`\s+([\s\S]*?)(?=\n\*\*\d+\.\*\*\s`|\n###\s|$)/g;
  let qm: RegExpExecArray | null;
  while ((qm = qRe.exec(body))) {
    const number = Number(qm[1]);
    const code = qm[2]!;
    const chunk = qm[3]!.trim();
    const lines = chunk.split(/\r?\n/);
    let statement = "";
    const alternatives: Alt[] = [];
    for (const line of lines) {
      const alt = line.match(/^-\s*\*\*([A-E])\)\*\*\s*(.*)\s*$/);
      if (alt) {
        alternatives.push({ key: alt[1]!, text: alt[2]!.trim() });
      } else if (!line.startsWith("###") && line.trim()) {
        statement = statement ? `${statement} ${line.trim()}` : line.trim();
      }
    }
    if (alternatives.length !== 5) {
      throw new Error(`${code}: ${alternatives.length} alternativas`);
    }
    const ans = keys.get(code);
    if (!ans) throw new Error(`${code}: sem gabarito`);
    questions.push({
      id: `tjsp-banco-${code.toLowerCase()}`,
      code,
      number,
      statement,
      alternatives,
      subject: meta.subject,
      subjectKey: meta.subjectKey,
      topic: meta.subject,
      correctKey: ans.key,
      explanation: ans.explanation,
      board: "Vunesp",
      year: 2021,
      contest: "TJSP — Escrevente Técnico Judiciário",
      difficulty: "media",
      source: `Banco TJSP · ${meta.subject}`,
    });
  }

  if (questions.length !== 100) {
    throw new Error(`${subjectKey}: esperado 100, veio ${questions.length} (gabaritos ${keys.size})`);
  }
  return questions;
}

function main() {
  const raw = readFileSync(srcPath, "utf8");
  const sections: { key: string; start: RegExp }[] = [
    { key: "LEGISLACAO_ESPECIAL", start: /^##\s+Legislação Especial/m },
    { key: "ATUALIDADES", start: /^##\s+Atualidades/m },
    { key: "MATEMATICA_RACIOCINIO_LOGICO", start: /^##\s+Matemática e Raciocínio Lógico/m },
    { key: "INFORMATICA", start: /^##\s+Informática/m },
  ];

  const indices = sections.map((s) => {
    const m = raw.match(s.start);
    if (!m || m.index === undefined) throw new Error(`Seção não encontrada: ${s.key}`);
    return { key: s.key, index: m.index };
  });

  const all: Q[] = [];
  const bySubject: Record<string, Q[]> = {};
  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i]!;
    const end = indices[i + 1]?.index ?? raw.length;
    const block = raw.slice(cur.index, end);
    const qs = parseBlock(block, cur.key);
    bySubject[cur.key] = qs;
    all.push(...qs);
  }

  const payload = {
    meta: {
      title: "Banco de Questões — TJSP (400)",
      total: all.length,
      subjects: Object.fromEntries(
        Object.entries(bySubject).map(([k, v]) => [k, v.length]),
      ),
      generatedAt: new Date().toISOString(),
    },
    questions: all,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`OK: ${all.length} questões → ${outPath}`);
}

main();
