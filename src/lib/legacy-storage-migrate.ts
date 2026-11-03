/** Copia chaves `aprovamind.*` → `estufoo.*` (uma vez) para não perder dados no rename. */
const FLAG = "estufoo.migrated-from-aprovamind.v1";

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(FLAG)) return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("aprovamind.")) keys.push(k);
    }
    for (const oldKey of keys) {
      const nextKey = `estufoo.${oldKey.slice("aprovamind.".length)}`;
      if (localStorage.getItem(nextKey) == null) {
        const val = localStorage.getItem(oldKey);
        if (val != null) localStorage.setItem(nextKey, val);
      }
    }
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
}
