export type OllamaErrorCode =
  | "offline"
  | "model_missing"
  | "timeout"
  | "invalid_response"
  | "empty"
  | "rejected"
  | "upstream";

export class OllamaError extends Error {
  readonly code: OllamaErrorCode;
  readonly status: number;

  constructor(code: OllamaErrorCode, message: string, status = 503) {
    super(message);
    this.name = "OllamaError";
    this.code = code;
    this.status = status;
  }
}

function isOllamaLike(
  err: unknown,
): err is { code: OllamaErrorCode; message: string; status?: number; name?: string } {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // Duck-typing: instanceof falha com módulos duplicados no Vite SSR.
  if (err instanceof OllamaError) return true;
  if (e["name"] === "OllamaError" && typeof e["code"] === "string") return true;
  if (
    typeof e["code"] === "string" &&
    typeof e["message"] === "string" &&
    ["offline", "model_missing", "timeout", "invalid_response", "empty", "rejected", "upstream"].includes(
      e["code"] as string,
    )
  ) {
    return true;
  }
  return false;
}

export function toOllamaClientPayload(err: unknown): {
  code: OllamaErrorCode;
  message: string;
  status: number;
} {
  if (isOllamaLike(err)) {
    return {
      code: err.code,
      message: err.message,
      status: typeof err.status === "number" ? err.status : 503,
    };
  }
  if (err instanceof Error && err.message.trim()) {
    return {
      code: "offline",
      message: err.message.slice(0, 400),
      status: 503,
    };
  }
  return {
    code: "offline",
    message: "Não foi possível falar com o tutor de IA.",
    status: 503,
  };
}

/** Evita logar enunciados/gabaritos longos. */
export function summarizeForLog(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
