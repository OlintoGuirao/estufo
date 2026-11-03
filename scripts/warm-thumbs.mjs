import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}

const { listLessonsForSubject } = await import(
  pathToFileURL(path.join(root, "src/server/video-lessons/catalog.ts")).href
);
const { ensureLessonThumb, hasCachedThumb } = await import(
  pathToFileURL(path.join(root, "src/server/video-lessons/thumb.ts")).href
);

const subjectId = process.argv[2] || "portugues";
const lessons = await listLessonsForSubject(subjectId);
console.log("lessons", lessons.length);
let ok = 0;
let fail = 0;
for (const l of lessons) {
  if (hasCachedThumb(subjectId, l.fileName)) {
    ok++;
    continue;
  }
  try {
    await ensureLessonThumb(subjectId, l.fileName);
    ok++;
    console.log("ok", l.order, l.title.slice(0, 40));
  } catch (e) {
    fail++;
    console.log("fail", l.order, e instanceof Error ? e.message.slice(0, 120) : e);
  }
}
console.log("done ok=", ok, "fail=", fail);
