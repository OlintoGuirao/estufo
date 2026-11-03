import { getGeminiConfig } from "./config";
import { OllamaError, summarizeForLog } from "@/server/ollama/errors";
import type { OllamaChatMessage, OllamaGenerateResult } from "@/server/ollama/client";

type FetchImpl = typeof fetch;

/**
 * Cliente Gemini (só servidor) — generateContent.
 * Modelo padrão: gemini-3.5-flash-lite
 */
export async function geminiChat(
  messages: OllamaChatMessage[],
  opts?: { fetchImpl?: FetchImpl; mockText?: string },
): Promise<OllamaGenerateResult> {
  const cfg = getGeminiConfig();
  if (cfg.useMock) {
    return {
      text: opts?.mockText ?? "Resposta mockada do tutor (GEMINI_USE_MOCK=true).",
      model: cfg.model,
      mocked: true,
    };
  }
  if (!cfg.apiKey) {
    throw new OllamaError(
      "offline",
      "Gemini não configurado. Defina GEMINI_API_KEY no .env (servidor).",
      503,
    );
  }

  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (!contents.length) {
    throw new OllamaError("rejected", "Nenhuma mensagem para enviar ao Gemini.", 400);
  }

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  try {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: 0.4 },
    };
    if (systemParts.length) {
      body["systemInstruction"] = { parts: [{ text: systemParts.join("\n\n") }] };
    }

    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await res.json()) as {
      error?: { message?: string; status?: string; code?: number };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    if (!res.ok) {
      const msg = data.error?.message ?? `Gemini HTTP ${res.status}`;
      if (res.status === 404 || /not found|NOT_FOUND/i.test(msg)) {
        throw new OllamaError(
          "model_missing",
          `Modelo “${cfg.model}” indisponível no Gemini. Confira GEMINI_MODEL.`,
          404,
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new OllamaError("rejected", "Chave Gemini inválida ou sem permissão.", res.status);
      }
      throw new OllamaError("offline", msg, res.status >= 500 ? 502 : res.status);
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new OllamaError("empty", "O Gemini devolveu resposta vazia.", 502);
    return { text, model: cfg.model, mocked: false };
  } catch (e) {
    if (e instanceof OllamaError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new OllamaError("timeout", "Tempo esgotado ao esperar o Gemini. Tente de novo.", 504);
    }
    throw new OllamaError(
      "offline",
      e instanceof Error ? e.message : "Falha ao falar com o Gemini.",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGeminiStatus(): Promise<{
  available: boolean;
  modelReady: boolean;
  baseUrl: string;
  model: string;
  useMock: boolean;
  message: string;
}> {
  const cfg = getGeminiConfig();
  if (cfg.useMock) {
    return {
      available: true,
      modelReady: true,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: cfg.model,
      useMock: true,
      message: "Modo mock explícito (GEMINI_USE_MOCK). Respostas não vêm do modelo real.",
    };
  }
  if (!cfg.apiKey) {
    return {
      available: false,
      modelReady: false,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: cfg.model,
      useMock: false,
      message: "GEMINI_API_KEY ausente no .env.",
    };
  }
  return {
    available: true,
    modelReady: true,
    baseUrl: "https://generativelanguage.googleapis.com",
    model: cfg.model,
    useMock: false,
    message: `Gemini ok · modelo ${cfg.model}`,
  };
}

export function assertNoSecretsInGeminiMessages(
  messages: OllamaChatMessage[],
  forbidden: string[],
) {
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
