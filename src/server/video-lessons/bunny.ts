import crypto from "node:crypto";
import { getBunnyVideoConfig, type BunnyVideoConfig } from "./config";

export type BunnyListItem = {
  ObjectName: string;
  IsDirectory: boolean;
  Length?: number;
  Path?: string;
};

type CacheEntry = { at: number; items: BunnyListItem[] };
const listCache = new Map<string, CacheEntry>();
const CACHE_MS = 60_000;

export function joinStoragePath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

/** Codifica cada segmento do path (espaços, acentos) mantendo `/`. */
export function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** Token Basic (MD5) da Bunny Pull Zone. path = caminho URL-decoded com `/` inicial. */
export function signBunnyCdnUrl(
  cfg: BunnyVideoConfig,
  relativePath: string,
  ttlSec = 60 * 60 * 6,
): string {
  const encoded = encodeStoragePath(relativePath);
  const rawPath = `/${relativePath.split("/").filter(Boolean).join("/")}`;
  if (!cfg.tokenKey) {
    return `${cfg.cdnBaseUrl}/${encoded}`;
  }
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const hashable = `${cfg.tokenKey}${rawPath}${expires}`;
  const token = crypto
    .createHash("md5")
    .update(hashable)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${cfg.cdnBaseUrl}/${encoded}?token=${token}&expires=${expires}`;
}

export function bunnyCdnUrl(cfg: BunnyVideoConfig, relativePath: string): string {
  return signBunnyCdnUrl(cfg, relativePath);
}

/** URL da Storage API (requer header AccessKey) — usada no proxy do app. */
export function bunnyStorageFileUrl(cfg: BunnyVideoConfig, relativePath: string): string {
  const encoded = encodeStoragePath(relativePath);
  return `https://${cfg.storageHost}/${encodeURIComponent(cfg.storageZone)}/${encoded}`;
}

async function listBunnyPath(cfg: BunnyVideoConfig, relativeDir: string): Promise<BunnyListItem[]> {
  const full = joinStoragePath(cfg.prefix, relativeDir);
  const cacheKey = `${cfg.storageZone}:${full}`;
  const hit = listCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;

  const pathPart = full ? `${encodeStoragePath(full)}/` : "";
  const url = `https://${cfg.storageHost}/${encodeURIComponent(cfg.storageZone)}/${pathPart}`;
  const res = await fetch(url, {
    headers: {
      AccessKey: cfg.accessKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny Storage ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  const items = (await res.json()) as BunnyListItem[];
  const list = Array.isArray(items) ? items : [];
  listCache.set(cacheKey, { at: Date.now(), items: list });
  return list;
}

export async function listBunnySubjects(): Promise<
  Array<{ id: string; name: string; lessonCount: number }>
> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return [];
  const root = await listBunnyPath(cfg, "");
  const dirs = root.filter((x) => x.IsDirectory && x.ObjectName);
  const out: Array<{ id: string; name: string; lessonCount: number }> = [];
  for (const d of dirs) {
    const name = d.ObjectName.replace(/\/$/, "");
    const files = await listBunnyPath(cfg, name);
    const lessonCount = files.filter((f) => !f.IsDirectory && /\.mp4$/i.test(f.ObjectName)).length;
    if (!lessonCount) continue;
    out.push({
      id: slugify(name),
      name,
      lessonCount,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function listBunnyLessons(subjectId: string): Promise<
  Array<{
    id: string;
    subjectId: string;
    subjectName: string;
    title: string;
    fileName: string;
    order: number;
    streamPath: string;
  }>
> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return [];
  const root = await listBunnyPath(cfg, "");
  const dir = root.find(
    (x) => x.IsDirectory && slugify(x.ObjectName.replace(/\/$/, "")) === subjectId,
  );
  if (!dir) return [];
  const subjectName = dir.ObjectName.replace(/\/$/, "");
  const files = (await listBunnyPath(cfg, subjectName))
    .filter((f) => !f.IsDirectory && /\.mp4$/i.test(f.ObjectName))
    .map((f) => f.ObjectName)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  return files.map((fileName, index) => {
    const order = index + 1;
    // Sempre proxy pelo app na Storage (AccessKey). Evita 401 da Pull Zone,
    // CORS e URLs erradas tipo storage.bunnycdn.com no browser.
    const qs = new URLSearchParams({
      provider: "bunny",
      subject: subjectId,
      file: fileName,
    }).toString();
    return {
      id: `${subjectId}__${String(order).padStart(3, "0")}`,
      subjectId,
      subjectName,
      title: cleanTitle(fileName),
      fileName,
      order,
      streamPath: `/api/video-lessons/stream?${qs}`,
      thumbPath: `/api/video-lessons/thumb?${qs}`,
    };
  });
}

/** Resolve subjectId slug → nome da pasta na Storage. */
export async function resolveBunnySubjectName(subjectId: string): Promise<string | null> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return null;
  const root = await listBunnyPath(cfg, "");
  const dir = root.find(
    (x) => x.IsDirectory && slugify(x.ObjectName.replace(/\/$/, "")) === subjectId,
  );
  return dir ? dir.ObjectName.replace(/\/$/, "") : null;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanTitle(fileName: string): string {
  const base = fileName.replace(/\.mp4$/i, "");
  return base
    .replace(/^\d+\s*[-–.]?\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
