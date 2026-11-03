import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getBunnyVideoConfig } from "./config";
import {
  bunnyStorageFileUrl,
  joinStoragePath,
  resolveBunnySubjectName,
} from "./bunny";
import { resolveLessonFilePath } from "./catalog";

const THUMB_DIR = path.resolve(process.cwd(), ".data", "video-thumbs");

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
    if (getBunnyVideoConfig()) {
      await ensureThumbFromBunny(subjectId, fileName, outFile);
    } else {
      await ensureThumbFromLocal(subjectId, fileName, outFile);
    }
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
  if (warmingSubjects.has(subjectId)) return;
  warmingSubjects.add(subjectId);
  void (async () => {
    for (const fileName of files) {
      try {
        if (!hasCachedThumb(subjectId, fileName)) {
          await ensureLessonThumb(subjectId, fileName);
        }
      } catch (err) {
        console.warn("[video-thumb] warm falhou", subjectId, fileName, err);
      }
    }
    warmingSubjects.delete(subjectId);
  })();
}

export async function handleVideoLessonThumb(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject")?.trim() ?? "";
  const file = url.searchParams.get("file")?.trim() ?? "";
  if (!subject || !file) {
    return new Response("Parâmetros subject e file são obrigatórios.", { status: 400 });
  }

  // Se já existe, responde na hora.
  if (hasCachedThumb(subject, file)) {
    const buf = fs.readFileSync(thumbPathFor(subject, file));
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800",
        "Content-Length": String(buf.length),
      },
    });
  }

  // Ainda não existe: gera (fila) — pode demorar na 1ª vez.
  try {
    const thumbPath = await ensureLessonThumb(subject, file);
    const buf = fs.readFileSync(thumbPath);
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800",
        "Content-Length": String(buf.length),
      },
    });
  } catch (err) {
    console.warn("[video-thumb]", err);
    // 404 (não 200 placeholder) para o <img> poder retentar / mostrar número.
    return new Response("Thumb indisponível", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
