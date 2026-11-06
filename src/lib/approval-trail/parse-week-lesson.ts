import type {
  ProfessorModule,
  ProfessorModuleKind,
  TrailLessonPracticeQuestion,
  TrailWeekLesson,
} from "@/types/trail-week-lesson";
import { normalizeProfessorPlainText } from "./professor-text";
import { polishPracticeStatement } from "./question-quality";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou JSON válido da aula.");
  return JSON.parse(raw.slice(start, end + 1));
}

const KINDS = new Set<ProfessorModuleKind>([
  "abertura",
  "teoria",
  "lei",
  "memorizacao",
  "material",
  "pratica",
  "fechamento",
]);
const KEYS = new Set(["A", "B", "C", "D", "E"]);
const CONTENT_KINDS = new Set<ProfessorModuleKind>(["teoria", "lei", "memorizacao"]);

type AiQ = {
  statement?: string;
  alternatives?: { key?: string; text?: string }[];
  correctKey?: string;
  explanation?: string;
  legalBasis?: string;
};

type AltKey = "A" | "B" | "C" | "D" | "E";

/** Embaralha alternativas e remapeia A–E para quebrar vício (sempre C / sempre a mais longa). */
function shuffleAlternatives(
  alts: { key: AltKey; text: string }[],
  correctKey: string,
): { alternatives: { key: AltKey; text: string }[]; correctKey: AltKey } {
  const correctText =
    alts.find((a) => a.key === correctKey)?.text ?? alts[0]!.text;
  const texts = alts.map((a) => a.text);
  // Fisher–Yates
  for (let i = texts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = texts[i]!;
    texts[i] = texts[j]!;
    texts[j] = tmp;
  }
  const keys = (["A", "B", "C", "D", "E"] as AltKey[]).slice(0, texts.length);
  const alternatives = keys.map((key, i) => ({ key, text: texts[i]! }));
  const newCorrect =
    alternatives.find((a) => a.text === correctText)?.key ?? alternatives[0]!.key;
  return { alternatives, correctKey: newCorrect };
}

function parseQuestions(
  raw: AiQ[] | undefined,
  max = 40,
): TrailLessonPracticeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: TrailLessonPracticeQuestion[] = [];
  for (const q of raw) {
    let statement = normalizeProfessorPlainText(String(q.statement ?? ""));
    if (!statement) continue;
    const alts = (q.alternatives ?? [])
      .map((a) => ({
        key: String(a.key ?? "").toUpperCase(),
        text: normalizeProfessorPlainText(String(a.text ?? "")),
      }))
      .filter((a) => KEYS.has(a.key) && a.text)
      .slice(0, 5) as { key: AltKey; text: string }[];
    if (alts.length < 2) continue;
    const explanation =
      normalizeProfessorPlainText(String(q.explanation ?? "")) ||
      "Revise com o professor a base indicada.";
    const polished = polishPracticeStatement(statement, alts, explanation);
    if (!polished.accept) continue;
    statement = polished.statement;
    let correctKey = String(q.correctKey ?? "").toUpperCase();
    if (!KEYS.has(correctKey) || !alts.some((a) => a.key === correctKey)) {
      correctKey = alts[0]!.key;
    }
    const shuffled = shuffleAlternatives(alts, correctKey);
    out.push({
      id: uid("pq"),
      statement,
      alternatives: shuffled.alternatives,
      correctKey: shuffled.correctKey,
      explanation,
      legalBasis:
        normalizeProfessorPlainText(String(q.legalBasis ?? "")) ||
        "Conforme edital / legislação da aula.",
    });
  }
  return out.slice(0, max);
}

type AiModule = {
  kind?: string;
  title?: string;
  body?: string;
  minutesSuggested?: number;
  definition?: string;
  mnemonic?: string;
  example?: string;
  topicLabel?: string;
  questions?: AiQ[];
};

const DEFAULT_MINUTES: Record<ProfessorModuleKind, number> = {
  abertura: 5,
  teoria: 25,
  lei: 25,
  memorizacao: 20,
  material: 15,
  pratica: 40,
  fechamento: 5,
};

type AiShape = {
  title?: string;
  objective?: string;
  professorIntro?: string;
  modules?: AiModule[];
  // legado
  teachingSteps?: { title?: string; body?: string }[];
  lawMemory?: { title?: string; tip?: string; reference?: string }[];
  materials?: { title?: string; kind?: string; detail?: string }[];
  studyMethod?: string[];
  practiceQuestions?: AiQ[];
  warnings?: string[];
};

function composeBodyFromParts(m: {
  body?: string;
  definition?: string;
  mnemonic?: string;
  example?: string;
}): string {
  const parts: string[] = [];
  const definition = normalizeProfessorPlainText(String(m.definition ?? ""));
  const mnemonic = normalizeProfessorPlainText(String(m.mnemonic ?? ""));
  const example = normalizeProfessorPlainText(String(m.example ?? ""));
  const body = normalizeProfessorPlainText(String(m.body ?? ""));

  if (definition) parts.push(`Definição.\n${definition}`);
  if (mnemonic) parts.push(`Macete de fixação.\n${mnemonic}`);
  if (example) parts.push(`Exemplo de uso.\n${example}`);
  if (body && !definition && !mnemonic && !example) parts.push(body);
  else if (body && !parts.some((p) => p.includes(body.slice(0, 40)))) {
    // Só acrescenta body extra se não for só repetição das partes.
    if (!definition || !body.startsWith(definition.slice(0, 20))) {
      parts.push(body);
    }
  }
  return parts.join("\n\n");
}

function modulesFromLegacy(data: AiShape): ProfessorModule[] {
  const mods: ProfessorModule[] = [];
  mods.push({
    id: uid("mod"),
    kind: "abertura",
    title: "Abertura com o professor",
    body:
      normalizeProfessorPlainText(String(data.professorIntro ?? "")) ||
      "Olá! Vamos estudar esta semana juntos, no ritmo do edital.",
  });
  for (const s of data.teachingSteps ?? []) {
    if (!(s.title ?? "").trim()) continue;
    mods.push({
      id: uid("mod"),
      kind: "teoria",
      title: String(s.title).trim(),
      body: normalizeProfessorPlainText(String(s.body ?? "")),
    });
  }
  for (const m of data.lawMemory ?? []) {
    if (!(m.title ?? "").trim()) continue;
    mods.push({
      id: uid("mod"),
      kind: "memorizacao",
      title: String(m.title).trim(),
      body: normalizeProfessorPlainText(
        `${String(m.tip ?? "").trim()}${m.reference ? `\n\nReferência: ${m.reference}` : ""}`,
      ),
    });
  }
  for (const m of data.materials ?? []) {
    if (!(m.title ?? "").trim()) continue;
    mods.push({
      id: uid("mod"),
      kind: "material",
      title: String(m.title).trim(),
      body: normalizeProfessorPlainText(String(m.detail ?? "")),
    });
  }
  const qs = parseQuestions(data.practiceQuestions);
  if (qs.length) {
    mods.push({
      id: uid("mod"),
      kind: "pratica",
      title: "Prática com o professor",
      body: "Resolva as questões abaixo como se estivesse na prova. Depois eu explico.",
      questions: qs,
    });
  }
  if (data.studyMethod?.length) {
    mods.push({
      id: uid("mod"),
      kind: "fechamento",
      title: "Como fechar a semana",
      body: data.studyMethod.map((x, i) => `${i + 1}. ${x}`).join("\n"),
    });
  }
  return mods;
}

function parseModules(raw: AiModule[] | undefined, data: AiShape): ProfessorModule[] {
  if (!Array.isArray(raw) || !raw.length) return modulesFromLegacy(data);
  const out: ProfessorModule[] = [];
  for (const m of raw) {
    const title = String(m.title ?? "").trim();
    const kindRaw = String(m.kind ?? "teoria") as ProfessorModuleKind;
    const kind = KINDS.has(kindRaw) ? kindRaw : "teoria";
    const definition = normalizeProfessorPlainText(String(m.definition ?? ""));
    const mnemonic = normalizeProfessorPlainText(String(m.mnemonic ?? ""));
    const example = normalizeProfessorPlainText(String(m.example ?? ""));
    const topicLabel = String(m.topicLabel ?? "").trim() || undefined;
    const allowQuestions = kind === "pratica" || CONTENT_KINDS.has(kind);
    const maxQ = kind === "pratica" ? 40 : 5;
    const questions = allowQuestions ? parseQuestions(m.questions, maxQ) : undefined;
    const body =
      CONTENT_KINDS.has(kind)
        ? composeBodyFromParts(m) || normalizeProfessorPlainText(String(m.body ?? ""))
        : normalizeProfessorPlainText(String(m.body ?? ""));
    const minutesRaw = Number(m.minutesSuggested);
    const minutesSuggested =
      Number.isFinite(minutesRaw) && minutesRaw > 0
        ? Math.min(90, Math.round(minutesRaw))
        : DEFAULT_MINUTES[kind];

    if (!title && !body && !questions?.length) continue;
    out.push({
      id: uid("mod"),
      kind,
      title: title || kind,
      body: body || (questions?.length ? "Pratique com as questões abaixo." : ""),
      minutesSuggested,
      ...(definition ? { definition } : {}),
      ...(mnemonic ? { mnemonic } : {}),
      ...(example ? { example } : {}),
      ...(topicLabel ? { topicLabel } : {}),
      ...(questions?.length ? { questions } : {}),
    });
  }
  return out.length ? out : modulesFromLegacy(data);
}

export function buildWeekLessonFromAiText(
  aiText: string,
  meta: { trailId: string; week: number; mocked: boolean },
): TrailWeekLesson {
  const data = extractJson(aiText) as AiShape;
  const modules = parseModules(data.modules, data);
  if (!modules.length) {
    throw new Error("A aula veio sem módulos. Peça para o professor gerar novamente.");
  }

  const professorIntro =
    normalizeProfessorPlainText(String(data.professorIntro ?? "")) ||
    modules.find((m) => m.kind === "abertura")?.body ||
    "Sou seu professor nesta trilha. Vamos módulo a módulo.";

  return {
    trailId: meta.trailId,
    week: meta.week,
    title: String(data.title ?? "").trim() || `Semana ${meta.week} — com o Professor IA`,
    objective:
      normalizeProfessorPlainText(String(data.objective ?? "")) ||
      "Dominar os temas desta semana do edital.",
    professorIntro,
    modules,
    warnings: Array.isArray(data.warnings) ? data.warnings.map((w) => String(w)).filter(Boolean) : [],
    mocked: meta.mocked,
    createdAt: new Date().toISOString(),
  };
}

export const WEEK_LESSON_SYSTEM = `Você é o PROFESSOR particular do aluno no Estufoo (concurso público).
Monte a aula da SEMANA/DIA em MÓDULOS SEPARADOS — um bloco por etapa do edital.
Cada etapa exige ~2 horas de estudo (definição + macete + exemplo + 5 questões).
Aula rasa de 10 minutos é PROIBIDA.

PARA CADA ETAPA listada, gere EXATAMENTE estes 4 módulos (nessa ordem), com titles claros:
1) kind "teoria", title "Definição — {etapa}", minutesSuggested 35, body/definition densos (8–12 frases)
2) kind "memorizacao", title "Macete — {etapa}", minutesSuggested 15, body = macete de fixação
3) kind "material", title "Exemplo — {etapa}", minutesSuggested 25, body = exemplo de uso / como cai na prova (passo a passo)
4) kind "memorizacao", title "5 questões — {etapa}", minutesSuggested 25, questions = EXATAMENTE 5

Depois de TODAS as etapas:
- 1 kind "pratica", title "Prática da semana", minutesSuggested 40+, questions = NO MÍNIMO 5 POR etapa
- 1 kind "fechamento", minutesSuggested 5

No início: 1 kind "abertura" (5 min) listando as etapas do dia/semana.

ANTI-VÍCIO NAS QUESTÕES (obrigatório):
- Padrão VUNESP: SEMPRE 5 alternativas (A, B, C, D, E) e uma única correta.
- Distribua correctKey entre A, B, C, D e E de forma equilibrada (não concentre em C).
- A alternativa correta NÃO pode ser sistematicamente a mais longa.
- Todas as alternativas A–E devem ter tamanho parecido (variação máxima ~20 caracteres).
- Distratores plausíveis, no nível da banca.

QUALIDADE DO ENUNCIADO (Português / interpretação — obrigatório):
- NUNCA diga "termo destacado", "palavra destacada" ou "trecho destacado" sem marcar o alvo com «assim» dentro do trecho.
  Certo: No trecho 'O réu confessou o crime, «contudo» manteve dúvidas', o termo destacado…
  Errado: citar o trecho sem «marcar» o termo.
- Se o comando for "Assinale a alternativa em que…", as alternativas DEVEM ser períodos/contextos completos (frases), nunca rótulos meta ("Muda para concessão", "Altera para causa").
- Se quiser cobrar o EFEITO da troca (ex.: Portanto → Porquanto), o comando deve ser direto:
  "A substituição de «portanto» por «porquanto» no período altera o sentido para:" e aí sim alternativas curtas de relação semântica.
- Não misture os dois formatos. Não peça "mantém o sentido original" se a troca muda o sentido.
- Conectivos: cada alternativa deve ser um exemplo claro e distinto (causa ≠ condição ≠ concessão ≠ consequência).

ESTILO:
- Português claro, 1ª pessoa, frases curtas.
- PROIBIDO markdown (*, **, _, #, backticks). Para destaque use «termo».
- Não invente artigos/leis. Se receber FONTE LEGAL, fundamente nela e cite o artigo; se não, diga "confira o texto oficial".

Responda APENAS JSON:
{
  "title": "título da aula",
  "objective": "1 frase",
  "professorIntro": "2–3 frases; diga quantas etapas e ~2h cada",
  "modules": [
    {
      "kind": "abertura|teoria|lei|memorizacao|material|pratica|fechamento",
      "title": "Definição — nome da etapa",
      "minutesSuggested": 35,
      "topicLabel": "etapa do edital",
      "definition": "opcional se body já for a definição",
      "body": "texto do professor",
      "questions": [
        {
          "statement": "...",
          "alternatives": [
            { "key": "A", "text": "..." },
            { "key": "B", "text": "..." },
            { "key": "C", "text": "..." },
            { "key": "D", "text": "..." },
            { "key": "E", "text": "..." }
          ],
          "correctKey": "A",
          "explanation": "2–4 frases",
          "legalBasis": "base curta"
        }
      ]
    }
  ],
  "warnings": []
}`
