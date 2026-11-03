export type ProviderErrorCode =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "not_found"
  | "upstream"
  | "temporary"
  | "invalid_response";

export class QuestionProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string, status = 502, retryable = false) {
    super(message);
    this.name = "QuestionProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/** Mensagens seguras — nunca incluem chave, headers Authorization ou URL com secrets. */
export function errorFromHttpStatus(status: number): QuestionProviderError {
  if (status === 401) {
    return new QuestionProviderError(
      "unauthorized",
      "Provedor recusou a autenticação. Verifique a configuração no servidor.",
      401,
      false,
    );
  }
  if (status === 403) {
    return new QuestionProviderError(
      "forbidden",
      "Provedor negou o acesso a este recurso.",
      403,
      false,
    );
  }
  if (status === 404) {
    return new QuestionProviderError(
      "not_found",
      "Questão não encontrada no provedor.",
      404,
      false,
    );
  }
  if (status === 429) {
    return new QuestionProviderError(
      "rate_limited",
      "Limite de requisições do provedor atingido. Tente novamente mais tarde.",
      429,
      true,
    );
  }
  if (status >= 500) {
    return new QuestionProviderError(
      "temporary",
      "Provedor temporariamente indisponível.",
      503,
      true,
    );
  }
  return new QuestionProviderError(
    "upstream",
    "Falha ao consultar o provedor de questões.",
    502,
    false,
  );
}

export function toClientErrorPayload(err: unknown): {
  code: ProviderErrorCode;
  message: string;
  status: number;
  retryable: boolean;
} {
  if (err instanceof QuestionProviderError) {
    return { code: err.code, message: err.message, status: err.status, retryable: err.retryable };
  }
  return {
    code: "upstream",
    message: "Não foi possível obter questões do provedor.",
    status: 502,
    retryable: false,
  };
}

/** Redige possíveis vazamentos em strings de log. */
export function redactSecrets(text: string): string {
  return text
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"'&\s]+/gi, "$1[REDACTED]")
    .replace(/(QUESTIONS_API_KEY["']?\s*[:=]\s*["']?)[^"'&\s]+/gi, "$1[REDACTED]");
}
