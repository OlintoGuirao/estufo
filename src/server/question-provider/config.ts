/**
 * Configuração server-only. Não importar de componentes cliente.
 * Variáveis SEM prefixo VITE_ para não vazar ao browser.
 */

export type QuestionsProviderConfig = {
  configured: boolean;
  apiKey: string | null;
  baseUrl: string | null;
  /** Cache de enunciados desligado por padrão (licença). */
  cacheEnabled: boolean;
  providerName: string;
};

function readEnv(name: string): string | undefined {
  // Nitro / Node
  const fromProcess = typeof process !== "undefined" ? process.env[name] : undefined;
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  return undefined;
}

export function getQuestionsProviderConfig(): QuestionsProviderConfig {
  const apiKey = readEnv("QUESTIONS_API_KEY") ?? null;
  const baseUrl = (readEnv("QUESTIONS_API_BASE_URL") ?? "").replace(/\/$/, "") || null;
  const cacheFlag = (readEnv("QUESTIONS_API_CACHE") ?? "off").toLowerCase();
  const cacheEnabled = cacheFlag === "on" || cacheFlag === "true" || cacheFlag === "1";
  const providerName = readEnv("QUESTIONS_API_PROVIDER_NAME") ?? "http-licensed";

  return {
    configured: Boolean(apiKey && baseUrl),
    apiKey,
    baseUrl,
    cacheEnabled,
    providerName,
  };
}
