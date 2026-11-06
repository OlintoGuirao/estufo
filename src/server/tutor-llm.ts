/**
 * Camada única do tutor LLM.
 * - Gemini (padrão): tier "fast" = GEMINI_MODEL, tier "smart" = GEMINI_MODEL_SMART.
 * - Ollama fica só como fallback se Gemini não estiver configurado.
 *
 * Passe `task` para escolher modelo/temperatura/JSON automaticamente
 * (ver src/server/llm-tasks.ts).
 */
import type { OllamaChatMessage, OllamaGenerateResult } from "@/server/ollama/client";
import { getGeminiConfig } from "@/server/gemini/config";
import { parseLlmJson, resolveCallOptions, type TutorChatOptions } from "@/server/llm-tasks";

export type { TutorChatOptions, TutorTask } from "@/server/llm-tasks";

async function rawChat(
  messages: OllamaChatMessage[],
  opts?: TutorChatOptions,
): Promise<OllamaGenerateResult> {
  const gemini = getGeminiConfig();
  if (gemini.enabled) {
    const { geminiChat } = await import("@/server/gemini/client");
    return geminiChat(messages, opts);
  }
  const { ollamaChat } = await import("@/server/ollama/client");
  return ollamaChat(messages, opts);
}

function isParseableJson(text: string): boolean {
  try {
    parseLlmJson(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chamada ao modelo. Em tarefas JSON, se a resposta vier com JSON quebrado,
 * pede UMA correção automaticamente — antes o app caía calado no conteúdo mock.
 */
export async function tutorChat(
  messages: OllamaChatMessage[],
  opts?: TutorChatOptions,
): Promise<OllamaGenerateResult> {
  const first = await rawChat(messages, opts);
  if (first.mocked || !resolveCallOptions(opts).json || isParseableJson(first.text)) return first;
  console.warn("[tutor] JSON inválido do modelo — pedindo correção");
  const retry = await rawChat(
    [
      ...messages,
      { role: "assistant", content: first.text.slice(0, 4_000) },
      {
        role: "user",
        content:
          "Sua resposta não é um JSON válido. Responda de novo SOMENTE com o JSON completo no formato pedido, sem texto fora dele.",
      },
    ],
    opts,
  );
  return isParseableJson(retry.text) ? retry : first;
}

/**
 * Chama o modelo pedindo JSON e faz o parse.
 * Se o JSON vier inválido (ou `validate` rejeitar), tenta UMA vez de novo
 * mostrando o erro ao modelo. Lança se falhar nas duas.
 */
export async function tutorChatJson<T>(
  messages: OllamaChatMessage[],
  opts: TutorChatOptions & { validate?: (data: T) => string | null },
): Promise<{ data: T; result: OllamaGenerateResult }> {
  const { validate, ...chatOpts } = opts;
  const first = await tutorChat(messages, { ...chatOpts, json: true });
  try {
    const data = parseLlmJson<T>(first.text);
    const problem = validate?.(data) ?? null;
    if (!problem) return { data, result: first };
    throw new Error(problem);
  } catch (err) {
    if (first.mocked) throw err;
    const reason = err instanceof Error ? err.message : "JSON inválido";
    const retry = await tutorChat(
      [
        ...messages,
        { role: "assistant", content: first.text.slice(0, 4_000) },
        {
          role: "user",
          content: `Sua resposta não pôde ser usada (${reason.slice(0, 200)}). Responda de novo SOMENTE com o JSON válido no formato pedido, completo, sem texto fora do JSON.`,
        },
      ],
      { ...chatOpts, json: true },
    );
    const data = parseLlmJson<T>(retry.text);
    const problem = validate?.(data) ?? null;
    if (problem) throw new Error(problem);
    return { data, result: retry };
  }
}

export async function checkTutorLlmStatus() {
  const gemini = getGeminiConfig();
  if (gemini.enabled) {
    const { checkGeminiStatus } = await import("@/server/gemini/client");
    return checkGeminiStatus();
  }
  const { checkOllamaStatus } = await import("@/server/ollama/client");
  return checkOllamaStatus();
}

export async function assertNoSecretsInTutorMessages(
  messages: OllamaChatMessage[],
  forbidden: string[],
) {
  const gemini = getGeminiConfig();
  if (gemini.enabled) {
    const { assertNoSecretsInGeminiMessages } = await import("@/server/gemini/client");
    return assertNoSecretsInGeminiMessages(messages, forbidden);
  }
  const { assertNoSecretsInMessages } = await import("@/server/ollama/client");
  return assertNoSecretsInMessages(messages, forbidden);
}
