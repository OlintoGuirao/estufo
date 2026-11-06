/** Extrai URL de marcação `[fonte](https://...)` do texto do gabarito. */
export function extractFonteUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const md = text.match(/\[fonte\]\((https?:\/\/[^)\s]+)\)/i);
  if (md?.[1]) return cleanUrl(md[1]);
  const bare = text.match(/(https?:\/\/[^\s\]|<>"]+)/i);
  if (bare?.[1]) return cleanUrl(bare[1]);
  return null;
}

function cleanUrl(raw: string): string {
  return raw.replace(/[),.;]+$/g, "").trim();
}

export function stripHtmlToText(html: string, maxChars = 10_000): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = noScript
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}

/**
 * Domínios oficiais que o servidor aceita buscar (evita SSRF:
 * o servidor nunca deve baixar URL arbitrária enviada pelo cliente).
 * Extra via env TUTOR_FONTE_ALLOWED_HOSTS="exemplo.com,outro.org".
 */
const DEFAULT_ALLOWED_SUFFIXES = [".gov.br", ".jus.br", ".leg.br", ".mp.br", ".def.br"];
const DEFAULT_ALLOWED_HOSTS = [
  "planalto.gov.br",
  "www.planalto.gov.br",
  // Fontes usadas no banco de questões (Informática / Atualidades)
  "support.microsoft.com",
  "learn.microsoft.com",
  "developer.mozilla.org",
  "www.unesco.org",
  "www.oecd.org",
];

export function isAllowedFonteUrl(raw: string, extraHosts: string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  // Bloqueia IP literal (v4/v6) e nomes locais.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host === "localhost") {
    return false;
  }
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...extraHosts.map((h) => h.trim().toLowerCase())];
  if (allowedHosts.includes(host)) return true;
  return DEFAULT_ALLOWED_SUFFIXES.some((suf) => host.endsWith(suf));
}

/** Decodifica HTML respeitando o charset (planalto.gov.br usa windows-1252 em várias leis). */
export function decodeHtmlBytes(bytes: ArrayBuffer, contentType?: string | null): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const charset = (fromHeader || fromMeta || "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas que para por com sem sobre entre ao aos à às é ser se sua seu suas seus como mais menos ou não alternativa correta assinale questão".split(
    " ",
  ),
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/**
 * Leis no planalto têm centenas de KB. Pegar só o começo da página
 * (o que era feito antes) trazia o preâmbulo, não o artigo cobrado.
 * Aqui buscamos os artigos citados na pergunta/gabarito; se não houver,
 * pegamos os trechos com mais palavras em comum.
 */
export function pickRelevantExcerpt(fullText: string, query: string, maxChars = 9_000): string {
  const text = fullText.replace(/\s+/g, " ");
  if (text.length <= maxChars) return text;

  const pieces: string[] = [];
  const seen = new Set<number>();
  const artNums = [...query.matchAll(/art(?:igo)?\.?\s*(\d{1,4})/gi)].map((m) => m[1]!);
  for (const n of artNums) {
    const re = new RegExp(`Art\\.?\\s*${n}(?:º|°|o|\\.|\\s|-|–)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = Math.max(0, m.index - 150);
      if ([...seen].some((s) => Math.abs(s - start) < 1500)) continue;
      seen.add(start);
      pieces.push(text.slice(start, start + 2_500));
      if (pieces.join(" ").length > maxChars) break;
    }
  }
  if (pieces.join(" ").length >= maxChars * 0.4) {
    return pieces.join("\n…\n").slice(0, maxChars);
  }

  const q = new Set(words(query));
  const size = 1_500;
  const chunks: { i: number; score: number }[] = [];
  for (let i = 0; i < text.length; i += size) {
    const ws = words(text.slice(i, i + size));
    let score = 0;
    for (const w of ws) if (q.has(w)) score++;
    chunks.push({ i, score });
  }
  chunks.sort((a, b) => b.score - a.score);
  const picked = chunks
    .slice(0, Math.max(1, Math.floor(maxChars / size)))
    .sort((a, b) => a.i - b.i)
    .map((c) => text.slice(c.i, c.i + size));
  return [...pieces, ...picked].join("\n…\n").slice(0, maxChars);
}

/** Baixa uma fonte oficial com allowlist em cada redirecionamento. */
export async function fetchOfficialSource(
  url: string,
  opts?: { timeoutMs?: number; extraHosts?: string[]; fetchImpl?: typeof fetch },
): Promise<string | null> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedFonteUrl(current, opts?.extraHosts)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 12_000);
    try {
      const res = await fetchImpl(current, {
        signal: ctrl.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "EstufooTutor/1.1",
        },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 8_000_000) return null;
      return decodeHtmlBytes(buf, res.headers.get("content-type"));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
