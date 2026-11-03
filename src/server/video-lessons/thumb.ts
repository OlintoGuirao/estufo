import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getBunnyVideoConfig } from "./config";
import {
  bunnyStorageFileUrl,
  bunnyStorageGetBytes,
  bunnyStoragePutBytes,
  joinStoragePath,
  resolveBunnySubjectName,
} from "./bunny";
import { resolveLessonFilePath } from "./catalog";

/** Vercel/Lambda: só /tmp é gravável. */
const IS_SERVERLESS = Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]);
const THUMB_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), "estufoo-video-thumbs")
  : path.resolve(process.cwd(), ".data", "video-thumbs");

/** Fila: 1 ffmpeg por vez (Bunny + CPU). */
let queue: Promise<void> = Promise.resolve();
const inflight = new Map<string, Promise<string>>();
const warmingSubjects = new Set<string>();

function safeThumbName(subjectId: string, fileName: string): string {
  const base = `${subjectId}__${fileName}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);
  return `${base}.jpg`;
}

function thumbPathFor(subjectId: string, fileName: string): string {
  return path.join(THUMB_DIR, safeThumbName(subjectId, fileName));
}

function bunnyThumbRelative(subjectId: string, fileName: string): string {
  const cfg = getBunnyVideoConfig();
  const name = safeThumbName(subjectId, fileName);
  return joinStoragePath(cfg?.prefix ?? "", ".thumbs", subjectId, name);
}

export function hasCachedThumb(subjectId: string, fileName: string): boolean {
  const outFile = thumbPathFor(subjectId, fileName);
  try {
    return fs.existsSync(outFile) && fs.statSync(outFile).size > 500;
  } catch {
    return false;
  }
}

async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpegPath = (await import("ffmpeg-static")).default;
  if (!ffmpegPath) throw new Error("ffmpeg-static não encontrado.");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let err = "";
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-800) || `ffmpeg exit ${code}`));
    });
  });
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureThumbFromBunny(subjectId: string, fileName: string, outFile: string): Promise<void> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) throw new Error("Bunny não configurada.");
  const subjectName = await resolveBunnySubjectName(subjectId);
  if (!subjectName) throw new Error("Matéria não encontrada.");
  const safeName = path.basename(fileName);
  const relative = joinStoragePath(cfg.prefix, subjectName, safeName);
  const inputUrl = bunnyStorageFileUrl(cfg, relative);
  const tmp = `${outFile}.tmp.jpg`;
  await runFfmpeg([
    "-y",
    "-headers",
    `AccessKey: ${cfg.accessKey}\r\n`,
    "-ss",
    "5",
    "-i",
    inputUrl,
    "-frames:v",
    "1",
    "-q:v",
    "6",
    "-vf",
    "scale=320:-2",
    tmp,
  ]);
  fs.renameSync(tmp, outFile);
}

async function ensureThumbFromLocal(subjectId: string, fileName: string, outFile: string): Promise<void> {
  const filePath = resolveLessonFilePath(subjectId, fileName);
  const tmp = `${outFile}.tmp.jpg`;
  await runFfmpeg([
    "-y",
    "-ss",
    "5",
    "-i",
    filePath,
    "-frames:v",
    "1",
    "-q:v",
    "6",
    "-vf",
    "scale=320:-2",
    tmp,
  ]);
  fs.renameSync(tmp, outFile);
}

async function uploadThumbToBunny(subjectId: string, fileName: string, filePath: string): Promise<void> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return;
  try {
    const buf = new Uint8Array(fs.readFileSync(filePath));
    const ok = await bunnyStoragePutBytes(
      cfg,
      bunnyThumbRelative(subjectId, fileName),
      buf,
      "image/jpeg",
    );
    if (!ok) console.warn("[video-thumb] upload Bunny falhou", subjectId, fileName);
  } catch (err) {
    console.warn("[video-thumb] upload Bunny erro", err);
  }
}

async function loadThumbFromBunny(subjectId: string, fileName: string): Promise<Uint8Array | null> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return null;
  return bunnyStorageGetBytes(cfg, bunnyThumbRelative(subjectId, fileName));
}

/** Gera (ou reutiliza) JPEG de preview da aula. */
export async function ensureLessonThumb(subjectId: string, fileName: string): Promise<string> {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const outFile = thumbPathFor(subjectId, fileName);
  if (hasCachedThumb(subjectId, fileName)) return outFile;

  const key = `${subjectId}::${fileName}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = enqueue(async () => {
    if (hasCachedThumb(subjectId, fileName)) return outFile;

    // Cache remoto (persistente entre deploys / cold starts).
    const remote = await loadThumbFromBunny(subjectId, fileName);
    if (remote && remote.byteLength > 500) {
      fs.writeFileSync(outFile, remote);
      return outFile;
    }

    // No serverless, ffmpeg costuma estourar tempo/binário — não tenta.
    if (IS_SERVERLESS) {
      throw new Error("Thumb ainda não gerada (serverless sem ffmpeg).");
    }

    if (getBunnyVideoConfig()) {
      await ensureThumbFromBunny(subjectId, fileName, outFile);
    } else {
      await ensureThumbFromLocal(subjectId, fileName, outFile);
    }
    await uploadThumbToBunny(subjectId, fileName, outFile);
    return outFile;
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

/** Pré-gera thumbs de todas as aulas da matéria em background (1 a 1). */
export function warmSubjectThumbs(
  subjectId: string,
  files: string[],
): void {
  if (IS_SERVERLESS) return;
  if (warmingSubjects.has(subjectId)) return;
  warmingSubjects.add(subjectId);
  void (async () => {
    for (const fileName of files) {
      try {
        if (!hasCachedThumb(subjectId, fileName)) {
          await ensureLessonThumb(subjectId, fileName);
        } else {
          await uploadThumbToBunny(subjectId, fileName, thumbPathFor(subjectId, fileName));
        }
      } catch (err) {
        console.warn("[video-thumb] warm falhou", subjectId, fileName, err);
      }
    }
    warmingSubjects.delete(subjectId);
  })();
}

function placeholderSvg(subject: string, file: string): string {
  const orderMatch = /^(\d+)/.exec(file);
  const label = orderMatch?.[1]?.padStart(2, "0") ?? "•";
  const title = file
    .replace(/\.mp4$/i, "")
    .replace(/^\d+\s*[-–.]?\s*/u, "")
    .slice(0, 42);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#g)"/>
  <text x="24" y="56" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="28" font-weight="700">${esc(label)}</text>
  <text x="24" y="100" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="13">${esc(title)}</text>
  <text x="24" y="152" fill="#64748b" font-family="system-ui,sans-serif" font-size="11">${esc(subject)}</text>
</svg>`;
}

function jpegResponse(buf: Uint8Array | Buffer): Response {
  const body = buf instanceof Buffer ? buf : Buffer.from(buf);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800",
      "Content-Length": String(body.length),
    },
  });
}

export async function handleVideoLessonThumb(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject")?.trim() ?? "";
  const file = url.searchParams.get("file")?.trim() ?? "";
  if (!subject || !file) {
    return new Response("Parâmetros subject e file são obrigatórios.", { status: 400 });
  }

  // Disco local (dev /tmp após gerar).
  if (hasCachedThumb(subject, file)) {
    return jpegResponse(fs.readFileSync(thumbPathFor(subject, file)));
  }

  // Cache na Bunny Storage (funciona no Vercel).
  try {
    const remote = await loadThumbFromBunny(subject, file);
    if (remote && remote.byteLength > 500) {
      try {
        fs.mkdirSync(THUMB_DIR, { recursive: true });
        fs.writeFileSync(thumbPathFor(subject, file), remote);
      } catch {
        /* ignore cache local */
      }
      return jpegResponse(remote);
    }
  } catch (err) {
    console.warn("[video-thumb] leitura Bunny", err);
  }

  // Gera com ffmpeg (só fora do serverless) e sobe pra Bunny.
  if (!IS_SERVERLESS) {
    try {
      const thumbPath = await ensureLessonThumb(subject, file);
      return jpegResponse(fs.readFileSync(thumbPath));
    } catch (err) {
      console.warn("[video-thumb]", err);
    }
  }

  // Sempre 200: evita chuva de 404 + retries no browser.
  const svg = placeholderSvg(subject, file);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
