/**
 * ISOLAMENTO POR CONTA NO APARELHO.
 *
 * Toda chave de estudo "estufoo.X" gravada no localStorage passa a ser salva
 * como "estufoo.@<conta>.X". Cada conta lê só a própria "gaveta": mesmo que a
 * limpeza ao trocar de conta falhe, os dados de uma conta nunca aparecem na
 * outra. Sem login, a gaveta é "anon".
 *
 * É instalado uma vez, antes de qualquer tela carregar (ver src/router.tsx),
 * e vale para todos os módulos sem precisar mudar cada um.
 */

const OWNER_KEY = "estufoo.local-owner";
const SCOPE_MARK = "estufoo.@";

/** Chaves que são do APARELHO/sessão, não de uma conta. */
const GLOBAL_EXACT = new Set([
  OWNER_KEY,
  "estufoo.token",
  "estufoo.cloud-user",
  "estufoo.device-id",
  "estufoo.auth.remember",
  "estufoo.migrated-from-aprovamind.v2",
  "estufoo.storage-scoped.v1",
]);
const GLOBAL_PREFIX = ["estufoo.study-claimed.", SCOPE_MARK];

function isGlobal(key: string): boolean {
  if (!key.startsWith("estufoo.")) return true;
  if (GLOBAL_EXACT.has(key)) return true;
  return GLOBAL_PREFIX.some((p) => key.startsWith(p));
}

let raw: {
  get: (k: string) => string | null;
  set: (k: string, v: string) => void;
  remove: (k: string) => void;
} | null = null;

/** Conta dona da gaveta atual ("anon" sem login). */
export function currentScope(): string {
  try {
    return (raw ? raw.get(OWNER_KEY) : localStorage.getItem(OWNER_KEY)) || "anon";
  } catch {
    return "anon";
  }
}

export function scopedKey(key: string, scope = currentScope()): string {
  return isGlobal(key) ? key : `${SCOPE_MARK}${scope}.${key.slice("estufoo.".length)}`;
}

/** Move as chaves de uma gaveta para outra (ex.: dados sem login → 1ª conta). */
export function moveScope(from: string, to: string): void {
  if (!raw || from === to) return;
  const prefix = `${SCOPE_MARK}${from}.`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  for (const k of keys) {
    const v = raw.get(k);
    const dest = `${SCOPE_MARK}${to}.${k.slice(prefix.length)}`;
    if (v != null && raw.get(dest) == null) raw.set(dest, v);
    raw.remove(k);
  }
}

/** Apaga a gaveta inteira de uma conta neste aparelho. */
export function clearScope(scope: string): void {
  if (!raw) return;
  const prefix = `${SCOPE_MARK}${scope}.`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  for (const k of keys) raw.remove(k);
}

export function installScopedStorage(): void {
  if (typeof window === "undefined" || raw) return;
  let ls: Storage;
  try {
    ls = window.localStorage;
  } catch {
    return;
  }
  const proto = Object.getPrototypeOf(ls) as Storage & {
    __estufooOrig?: { get: Storage["getItem"]; set: Storage["setItem"]; remove: Storage["removeItem"] };
  };
  // Já instalado (ex.: módulo recarregado em testes/HMR): reaproveita os originais.
  const already = proto.__estufooOrig;
  const origGet = already?.get ?? proto.getItem;
  const origSet = already?.set ?? proto.setItem;
  const origRemove = already?.remove ?? proto.removeItem;
  proto.__estufooOrig = { get: origGet, set: origSet, remove: origRemove };
  raw = {
    get: (k) => origGet.call(ls, k),
    set: (k, v) => origSet.call(ls, k, v),
    remove: (k) => origRemove.call(ls, k),
  };

  // Migração única: chaves antigas sem gaveta vão para a gaveta do dono atual.
  if (!raw.get("estufoo.storage-scoped.v1")) {
    const scope = currentScope();
    const legacy: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && !isGlobal(k)) legacy.push(k);
    }
    for (const k of legacy) {
      const v = raw.get(k);
      if (v != null) raw.set(scopedKey(k, scope), v);
      raw.remove(k);
    }
    raw.set("estufoo.storage-scoped.v1", "1");
  }

  if (already) return;

  // Só o localStorage é afetado (sessionStorage segue normal).
  proto.getItem = function (this: Storage, key: string) {
    return origGet.call(this, this === ls ? scopedKey(String(key)) : key);
  };
  proto.setItem = function (this: Storage, key: string, value: string) {
    return origSet.call(this, this === ls ? scopedKey(String(key)) : key, value);
  };
  proto.removeItem = function (this: Storage, key: string) {
    return origRemove.call(this, this === ls ? scopedKey(String(key)) : key);
  };
}

installScopedStorage();
