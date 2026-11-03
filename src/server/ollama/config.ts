/** Configuração server-only do Ollama local. Sem prefixo VITE_. */

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  /** Mock explícito para UI — nunca fallback silencioso. */
  useMock: boolean;
  timeoutMs: number;
};

function readEnv(name: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env[name] : undefined;
  return v?.trim() || undefined;
}

export function getOllamaConfig(): OllamaConfig {
  const baseUrl = (readEnv("OLLAMA_BASE_URL") ?? "http://localhost:11434").replace(/\/$/, "");
  const model = readEnv("OLLAMA_MODEL") ?? "qwen3.5:4b";
  const mockFlag = (readEnv("OLLAMA_USE_MOCK") ?? "false").toLowerCase();
  const useMock = mockFlag === "true" || mockFlag === "1" || mockFlag === "on";
  const timeoutMs = Math.min(
    120_000,
    Math.max(5_000, Number(readEnv("OLLAMA_TIMEOUT_MS") ?? 60_000)),
  );
  return { baseUrl, model, useMock, timeoutMs };
}
