/**
 * Perfis de chamada por tarefa do tutor.
 *
 * - tier "fast": modelo barato (Flash-Lite) — dicas, flashcards, temas.
 * - tier "smart": modelo forte (Flash/Pro) — aula, mastigado, questões, correção.
 *
 * Temperatura baixa onde precisa de precisão (direito, gabarito) e mais alta
 * onde criatividade ajuda (temas de redação, exemplos).
 */

export type LlmTier = "fast" | "smart";

export type TutorTask =
  | "tip"
  | "explain"
  | "mastigado"
  | "practice"
  | "verify"
  | "chat"
  | "lesson"
  | "questions"
  | "study-pack"
  | "flashcards"
  | "mind-map"
  | "material"
  | "redacao-temas"
  | "redacao-correcao"
  | "weekly"
  | "video-quiz"
  | "generic";

export type TaskProfile = {
  tier: LlmTier;
  temperature: number;
  /** Pede JSON nativo ao provedor (responseMimeType / format=json). */
  json: boolean;
  /** Liga raciocínio interno (thinking) quando o modelo suporta. */
  thinking: boolean;
  maxOutputTokens?: number;
};

export const TASK_PROFILES: Record<TutorTask, TaskProfile> = {
  tip: { tier: "fast", temperature: 0.5, json: false, thinking: false, maxOutputTokens: 400 },
  explain: { tier: "smart", temperature: 0.3, json: false, thinking: true },
  mastigado: { tier: "smart", temperature: 0.3, json: false, thinking: true },
  practice: { tier: "smart", temperature: 0.6, json: true, thinking: true },
  verify: { tier: "smart", temperature: 0, json: true, thinking: true },
  chat: { tier: "smart", temperature: 0.4, json: false, thinking: true },
  lesson: { tier: "smart", temperature: 0.4, json: true, thinking: true },
  questions: { tier: "smart", temperature: 0.5, json: true, thinking: true },
  "study-pack": { tier: "smart", temperature: 0.3, json: true, thinking: false },
  flashcards: { tier: "fast", temperature: 0.3, json: true, thinking: false },
  "mind-map": { tier: "fast", temperature: 0.3, json: true, thinking: false },
  material: { tier: "smart", temperature: 0.5, json: true, thinking: false },
  "redacao-temas": {
    tier: "smart",
    temperature: 0.75,
    json: true,
    thinking: false,
    maxOutputTokens: 8192,
  },
  "redacao-correcao": { tier: "smart", temperature: 0.2, json: true, thinking: true },
  weekly: { tier: "smart", temperature: 0.4, json: false, thinking: false },
  "video-quiz": { tier: "fast", temperature: 0.5, json: true, thinking: false },
  generic: { tier: "fast", temperature: 0.4, json: false, thinking: false },
};

export type TutorChatOptions = {
  mockText?: string;
  task?: TutorTask;
  /** Sobrescreve o perfil da tarefa. */
  tier?: LlmTier;
  temperature?: number;
  json?: boolean;
  /** Schema OpenAPI-subset (Gemini responseSchema). Implica json=true. */
  responseSchema?: Record<string, unknown>;
  thinking?: boolean;
  maxOutputTokens?: number;
};

export type ResolvedCallOptions = TaskProfile & {
  mockText?: string;
  responseSchema?: Record<string, unknown>;
};

export function resolveCallOptions(opts?: TutorChatOptions): ResolvedCallOptions {
  const base = TASK_PROFILES[opts?.task ?? "generic"];
  const out: ResolvedCallOptions = {
    tier: opts?.tier ?? base.tier,
    temperature: opts?.temperature ?? base.temperature,
    json: Boolean(opts?.responseSchema) || (opts?.json ?? base.json),
    thinking: opts?.thinking ?? base.thinking,
  };
  const maxOut = opts?.maxOutputTokens ?? base.maxOutputTokens;
  if (maxOut != null) out.maxOutputTokens = maxOut;
  if (opts?.mockText != null) out.mockText = opts.mockText;
  if (opts?.responseSchema) out.responseSchema = opts.responseSchema;
  return out;
}

/** Remove cercas ```json … ``` e texto antes/depois do primeiro objeto/array JSON. */
export function extractJsonText(raw: string): string {
  const t = String(raw ?? "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = (fence?.[1] ?? t).trim();
  if (body.startsWith("{") || body.startsWith("[")) return body;
  const firstObj = body.indexOf("{");
  const firstArr = body.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (!starts.length) return body;
  const start = Math.min(...starts);
  const close = body[start] === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body.slice(start);
}

/** JSON.parse tolerante (cercas, texto extra). Lança se inválido. */
export function parseLlmJson<T = unknown>(raw: string): T {
  return JSON.parse(extractJsonText(raw)) as T;
}
