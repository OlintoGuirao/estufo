import { getQuestionsProviderConfig } from "./config";
import { QuestionProviderError } from "./errors";
import { HttpLicensedQuestionProvider } from "./http-provider";
import type { QuestionProvider } from "./types";

export function createQuestionProvider(): QuestionProvider {
  const cfg = getQuestionsProviderConfig();
  if (!cfg.configured || !cfg.apiKey || !cfg.baseUrl) {
    throw new QuestionProviderError(
      "not_configured",
      "Provedor de questões não configurado. Defina QUESTIONS_API_KEY e QUESTIONS_API_BASE_URL no servidor.",
      503,
      false,
    );
  }
  if (cfg.cacheEnabled) {
    // Licença: cache permanece desligado até autorização explícita.
    // Ignoramos o flag "on" por segurança padrão.
  }
  return new HttpLicensedQuestionProvider({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    name: cfg.providerName,
  });
}

export function getProviderPublicStatus() {
  const cfg = getQuestionsProviderConfig();
  return {
    configured: cfg.configured,
    providerName: cfg.configured ? cfg.providerName : null,
    cacheEnabled: false,
  };
}
