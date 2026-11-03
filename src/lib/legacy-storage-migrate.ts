/**
 * Recupera dados do rename AprovaMind → Estufoo.
 * - Copia chaves `aprovamind.*` → `estufoo.*` quando a nova ainda não existe
 * - Mescla usuários do mock antigo mesmo se `estufoo.mockdb` já existir
 */
const FLAG = "estufoo.migrated-from-aprovamind.v2";

function mergeMockUsers(oldRaw: string | null, nextRaw: string | null): string | null {
  if (!oldRaw) return nextRaw;
  try {
    const oldDb = JSON.parse(oldRaw) as { users?: Array<{ email?: string }> };
    const oldUsers = Array.isArray(oldDb.users) ? oldDb.users : [];
    if (!oldUsers.length) return nextRaw;

    if (!nextRaw) {
      return JSON.stringify(oldDb);
    }

    const nextDb = JSON.parse(nextRaw) as { users?: Array<{ email?: string }> };
    if (!nextDb || typeof nextDb !== "object") return JSON.stringify(oldDb);
    if (!Array.isArray(nextDb.users)) nextDb.users = [];

    const emails = new Set(
      nextDb.users.map((u) => String(u.email ?? "").toLowerCase()).filter(Boolean),
    );
    let added = 0;
    for (const u of oldUsers) {
      const email = String(u.email ?? "").toLowerCase();
      if (!email || emails.has(email)) continue;
      nextDb.users.push(u);
      emails.add(email);
      added += 1;
    }
    return added > 0 ? JSON.stringify(nextDb) : nextRaw;
  } catch {
    return nextRaw ?? oldRaw;
  }
}

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const already = localStorage.getItem(FLAG);

    // Sempre tenta mesclar contas do mock antigo (idempotente).
    const oldMock = localStorage.getItem("aprovamind.mockdb");
    const nextMock = localStorage.getItem("estufoo.mockdb");
    const merged = mergeMockUsers(oldMock, nextMock);
    if (merged && merged !== nextMock) {
      localStorage.setItem("estufoo.mockdb", merged);
    }

    if (already) return;

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("aprovamind.")) keys.push(k);
    }
    for (const oldKey of keys) {
      const nextKey = `estufoo.${oldKey.slice("aprovamind.".length)}`;
      if (oldKey === "aprovamind.mockdb") continue; // já tratado acima
      if (localStorage.getItem(nextKey) == null) {
        const val = localStorage.getItem(oldKey);
        if (val != null) localStorage.setItem(nextKey, val);
      }
    }

    // Token de sessão antiga
    if (!localStorage.getItem("estufoo.token") && !sessionStorage.getItem("estufoo.token")) {
      const tok =
        localStorage.getItem("aprovamind.token") ?? sessionStorage.getItem("aprovamind.token");
      if (tok) localStorage.setItem("estufoo.token", tok);
    }

    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
}
