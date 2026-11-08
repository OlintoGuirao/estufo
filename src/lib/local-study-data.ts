/**
 * Dados de estudo guardados NO APARELHO pertencem a UMA conta.
 *
 * Duas camadas de proteção:
 * 1) Gavetas por conta (src/lib/scoped-storage.ts): cada conta grava e lê só
 *    "estufoo.@<conta>.*" — uma conta não enxerga a outra nem por engano.
 * 2) Limpeza: ao trocar de conta ou sair, a gaveta anterior é apagada do
 *    aparelho (os dados continuam seguros no banco e voltam no próximo login).
 */
import { idbKv } from "@/lib/idb-kv";
import { clearScope, moveScope } from "@/lib/scoped-storage";

const OWNER_KEY = "estufoo.local-owner";
const IDB_KEYS = ["trail-week-lessons.v3", "trail-week-lessons.meta", "approval-trail.v1"];

export function getLocalDataOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setLocalDataOwner(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
}

async function resetInMemoryMock(): Promise<void> {
  try {
    const { resetMockStudyData } = await import("@/services/mock/handlers");
    resetMockStudyData();
  } catch {
    /* módulo não carregado — ok */
  }
}

async function clearAccountFromDevice(scope: string): Promise<void> {
  clearScope(scope);
  if (idbKv.available()) await idbKv.delForScope(scope, IDB_KEYS).catch(() => undefined);
}

/** Apaga do aparelho os dados de estudo da conta atual e os sem login. */
export async function wipeLocalStudyData(): Promise<void> {
  if (typeof window === "undefined") return;
  const owner = getLocalDataOwner() ?? "anon";
  await resetInMemoryMock();
  await clearAccountFromDevice(owner);
  await clearAccountFromDevice("anon");
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

/**
 * Garante que o cache local é desta conta.
 * - `firstOwner`: aparelho sem dono → adota o que foi feito sem login.
 * - `switched`: era de OUTRA conta → a gaveta dela é apagada do aparelho.
 */
export async function ensureLocalDataBelongsTo(
  userId: string,
): Promise<{ switched: boolean; firstOwner: boolean }> {
  const prev = getLocalDataOwner();
  if (prev === userId) return { switched: false, firstOwner: false };
  if (prev && prev !== userId) {
    await resetInMemoryMock();
    await clearAccountFromDevice(prev);
    await clearAccountFromDevice("anon");
    setLocalDataOwner(userId);
    return { switched: true, firstOwner: false };
  }
  moveScope("anon", userId);
  setLocalDataOwner(userId);
  return { switched: false, firstOwner: true };
}
