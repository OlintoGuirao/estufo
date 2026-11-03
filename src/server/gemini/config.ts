/** Configuração server-only do Gemini. Sem prefixo VITE_. */

import { ensureServerEnv } from "@/server/load-server-env";

export type GeminiConfig = {
  apiKey: string;
  model: string;
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
  const mockFlag = (readEnv("GEMINI_USE_MOCK") ?? "false").toLowerCase();
  const useMock = mockFlag === "true" || mockFlag === "1" || mockFlag === "on";
  const timeoutMs = Math.min(
    180_000,
    Math.max(5_000, Number(readEnv("GEMINI_TIMEOUT_MS") ?? 90_000)),
  );
  return {
    apiKey,
    model,
    useMock,
    timeoutMs,
    enabled: Boolean(apiKey) || useMock,
  };
}
