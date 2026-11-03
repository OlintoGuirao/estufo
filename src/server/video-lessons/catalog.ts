import fs from "node:fs";
import path from "node:path";
import { getBunnyVideoConfig, getVideoLessonsRoot, isBunnyVideoConfigured } from "./config";
import { listBunnyLessons, listBunnySubjects } from "./bunny";

export type VideoSubject = {
  id: string;
  name: string;
  lessonCount: number;
};

export type VideoLesson = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  fileName: string;
  order: number;
  /** URL do CDN Bunny ou rota local `/api/video-lessons/stream?...`. */
  streamPath: string;
  /** Preview JPEG gerado sob demanda. */
  thumbPath?: string;
};

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

function assertUnderRoot(root: string, target: string): string {
  const resolved = path.resolve(target);
  const rootResolved = path.resolve(root);
  if (
    !resolved.toLowerCase().startsWith(rootResolved.toLowerCase() + path.sep) &&
    resolved.toLowerCase() !== rootResolved.toLowerCase()
  ) {
    throw new Error("Caminho de vídeo inválido.");
  }
  return resolved;
}

function listLocalSubjects(): VideoSubject[] {
  const root = getVideoLessonsRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(root, d.name);
      const lessonCount = fs.readdirSync(dir).filter((f) => /\.mp4$/i.test(f)).length;
      return { id: slugify(d.name), name: d.name, lessonCount };
    })
    .filter((s) => s.lessonCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function resolveSubjectDir(subjectId: string): { id: string; name: string; dir: string } | null {
  const root = getVideoLessonsRoot();
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const id = slugify(d.name);
    if (id === subjectId) {
      return { id, name: d.name, dir: path.join(root, d.name) };
    }
  }
  return null;
}

function listLocalLessons(subjectId: string): VideoLesson[] {
  const subject = resolveSubjectDir(subjectId);
  if (!subject) return [];
  const files = fs
    .readdirSync(subject.dir)
    .filter((f) => /\.mp4$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  return files.map((fileName, index) => {
    const order = index + 1;
    const id = `${subject.id}__${String(order).padStart(3, "0")}`;
    const q = new URLSearchParams({
      subject: subject.id,
      file: fileName,
    });
    const qs = q.toString();
    return {
      id,
      subjectId: subject.id,
      subjectName: subject.name,
      title: cleanTitle(fileName),
      fileName,
      order,
      streamPath: `/api/video-lessons/stream?${qs}`,
      thumbPath: `/api/video-lessons/thumb?${qs}`,
    };
  });
}

export async function listVideoSubjects(): Promise<VideoSubject[]> {
  if (isBunnyVideoConfigured()) {
    try {
      return await listBunnySubjects();
    } catch (err) {
      console.warn("[video-lessons] Bunny list subjects falhou, fallback local", err);
    }
  }
  return listLocalSubjects();
}

export async function listLessonsForSubject(subjectId: string): Promise<VideoLesson[]> {
  if (isBunnyVideoConfigured()) {
    try {
      return await listBunnyLessons(subjectId);
    } catch (err) {
      console.warn("[video-lessons] Bunny list lessons falhou, fallback local", err);
    }
  }
  return listLocalLessons(subjectId);
}

export async function getLessonById(lessonId: string): Promise<VideoLesson | null> {
  const [subjectId] = lessonId.split("__");
  if (!subjectId) return null;
  const lessons = await listLessonsForSubject(subjectId);
  return lessons.find((l) => l.id === lessonId) ?? null;
}

export function resolveLessonFilePath(subjectId: string, fileName: string): string {
  const subject = resolveSubjectDir(subjectId);
  if (!subject) throw new Error("Matéria não encontrada.");
  const safeName = path.basename(fileName);
  if (!/\.mp4$/i.test(safeName)) throw new Error("Arquivo inválido.");
  const full = assertUnderRoot(getVideoLessonsRoot(), path.join(subject.dir, safeName));
  if (!fs.existsSync(full)) throw new Error("Vídeo não encontrado.");
  return full;
}

export function getVideoSourceLabel(): string {
  const bunny = getBunnyVideoConfig();
  if (bunny) return `Bunny CDN (${bunny.cdnBaseUrl})`;
  return getVideoLessonsRoot();
}
