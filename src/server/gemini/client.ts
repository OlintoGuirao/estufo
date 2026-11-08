import { getGeminiConfig } from "./config";
import { OllamaError, summarizeForLog } from "@/server/ollama/errors";
import type { OllamaChatMessage, OllamaGenerateResult } from "@/server/ollama/client";
import { resolveCallOptions, type TutorChatOptions } from "@/server/llm-tasks";

type FetchImpl = typeof fetch;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

type GeminiResponse = {
  error?: { message?: string; status?: string; code?: number };
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Monta o corpo do generateContent. Exportado para testes. */
export function buildGeminiBody(
  messages: OllamaChatMessage[],
  opts: ReturnType<typeof resolveCallOptions>,
  extra: { thinkingLevel?: string | null },
): Record<string, unknown> {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  // Gemini espera a conversa começando pelo usuário e alternando papéis:
  // juntamos turnos seguidos do mesmo papel e descartamos "model" inicial.
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0]!.text += `\n\n${m.content}`;
    else contents.push({ role, parts: [{ text: m.content }] });
  }

  const generationConfig: Record<string, unknown> = { temperature: opts.temperature };
  if (opts.maxOutputTokens) generationConfig["maxOutputTokens"] = opts.maxOutputTokens;
  if (opts.json) generationConfig["responseMimeType"] = "application/json";
  if (opts.responseSchema) generationConfig["responseSchema"] = opts.responseSchema;
  if (extra.thinkingLevel) {
    generationConfig["thinkingConfig"] = { thinkingLevel: extra.thinkingLevel };
  }

  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemParts.length) {
    body["systemInstruction"] = { parts: [{ text: systemParts.join("\n\n") }] };
  }
  return body;
}

/**
 * Cliente Gemini (só servidor) — generateContent.
 * - Tier fast → GEMINI_MODEL; tier smart → GEMINI_MODEL_SMART (cai para fast se não existir).
 * - JSON nativo (responseMimeType/responseSchema) quando a tarefa pede.
 * - Retry com backoff em 429/5xx.
 * - Chave no header x-goog-api-key (não na URL, para não vazar em logs).
 */
export async function geminiChat(
  messages: OllamaChatMessage[],
  rawOpts?: TutorChatOptions & { fetchImpl?: FetchImpl },
): Promise<OllamaGenerateResult> {
  const cfg = getGeminiConfig();
  const opts = resolveCallOptions(rawOpts);
  const wantedModel = opts.tier === "smart" ? cfg.modelSmart : cfg.model;

  if (cfg.useMock) {
    return {
      text: opts.mockText ?? "Resposta mockada do tutor (GEMINI_USE_MOCK=true).",
      model: wantedModel,
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
  if (!messages.some((m) => m.role !== "system")) {
    throw new OllamaError("rejected", "Nenhuma mensagem para enviar ao Gemini.", 400);
  }

  const fetchImpl = rawOpts?.fetchImpl ?? fetch;
  let model = wantedModel;
  // Modelos Flash recentes "pensam" por padrão. Em tarefas sem raciocínio
  // (material em lote, resumos) pedimos nível baixo — bem mais rápido.
  let thinkingLevel: string | null =
    opts.tier !== "smart"
      ? null
      : opts.thinking && cfg.thinking
        ? cfg.thinkingLevel
        : "low";
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-goog-api-key": cfg.apiKey,
        },
        body: JSON.stringify(buildGeminiBody(messages, opts, { thinkingLevel })),
        signal: controller.signal,
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as GeminiResponse;

      if (!res.ok) {
        const msg = data.error?.message ?? `Gemini HTTP ${res.status}`;
        // Modelo smart inexistente → cai para o modelo fast (não quebra o app).
        if ((res.status === 404 || /not found|NOT_FOUND/i.test(msg)) && model !== cfg.model) {
          console.warn(`[gemini] modelo ${model} indisponível — usando ${cfg.model}`);
          model = cfg.model;
          thinkingLevel = null;
          attempt--;
          continue;
        }
        if (res.status === 404 || /not found|NOT_FOUND/i.test(msg)) {
          throw new OllamaError(
            "model_missing",
            `Modelo “${model}” indisponível no Gemini. Confira GEMINI_MODEL.`,
            404,
          );
        }
        // Modelo não aceita thinkingConfig → reenvia sem.
        if (res.status === 400 && thinkingLevel && /thinking/i.test(msg)) {
          thinkingLevel = null;
          attempt--;
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          throw new OllamaError("rejected", "Chave Gemini inválida ou sem permissão.", res.status);
        }
        if (RETRY_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          lastErr = new OllamaError("offline", msg, 503);
          // 429 = limite por minuto: espera mais (respeita "retry in Xs" se vier).
          const hinted = /retry in ([\d.]+)s/i.exec(msg)?.[1];
          const wait =
            res.status === 429
              ? Math.min(20_000, hinted ? Number(hinted) * 1000 : 2_500 * attempt)
              : 800 * 2 ** (attempt - 1);
          await sleep(wait + Math.random() * 300);
          continue;
        }
        throw new OllamaError(
          res.status === 429 ? "timeout" : "offline",
          res.status === 429 ? "Limite de uso do Gemini atingido. Tente em instantes." : msg,
          res.status >= 500 ? 502 : res.status,
        );
      }

      if (data.promptFeedback?.blockReason) {
        throw new OllamaError(
          "rejected",
          `O Gemini bloqueou a solicitação (${data.promptFeedback.blockReason}).`,
          422,
        );
      }

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        if (attempt < MAX_ATTEMPTS) {
          lastErr = new OllamaError("empty", "O Gemini devolveu resposta vazia.", 502);
          continue;
        }
        throw new OllamaError("empty", "O Gemini devolveu resposta vazia.", 502);
      }
      return { text, model, mocked: false };
    } catch (e) {
      if (e instanceof OllamaError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new OllamaError("timeout", "Tempo esgotado ao esperar o Gemini. Tente de novo.", 504);
      }
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(800 * 2 ** (attempt - 1));
        continue;
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
  throw lastErr instanceof OllamaError
    ? lastErr
    : new OllamaError("offline", "Falha ao falar com o Gemini.", 503);
}

/** Embeddings (RAG da lei seca). Retorna um vetor por texto. */
export async function geminiEmbed(
  texts: string[],
  opts?: { fetchImpl?: FetchImpl; taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" },
): Promise<number[][]> {
  const cfg = getGeminiConfig();
  if (!cfg.apiKey) throw new OllamaError("offline", "GEMINI_API_KEY ausente.", 503);
  const model = process.env["GEMINI_EMBED_MODEL"]?.trim() || "gemini-embedding-001";
  const dims = Number(process.env["GEMINI_EMBED_DIMS"] ?? 768);
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(model)}:batchEmbedContents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${model}`,
        content: { parts: [{ text: t }] },
        taskType: opts?.taskType ?? "RETRIEVAL_DOCUMENT",
        outputDimensionality: dims,
      })),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    embeddings?: { values?: number[] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new OllamaError("offline", data.error?.message ?? `Embedding HTTP ${res.status}`, 502);
  }
  return (data.embeddings ?? []).map((e) => e.values ?? []);
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
  const label = `${cfg.model} (rápido) · ${cfg.modelSmart} (professor)`;
  if (cfg.useMock) {
    return {
      available: true,
      modelReady: true,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: label,
      useMock: true,
      message: "Modo mock explícito (GEMINI_USE_MOCK). Respostas não vêm do modelo real.",
    };
  }
  if (!cfg.apiKey) {
    return {
      available: false,
      modelReady: false,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: label,
      useMock: false,
      message: "GEMINI_API_KEY ausente no .env.",
    };
  }
  return {
    available: true,
    modelReady: true,
    baseUrl: "https://generativelanguage.googleapis.com",
    model: label,
    useMock: false,
    message: `Gemini ok · ${label}`,
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
