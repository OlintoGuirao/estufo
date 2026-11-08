/**
 * Sincronização dos mapas mentais entre aparelhos.
 *
 * Antes: o app GRAVAVA no banco (study_mind_packs), mas a tela só LIA do
 * armazenamento do próprio aparelho — o que você fazia no celular nunca
 * aparecia no computador. Agora o banco é lido e mesclado (vence o mais novo).
 */
import type { MindMap } from "@/types";
import { studyMindPackDb } from "./study-mind-pack-db";

const SEEN_KEY = "estufoo.mind-packs.seen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Iterable<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

const time = (m: MindMap | undefined) => (m?.updatedAt ? new Date(m.updatedAt).getTime() : 0);

/**
 * Mescla local × banco. Regras:
 * - existe nos dois → fica o de updatedAt mais novo;
 * - só no banco → entra no aparelho;
 * - só no aparelho e JÁ esteve no banco antes → foi apagado em outro aparelho, sai;
 * - só no aparelho e nunca subiu → fica (e será enviado).
 */
export function mergeMindMaps(
  local: MindMap[],
  remote: MindMap[],
  seenBefore: Set<string>,
): { merged: MindMap[]; toUpload: MindMap[]; changed: boolean } {
  const remoteById = new Map(remote.map((m) => [m.id, m]));
  const merged: MindMap[] = [];
  const toUpload: MindMap[] = [];
  let changed = false;
  const localIds = new Set<string>();

  for (const l of local) {
    localIds.add(l.id);
    const r = remoteById.get(l.id);
    if (!r) {
      if (seenBefore.has(l.id)) {
        changed = true; // apagado em outro aparelho
        continue;
      }
      merged.push(l);
      toUpload.push(l);
      continue;
    }
    if (time(r) > time(l)) {
      merged.push(r);
      changed = true;
    } else {
      merged.push(l);
      if (time(l) > time(r)) toUpload.push(l);
    }
  }
  for (const r of remote) {
    if (!localIds.has(r.id)) {
      merged.push(r);
      changed = true;
    }
  }
  merged.sort((a, b) => time(b) - time(a));
  return { merged, toUpload, changed };
}

let lastPull = 0;
let pulling: Promise<boolean> | null = null;

/**
 * Busca os mapas no banco e mescla em `db.mindMaps`.
 * Throttle de 20 s (abrir/voltar à tela não refaz a consulta toda hora).
 * Retorna true se algo mudou no aparelho.
 */
export function pullMindMaps(
  db: { mindMaps: MindMap[] },
  opts?: { force?: boolean },
): Promise<boolean> {
  if (!studyMindPackDb.enabled() || typeof window === "undefined") return Promise.resolve(false);
  if (pulling) return pulling;
  if (!opts?.force && Date.now() - lastPull < 20_000) return Promise.resolve(false);
  pulling = (async () => {
    try {
      // 1) Só datas (leve). 2) Baixa o material apenas do que mudou.
      const meta = await studyMindPackDb.listMeta();
      const localById = new Map((db.mindMaps ?? []).map((m) => [m.id, m]));
      const need = meta
        .filter((r) => {
          const l = localById.get(r.id);
          return !l || new Date(r.updatedAt).getTime() > time(l) + 1000;
        })
        .map((r) => r.id);
      const fetched = new Map((await studyMindPackDb.getMany(need)).map((m) => [m.id, m]));
      const remote: MindMap[] = [];
      for (const r of meta) {
        const m = fetched.get(r.id) ?? localById.get(r.id);
        if (m) remote.push(m);
      }
      const seen = readSeen();
      const { merged, toUpload, changed } = mergeMindMaps(db.mindMaps ?? [], remote, seen);
      db.mindMaps = merged;
      writeSeen(new Set([...remote.map((m) => m.id), ...toUpload.map((m) => m.id)]));
      for (const m of toUpload) pushMindMap(m);
      lastPull = Date.now();
      return changed;
    } catch (err) {
      console.warn("[mind-maps] falha ao buscar do banco", err);
      return false;
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Envia um mapa ao banco (agrupa edições seguidas do mesmo mapa em 1,5 s). */
export function pushMindMap(map: MindMap): void {
  if (!studyMindPackDb.enabled()) return;
  const prev = pushTimers.get(map.id);
  if (prev) clearTimeout(prev);
  pushTimers.set(
    map.id,
    setTimeout(() => {
      pushTimers.delete(map.id);
      void studyMindPackDb
        .upsert(map)
        .then(() => {
          const seen = readSeen();
          seen.add(map.id);
          writeSeen(seen);
        })
        .catch((err) => console.warn("[mind-maps] falha ao salvar no banco", err));
    }, 1_500),
  );
}

export function deleteMindMapRemote(id: string): void {
  if (!studyMindPackDb.enabled()) return;
  const t = pushTimers.get(id);
  if (t) clearTimeout(t);
  pushTimers.delete(id);
  void studyMindPackDb.remove(id).catch((err) => console.warn("[mind-maps] falha ao apagar", err));
  const seen = readSeen();
  seen.delete(id);
  writeSeen(seen);
}
