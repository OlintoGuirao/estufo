/**
 * Avaliação do Professor IA com questões que JÁ têm gabarito (banco + provas oficiais).
 * Mede com número o que antes era "achismo":
 *   1. Acerto: o modelo resolve a questão e acerta o gabarito?
 *   2. Vazamento: a dica entrega a letra?
 *   3. Citações: a explicação cita artigo que não está em nenhuma fonte enviada?
 *
 * Uso:
 *   npm run eval:tutor                       (40 questões, tier smart)
 *   npm run eval:tutor -- --n 80 --tier fast
 * Requer GEMINI_API_KEY no .env. Relatório em .data/eval/AAAA-MM-DD-HHMM.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "./load-env";
import officialData from "../src/data/tjsp-official-provas.json";
import bancoData from "../src/data/tjsp-banco-400.json";

loadEnv();

type Q = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  subject: string;
  topic?: string;
  explanation?: string;
};

const args = process.argv.slice(2);
const arg = (name: string, def: string) =>
  args.includes(`--${name}`) ? (args[args.indexOf(`--${name}`) + 1] ?? def) : def;
const N = Number(arg("n", "40"));
const TIER = arg("tier", "smart") as "fast" | "smart";
const SEED = Number(arg("seed", "42"));

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sample(all: Q[], n: number): Q[] {
  const rand = rng(SEED);
  const bySubject = new Map<string, Q[]>();
  for (const q of all) {
    const list = bySubject.get(q.subject) ?? [];
    list.push(q);
    bySubject.set(q.subject, list);
  }
  for (const list of bySubject.values()) list.sort(() => rand() - 0.5);
  const out: Q[] = [];
  while (out.length < n) {
    let added = false;
    for (const list of bySubject.values()) {
      const q = list.pop();
      if (q) {
        out.push(q);
        added = true;
      }
      if (out.length >= n) break;
    }
    if (!added) break;
  }
  return out;
}

async function main() {
  if (!process.env["GEMINI_API_KEY"]?.trim()) {
    console.error("Defina GEMINI_API_KEY no .env para rodar a avaliação.");
    process.exit(1);
  }
  const { tutorChat, tutorChatJson } = await import("../src/server/tutor-llm");
  const { buildVerifyMessages } = await import("../src/server/question-verify");
  const { buildTipMessages, buildExplainMessages } = await import("../src/lib/tutor/prompts");
  const { tipLooksLikeAnswerReveal } = await import("../src/lib/tutor/validate");
  const { retrieveLegalContext } = await import("../src/server/legal/retrieve");
  const { findUnsupportedArticles } = await import("../src/server/legal/citations");

  const pool: Q[] = [
    ...(officialData as { provas: { questions: Q[] }[] }).provas.flatMap((p) => p.questions),
    ...(bancoData as { questions: Q[] }).questions,
  ].filter((q) => q.correctKey && q.alternatives?.length >= 4);
  const qs = sample(pool, N);
  console.log(`Avaliando ${qs.length} questões · tier ${TIER}\n`);

  // 1) Acerto
  const answers: { id: string; subject: string; ok: boolean; got: string; want: string }[] = [];
  for (let i = 0; i < qs.length; i += 10) {
    const batch = qs.slice(i, i + 10);
    try {
      const { data } = await tutorChatJson<{ answers?: { i: number; key: string }[] }>(
        buildVerifyMessages(batch, { subject: "Concurso TJSP Escrevente" }),
        { task: "verify", tier: TIER },
      );
      const map = new Map((data.answers ?? []).map((a) => [Number(a.i), String(a.key).toUpperCase()]));
      batch.forEach((q, j) => {
        const got = map.get(j) ?? "?";
        answers.push({ id: q.id, subject: q.subject, ok: got === q.correctKey, got, want: q.correctKey });
      });
    } catch (e) {
      console.warn("lote falhou:", (e as Error).message);
    }
    process.stdout.write(`\r1/3 acerto … ${answers.length}/${qs.length}`);
  }

  // 2) Vazamento na dica (10 questões, escolhendo uma alternativa errada)
  const tipSet = qs.slice(0, Math.min(10, qs.length));
  let leaks = 0;
  for (const q of tipSet) {
    const wrong = q.alternatives.find((a) => a.key !== q.correctKey)?.key ?? "A";
    const r = await tutorChat(
      buildTipMessages({
        statement: q.statement,
        alternatives: q.alternatives,
        studentChoice: wrong,
        subject: q.subject,
      }),
      { task: "tip", tier: TIER },
    );
    if (tipLooksLikeAnswerReveal(r.text, q.correctKey)) leaks++;
  }
  process.stdout.write(`\r2/3 vazamento ok              `);

  // 3) Citações sem fonte (10 explicações)
  let unsupported = 0;
  let cited = 0;
  for (const q of tipSet) {
    const legal = await retrieveLegalContext(`${q.subject}\n${q.statement}`, { limit: 4 });
    const wrong = q.alternatives.find((a) => a.key !== q.correctKey)?.key ?? "A";
    const r = await tutorChat(
      buildExplainMessages({
        statement: q.statement,
        alternatives: q.alternatives,
        correctKey: q.correctKey,
        studentChoice: wrong,
        subject: q.subject,
        ...(legal.text ? { legalContext: legal.text } : {}),
      }),
      { task: "explain", tier: TIER },
    );
    const bad = findUnsupportedArticles(r.text, [legal.text, q.explanation ?? "", q.statement]);
    if (/art(igo)?\.?\s*\d/i.test(r.text)) cited++;
    if (bad.length) unsupported++;
  }
  console.log(`\r3/3 citações ok              \n`);

  const bySubject = new Map<string, { ok: number; total: number }>();
  for (const a of answers) {
    const s = bySubject.get(a.subject) ?? { ok: 0, total: 0 };
    s.total++;
    if (a.ok) s.ok++;
    bySubject.set(a.subject, s);
  }
  const acc = answers.length ? answers.filter((a) => a.ok).length / answers.length : 0;

  console.log(`ACERTO GERAL: ${(acc * 100).toFixed(1)}% (${answers.filter((a) => a.ok).length}/${answers.length})`);
  for (const [s, v] of [...bySubject].sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total)) {
    console.log(`  ${s.padEnd(34)} ${((v.ok / v.total) * 100).toFixed(0).padStart(3)}%  (${v.ok}/${v.total})`);
  }
  console.log(`DICAS QUE ENTREGAM A LETRA: ${leaks}/${tipSet.length}`);
  console.log(`EXPLICAÇÕES COM ARTIGO SEM FONTE: ${unsupported}/${tipSet.length} (citaram artigo: ${cited})`);

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(root, ".data", "eval");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const file = path.join(dir, `${stamp}-${TIER}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        tier: TIER,
        n: answers.length,
        accuracy: acc,
        bySubject: Object.fromEntries(bySubject),
        leaks,
        unsupported,
        wrong: answers.filter((a) => !a.ok),
      },
      null,
      2,
    ),
  );
  console.log(`\nRelatório: ${path.relative(root, file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
