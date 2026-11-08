/**
 * Armazenamento chave-valor no IndexedDB (sem o limite de ~5 MB do localStorage).
 * As aulas da trilha são grandes; no localStorage a gravação estourava a cota
 * em silêncio, a aula sumia ao recarregar e o app gerava tudo de novo.
 */
import { currentScope } from "@/lib/scoped-storage";

const DB_NAME = "estufoo";

/** Cada conta tem suas próprias chaves (mesma regra do localStorage). */
function scoped(key: string, scope = currentScope()): string {
  return `@${scope}:${key}`;
}
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Falha no IndexedDB"));
      }),
  );
}

export const idbKv = {
  available(): boolean {
    return typeof indexedDB !== "undefined";
  },
  async get<T>(key: string): Promise<T | undefined> {
    const k = scoped(key);
    const hit = await tx<T | undefined>("readonly", (s) => s.get(k) as IDBRequest<T | undefined>);
    if (hit !== undefined) return hit;
    // Migração: chave antiga sem conta → gaveta da conta atual.
    const legacy = await tx<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
    if (legacy !== undefined) {
      await tx("readwrite", (s) => s.put(legacy, k));
      await tx("readwrite", (s) => s.delete(key));
    }
    return legacy;
  },
  set(key: string, value: unknown): Promise<void> {
    return tx("readwrite", (s) => s.put(value, scoped(key))).then(() => undefined);
  },
  del(key: string): Promise<void> {
    return tx("readwrite", (s) => s.delete(scoped(key))).then(() => undefined);
  },
  /** Apaga as chaves de uma conta específica. */
  delForScope(scope: string, keys: string[]): Promise<void> {
    return Promise.all(
      keys.map((k) => tx("readwrite", (s) => s.delete(scoped(k, scope))).catch(() => undefined)),
    ).then(() => undefined);
  },
};
