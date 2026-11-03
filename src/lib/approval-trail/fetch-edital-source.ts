/**
 * Busca texto público de fontes oficiais citadas no edital (TJSP / eSAJ).
 * Usado ao Gerar material de Legislação Interna.
 *
 * Sem jsdom: no SSR Vite/ESM o jsdom quebra com `__dirname is not defined`.
 */

const ALLOWED_HOSTS = [
  /(^|\.)tjsp\.jus\.br$/i,
  /(^|\.)esaj\.tjsp\.jus\.br$/i,
  /(^|\.)planalto\.gov\.br$/i,
];

const MAX_CHARS = 10_000;

function hostAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some((re) => re.test(hostname));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Extrai texto legível de HTML sem DOM (compatível com ESM/SSR). */
export function htmlToPlain(html: string): string {
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(nav|footer|header|iframe|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text.slice(0, MAX_CHARS);
}

export async function fetchPublicLawText(
  url: string,
): Promise<{ url: string; text: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/i.test(parsed.protocol)) return null;
  if (!hostAllowed(parsed.hostname)) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Estufoo/1.0; +estudo-concurso; fetch-edital)",
        Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const finalHost = new URL(res.url).hostname;
    if (!hostAllowed(finalHost)) return null;

    const ctype = res.headers.get("content-type") || "";
    if (/pdf/i.test(ctype)) {
      return {
        url: res.url,
        text: `[PDF oficial] ${res.url} — abrir o arquivo e estudar o texto integral (fetch de PDF bruto não disponível aqui).`,
      };
    }

    const html = await res.text();
    const text = htmlToPlain(html);
    if (text.length < 80) return null;
    return { url: res.url, text };
  } catch (err) {
    console.warn("[fetch-edital-source] falhou", url, err);
    return null;
  }
}

export async function enrichNotesWithSources(notes: string): Promise<string> {
  const { extractSourceUrls } = await import("./study-stages");
  const urls = extractSourceUrls(notes).slice(0, 3);
  if (!urls.length) return notes;

  const parts: string[] = [notes];
  for (const u of urls) {
    const got = await fetchPublicLawText(u);
    if (!got) {
      parts.push(`\n[Fonte não carregada automaticamente] ${u}`);
      continue;
    }
    parts.push(`\n\n--- Texto obtido de ${got.url} ---\n${got.text}`);
  }
  return parts.join("").slice(0, 14_000);
}
