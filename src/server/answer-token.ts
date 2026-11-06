/**
 * Token da questão de treino: o gabarito vai CIFRADO (AES-256-GCM).
 * Antes era só base64 do JSON — qualquer aluno decodificava e via a resposta.
 * Defina ANSWER_TOKEN_SECRET no .env (qualquer texto longo e aleatório).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

let warned = false;

function key(): Buffer {
  const secret =
    process.env["ANSWER_TOKEN_SECRET"]?.trim() ||
    // Fallback estável entre instâncias; troque por ANSWER_TOKEN_SECRET em produção.
    `estufoo-fallback:${process.env["GEMINI_API_KEY"] ?? "dev"}`;
  if (!process.env["ANSWER_TOKEN_SECRET"] && !warned) {
    warned = true;
    console.warn(
      "[answer-token] ANSWER_TOKEN_SECRET ausente — usando chave derivada (defina no .env).",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function sealAnswer(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${Buffer.concat([iv, tag, data]).toString("base64url")}`;
}

export function openAnswer<T = unknown>(token: string): T {
  if (!token.startsWith("v2.")) throw new Error("Token inválido.");
  const raw = Buffer.from(token.slice(3), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(json) as T;
}
