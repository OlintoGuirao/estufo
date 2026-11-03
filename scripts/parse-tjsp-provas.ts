/**
 * Converte data/30_provas_completas_tjsp.md → src/data/tjsp-30-provas.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = resolve(root, "data/30_provas_completas_tjsp.md");
const outPath = resolve(root, "src/data/tjsp-30-provas.json");

type Alt = { key: string; text: string };
type ParsedQ = {
  id: string;
  number: number;
  statement: string;
  alternatives: Alt[];
  subject: string;
  topic: string;
  correctKey: string;
  board: string;
  year: number;
  contest: string;
  difficulty: "facil" | "media" | "dificil";
  source: string;
};

type Prova = { id: number; title: string; questions: ParsedQ[] };

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function parseGabaritos(block: string): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const re = /##\s*Prova\s+(\d+)\s*\n+([^\n#]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const id = Number(m[1]);
    const keys = [...m[2]!.matchAll(/(\d+)\s*-\s*([A-E])/gi)].map((x) => x[2]!.toUpperCase());
    if (keys.length !== 22) {
      throw new Error(`Gabarito Prova ${id}: esperado 22, veio ${keys.length}`);
    }
    map.set(id, keys);
  }
  return map;
}

function parseProvaBody(body: string, provaId: number, keys: string[]): ParsedQ[] {
  const questions: ParsedQ[] = [];
  let subject = "Geral";
  const lines = body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const subj = line.match(/^###\s+(.+)\s*$/);
    if (subj) {
      subject = subj[1]!.trim();
      i += 1;
      continue;
    }
    const qHead = line.match(/^\*\*(\d+)\.\*\*\s*(.+)\s*$/);
    if (qHead) {
      const number = Number(qHead[1]);
      let statement = qHead[2]!.trim();
      i += 1;
      while (i < lines.length && !lines[i]!.match(/^\*\*\d+\.\*\*/) && !lines[i]!.match(/^###\s/) && !lines[i]!.match(/^##\s/)) {
        const l = lines[i]!;
        if (l.match(/^-\s*\*\*[A-E]\)\*\*/)) break;
        if (l.trim()) statement += " " + l.trim();
        i += 1;
      }
      const alternatives: Alt[] = [];
      while (i < lines.length) {
        const alt = lines[i]!.match(/^-\s*\*\*([A-E])\)\*\*\s*(.*)\s*$/);
        if (!alt) break;
        alternatives.push({ key: alt[1]!, text: alt[2]!.trim() });
        i += 1;
      }
      if (alternatives.length !== 5) {
        throw new Error(`Prova ${provaId} Q${number}: ${alternatives.length} alternativas`);
      }
      const correctKey = keys[number - 1];
      if (!correctKey) throw new Error(`Prova ${provaId} Q${number}: sem gabarito`);
      questions.push({
        id: `tjsp-p${pad(provaId)}-q${pad(number)}`,
        number,
        statement,
        alternatives,
        subject,
        topic: subject,
        correctKey,
        board: "Vunesp",
        year: 2021,
        contest: "TJSP — Escrevente Técnico Judiciário",
        difficulty: "media",
        source: `Prova ${pad(provaId)} · TJSP`,
      });
      continue;
    }
    i += 1;
  }
  if (questions.length !== 22) {
    throw new Error(`Prova ${provaId}: esperado 22 questões, veio ${questions.length}`);
  }
  return questions;
}

function main() {
  const raw = readFileSync(srcPath, "utf8");
  const split = raw.split(/^#\s+Gabaritos das 30 provas\s*$/m);
  if (split.length < 2) throw new Error("Seção de gabaritos não encontrada");
  const cadernos = split[0]!;
  const gabaritos = parseGabaritos(split[1]!);
  if (gabaritos.size !== 30) throw new Error(`Esperado 30 gabaritos, veio ${gabaritos.size}`);

  const provas: Prova[] = [];
  const parts = cadernos.split(/^##\s*Prova\s+(\d+)\s*$/m);
  // parts: [preamble, "01", body1, "02", body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const id = Number(parts[i]);
    const body = parts[i + 1] ?? "";
    const keys = gabaritos.get(id);
    if (!keys) throw new Error(`Sem gabarito para Prova ${id}`);
    provas.push({
      id,
      title: `Prova ${pad(id)}`,
      questions: parseProvaBody(body, id, keys),
    });
  }

  if (provas.length !== 30) throw new Error(`Esperado 30 provas, veio ${provas.length}`);
  provas.sort((a, b) => a.id - b.id);

  const uniqueStatements = new Set(provas.flatMap((p) => p.questions.map((q) => q.statement)));
  const payload = {
    meta: {
      title: "30 Provas Completas — TJSP",
      board: "Vunesp",
      contest: "TJSP — Escrevente Técnico Judiciário",
      provaCount: 30,
      questionsPerProva: 22,
      uniqueStatements: uniqueStatements.size,
      generatedAt: new Date().toISOString(),
    },
    provas,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `OK: ${provas.length} provas × 22 = ${provas.length * 22} itens; ${uniqueStatements.size} enunciados únicos → ${outPath}`,
  );
}

main();
