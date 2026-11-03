import fs from "node:fs";
import { resolveLessonFilePath } from "./catalog";
import { getBunnyVideoConfig } from "./config";
import {
  bunnyStorageFileUrl,
  joinStoragePath,
  resolveBunnySubjectName,
} from "./bunny";

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (e) => controller.error(e));
    },
    cancel() {
      stream.destroy();
    },
  });
}

const VIDEO_HEADERS = {
  "Content-Type": "video/mp2t",
  "Accept-Ranges": "bytes",
  // Vary: Range evita cachear sniff (bytes=0-511) como se fosse o arquivo inteiro.
  "Cache-Control": "private, no-store",
  Vary: "Range",
} as const;

/** Proxy autenticado Bunny Storage → browser (resolve 401 da Pull Zone). */
async function handleBunnyProxy(request: Request, subjectId: string, fileName: string): Promise<Response> {
  const cfg = getBunnyVideoConfig();
  if (!cfg) return new Response("Bunny não configurada.", { status: 503 });

  const subjectName = await resolveBunnySubjectName(subjectId);
  if (!subjectName) return new Response("Matéria não encontrada na Bunny.", { status: 404 });

  const safeName = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const relative = joinStoragePath(cfg.prefix, subjectName, safeName);
  const upstreamUrl = bunnyStorageFileUrl(cfg, relative);

  const headers: Record<string, string> = {
    AccessKey: cfg.accessKey,
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;

  const upstream = await fetch(upstreamUrl, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
  });

  if (!upstream.ok && upstream.status !== 206) {
    const body = await upstream.text().catch(() => "");
    return new Response(
      body.slice(0, 300) || `Bunny Storage ${upstream.status}`,
      { status: upstream.status === 401 ? 502 : upstream.status },
    );
  }

  const out = new Headers();
  out.set("Content-Type", upstream.headers.get("content-type") || VIDEO_HEADERS["Content-Type"]);
  out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", VIDEO_HEADERS["Cache-Control"]);
  out.set("Vary", VIDEO_HEADERS.Vary);
  const len = upstream.headers.get("content-length");
  if (len) out.set("Content-Length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) out.set("Content-Range", cr);

  if (request.method === "HEAD") {
    return new Response(null, { status: upstream.status, headers: out });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

function handleLocalFile(request: Request, subject: string, file: string): Response {
  let filePath: string;
  try {
    filePath = resolveLessonFilePath(subject, file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vídeo não encontrado.";
    return new Response(msg, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const size = stat.size;
  const range = request.headers.get("range");

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...VIDEO_HEADERS,
        "Content-Length": String(size),
      },
    });
  }

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) return new Response("Range inválido.", { status: 416 });
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response("Range inválido.", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(nodeStreamToWeb(stream), {
      status: 206,
      headers: {
        ...VIDEO_HEADERS,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(nodeStreamToWeb(stream), {
    status: 200,
    headers: {
      ...VIDEO_HEADERS,
      "Content-Length": String(size),
    },
  });
}

/**
 * Serve videoaulas com Range (seek).
 * - provider=bunny → proxy Storage (AccessKey), evita 401 da Pull Zone
 * - senão → arquivo local
 */
export async function handleVideoLessonStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject")?.trim() ?? "";
  const file = url.searchParams.get("file")?.trim() ?? "";
  const provider = url.searchParams.get("provider")?.trim() ?? "";
  if (!subject || !file) {
    return new Response("Parâmetros subject e file são obrigatórios.", { status: 400 });
  }

  if (provider === "bunny") {
    try {
      return await handleBunnyProxy(request, subject, file);
    } catch (err) {
      console.warn("[video-stream] bunny proxy falhou", err);
      const msg = err instanceof Error ? err.message : "Falha no proxy Bunny.";
      return new Response(msg, { status: 502 });
    }
  }

  return handleLocalFile(request, subject, file);
}
