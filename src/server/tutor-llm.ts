/**
 * Camada única do tutor LLM: Gemini Flash-Lite (padrão).
 * Ollama fica só como fallback se Gemini não estiver configurado.
 */
import type { OllamaChatMessage, OllamaGenerateResult } from "@/server/ollama/client";
import { getGeminiConfig } from "@/server/gemini/config";

export async function tutorChat(
  messages: OllamaChatMessage[],
  opts?: { mockText?: string },
): Promise<OllamaGenerateResult> {
  const gemini = getGeminiConfig();
  if (gemini.enabled) {
    const { geminiChat } = await import("@/server/gemini/client");
    return geminiChat(messages, opts);
  }
  const { ollamaChat } = await import("@/server/ollama/client");
  return ollamaChat(messages, opts);
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
