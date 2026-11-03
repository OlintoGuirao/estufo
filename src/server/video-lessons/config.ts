import path from "node:path";

/** Pasta raiz das videoaulas (local). Usada só se Bunny não estiver configurada. */
export function getVideoLessonsRoot(): string {
  const fromEnv = (process.env["VIDEO_LESSONS_ROOT"] ?? "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve("D:\\Videos\\Dailymotion");
}

export type BunnyVideoConfig = {
  storageZone: string;
  /** AccessKey da Storage Zone (FTP password). */
  accessKey: string;
  /** Host da API Storage, ex.: storage.bunnycdn.com ou storage.ny.bunnycdn.com */
  storageHost: string;
  /** URL pública do Pull Zone, ex.: https://estufoo.b-cdn.net */
  cdnBaseUrl: string;
  /** Prefixo opcional dentro da zone (ex.: video-aulas). */
  prefix: string;
  /**
   * URL Token Authentication Key da Pull Zone (Security).
   * Se definido, o app gera links assinados no CDN.
   * Se vazio, o player usa proxy autenticado pela Storage API.
   */
  tokenKey: string | null;
};

export function getBunnyVideoConfig(): BunnyVideoConfig | null {
  const storageZone = (process.env["BUNNY_STORAGE_ZONE"] ?? "").trim();
  const accessKey = (process.env["BUNNY_STORAGE_ACCESS_KEY"] ?? "").trim();
  let cdnBaseUrl = (process.env["BUNNY_CDN_BASE_URL"] ?? "").trim().replace(/\/$/, "");
  if (!storageZone || !accessKey || !cdnBaseUrl) return null;
  // Erro comum: colar a URL da Storage API no lugar da Pull Zone.
  if (/storage\.bunnycdn\.com/i.test(cdnBaseUrl)) {
    console.warn(
      "[video-lessons] BUNNY_CDN_BASE_URL aponta para storage.bunnycdn.com — use a Pull Zone (*.b-cdn.net). Ignorando CDN e usando proxy.",
    );
    cdnBaseUrl = "";
  }
  const tokenKey = (process.env["BUNNY_CDN_TOKEN_KEY"] ?? "").trim() || null;
  return {
    storageZone,
    accessKey,
    storageHost: (process.env["BUNNY_STORAGE_HOST"] ?? "storage.bunnycdn.com").trim().replace(/\/$/, ""),
    // Se CDN inválida, mantém placeholder só para isBunnyConfigured; playback usa proxy.
    cdnBaseUrl: cdnBaseUrl || "https://invalid.b-cdn.net",
    prefix: (process.env["BUNNY_STORAGE_PREFIX"] ?? "").trim().replace(/^\/+|\/+$/g, ""),
    // Sem CDN válida, não assina links (força proxy).
    tokenKey: cdnBaseUrl ? tokenKey : null,
  };
}

export function isBunnyVideoConfigured(): boolean {
  return getBunnyVideoConfig() !== null;
}
