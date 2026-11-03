/**
 * Garante vars de servidor (GEMINI_*, QUESTIONS_*, …) em process.env.
 * Vite/TanStack às vezes só injetam VITE_* — lemos o .env da raiz se faltar.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let loaded = false;

export function ensureServerEnv(): void {
  if (loaded || typeof process === "undefined") return;
  loaded = true;

  // Já tem chave? Nada a fazer.
  if (process.env["GEMINI_API_KEY"]?.trim()) return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const text = readFileSync(envPath, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* ignore */
    }
  }
}
