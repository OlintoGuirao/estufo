import { getOllamaConfig } from "./config";
import { OllamaError, summarizeForLog } from "./errors";

export type OllamaChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type OllamaGenerateResult = {
  text: string;
  model: string;
  mocked: boolean;
};

type FetchImpl = typeof fetch;

/**
 * Cliente HTTP do Ollama (só servidor).
 * API: POST {base}/api/chat
 */
export async function ollamaChat(
  messages: OllamaChatMessage[],
  opts?: { fetchImpl?: FetchImpl; mockText?: string },
): Promise<OllamaGenerateResult> {
  const cfg = getOllamaConfig();
  if (cfg.useMock) {
    return {
      text: opts?.mockText ?? "Esta é uma resposta mockada do tutor (OLLAMA_USE_MOCK=true).",
      model: cfg.model,
      mocked: true,
    };
  }

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetchImpl(`${cfg.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        // qwen3.5+ com "thinking" pode demorar minutos e deixar content vazio —
        // desliga raciocínio longo para dicas/treino do app.
        think: false,
        messages,
        options: { temperature: 0.4 },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 404) {
      throw new OllamaError(
        "model_missing",
        `Modelo “${cfg.model}” não encontrado. Rode: ollama pull ${cfg.model}`,
        404,
      );
    }
    if (!res.ok) {
      throw new OllamaError(
        "offline",
        `Ollama respondeu HTTP ${res.status}. Verifique se o serviço está ligado.`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      message?: { content?: string; thinking?: string; reasoning?: string };
      error?: string;
    };
    if (data.error) {
      const err = String(data.error);
      if (/not found|pull/i.test(err)) {
        throw new OllamaError(
          "model_missing",
          `Modelo “${cfg.model}” indisponível. Rode: ollama pull ${cfg.model}`,
          404,
        );
      }
      throw new OllamaError("rejected", "O Ollama rejeitou a solicitação.", 502);
    }
    const text = extractAssistantText(data.message);
    if (!text) throw new OllamaError("empty", "O modelo devolveu resposta vazia.", 502);
    return { text, model: cfg.model, mocked: false };
  } catch (e) {
    if (e instanceof OllamaError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new OllamaError("timeout", "Tempo esgotado ao esperar o Ollama. Tente de novo.", 504);
    }
    throw new OllamaError(
      "offline",
      `Ollama inacessível em ${cfg.baseUrl}. Inicie com “ollama serve” e confira OLLAMA_BASE_URL.`,
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function checkOllamaStatus(opts?: { fetchImpl?: FetchImpl }): Promise<{
  available: boolean;
  modelReady: boolean;
  baseUrl: string;
  model: string;
  useMock: boolean;
  message: string;
}> {
  const cfg = getOllamaConfig();
  if (cfg.useMock) {
    return {
      available: true,
      modelReady: true,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      useMock: true,
      message: "Modo mock explícito (OLLAMA_USE_MOCK). Respostas não vêm do modelo real.",
    };
  }

  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const tagsRes = await fetchImpl(`${cfg.baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!tagsRes.ok) {
      return {
        available: false,
        modelReady: false,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        useMock: false,
        message: `Ollama em ${cfg.baseUrl} respondeu HTTP ${tagsRes.status}.`,
      };
    }
    const tags = (await tagsRes.json()) as { models?: { name?: string; model?: string }[] };
    const names = (tags.models ?? []).map((m) => m.name ?? m.model ?? "");
    const modelReady = names.some(
      (n) =>
        n === cfg.model ||
        n.startsWith(`${cfg.model}:`) ||
        n.startsWith(cfg.model.split(":")[0] + ":"),
    );
    // also match qwen3.5:4b when listed as qwen3.5:4b or with digest suffix
    const ready =
      modelReady ||
      names.some((n) => n.includes(cfg.model) || cfg.model.includes(n.split(":")[0] ?? ""));

    return {
      available: true,
      modelReady: ready,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      useMock: false,
      message: ready
        ? `Ollama ok · modelo ${cfg.model}`
        : `Ollama ligado, mas o modelo “${cfg.model}” não aparece. Rode: ollama pull ${cfg.model}`,
    };
  } catch {
    return {
      available: false,
      modelReady: false,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      useMock: false,
      message: `Não foi possível conectar a ${cfg.baseUrl}. Inicie o Ollama na máquina local.`,
    };
  }
}

/** Prefere content; se vazio (modelos thinking), usa trecho final do thinking. */
export function extractAssistantText(message?: {
  content?: string;
  thinking?: string;
  reasoning?: string;
} | null): string {
  const content = message?.content?.trim() ?? "";
  if (content) return content;
  const thinking = (message?.thinking ?? message?.reasoning ?? "").trim();
  if (!thinking) return "";
  // Último parágrafo / bloco após marcadores comuns de resposta final
  const parts = thinking.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? thinking;
}

export function assertNoSecretsInMessages(messages: OllamaChatMessage[], forbidden: string[]) {
  const blob = messages.map((m) => m.content).join("\n");
  for (const f of forbidden) {
    const token = f.trim();
    if (token.length >= 1 && blob.includes(token)) {
      throw new OllamaError(
        "rejected",
        `Contexto bloqueado: dado sensível omitido do envio ao modelo (${summarizeForLog(token, 12)}).`,
        400,
      );
    }
  }
}
