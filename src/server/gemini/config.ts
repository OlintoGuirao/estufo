/** Configuração server-only do Gemini. Sem prefixo VITE_. */

import { ensureServerEnv } from "@/server/load-server-env";

export type GeminiConfig = {
  apiKey: string;
  /** Modelo rápido/barato (tier "fast"). */
  model: string;
  /** Modelo forte (tier "smart") — aula, mastigado, questões, correção. */
  modelSmart: string;
  /** Liga thinkingConfig no tier smart (GEMINI_THINKING=off desliga). */
  thinking: boolean;
  /** Nível de raciocínio enviado ao modelo (low|medium|high). */
  thinkingLevel: string;
  useMock: boolean;
  timeoutMs: number;
  enabled: boolean;
};

function readEnv(name: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env[name] : undefined;
  return v?.trim() || undefined;
}

export function getGeminiConfig(): GeminiConfig {
  ensureServerEnv();
  const apiKey = readEnv("GEMINI_API_KEY") ?? "";
  const model = readEnv("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
  const modelSmart = readEnv("GEMINI_MODEL_SMART") ?? "gemini-3.5-flash";
  const thinkingFlag = (readEnv("GEMINI_THINKING") ?? "on").toLowerCase();
  const thinking = !["off", "false", "0"].includes(thinkingFlag);
  const thinkingLevel = readEnv("GEMINI_THINKING_LEVEL") ?? "medium";
  const mockFlag = (readEnv("GEMINI_USE_MOCK") ?? "false").toLowerCase();
  const useMock = mockFlag === "true" || mockFlag === "1" || mockFlag === "on";
  const timeoutMs = Math.min(
    180_000,
    Math.max(5_000, Number(readEnv("GEMINI_TIMEOUT_MS") ?? 90_000)),
  );
  return {
    apiKey,
    model,
    modelSmart,
    thinking,
    thinkingLevel,
    useMock,
    timeoutMs,
    enabled: Boolean(apiKey) || useMock,
  };
}
