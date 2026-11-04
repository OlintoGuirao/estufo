/**
 * Qualidade mínima de questões da trilha (Português/VUNESP-like).
 * Corrige "termo destacado" sem marca e rejeita enunciado vs alternativas incoerentes.
 */

const CONNECTIVES = [
  "porquanto",
  "portanto",
  "contudo",
  "entretanto",
  "todavia",
  "embora",
  "conquanto",
  "porém",
  "posto que",
  "visto que",
  "uma vez que",
  "ainda que",
  "mesmo que",
  "desde que",
  "para que",
  "a fim de",
  "assim",
  "logo",
  "pois",
  "porque",
  "caso",
  "como",
  "mas",
  "nem",
] as const;

const HIGHLIGHT_CLAIM =
  /termo destacado|palavra destacada|voc[aá]bulo destacado|express[aã]o destacada|trecho destacado/i;

function hasHighlightMark(statement: string): boolean {
  if (/«[^»]{1,48}»/.test(statement)) return true;
  // Termo curto entre aspas dentro do enunciado (além do trecho inteiro)
  if (/\b[«"]([A-Za-zÀ-ÿ]{2,24})[»"]\b/.test(statement)) return true;
  return false;
}

/** Extrai o maior trecho entre aspas do enunciado. */
function extractQuotedPassage(statement: string): { full: string; inner: string } | null {
  const m = statement.match(/(['"“”‘'])([^'"“”‘']{8,280})\1/);
  if (!m?.[2]) return null;
  return { full: m[0], inner: m[2] };
}

function findBestConnective(passage: string, hint: string): string | null {
  const lower = passage.toLowerCase();
  const hintLower = hint.toLowerCase();
  let best: { word: string; score: number } | null = null;
  for (const w of CONNECTIVES) {
    const idx = lower.indexOf(w);
    if (idx < 0) continue;
    // Evita falso positivo de "como"/"caso" no início genérico se houver melhor
    let score = w.length;
    if (hintLower.includes(w)) score += 20;
    if (/oposi|advers|contraste|contudo|porém|entretanto|todavia/i.test(hint) &&
      /^(contudo|porém|entretanto|todavia|mas)$/i.test(w)) {
      score += 15;
    }
    if (/causa|explica|porquanto|porque|pois|visto|uma vez/i.test(hint) &&
      /^(porquanto|porque|pois|como|visto que|uma vez que)$/i.test(w)) {
      score += 15;
    }
    if (/conclus|consequ|portanto|logo|assim/i.test(hint) &&
      /^(portanto|logo|assim)$/i.test(w)) {
      score += 15;
    }
    if (!best || score > best.score) best = { word: passage.slice(idx, idx + w.length), score };
  }
  return best?.word ?? null;
}

/**
 * Se o enunciado fala em "termo destacado" sem marca visual, envolve o conectivo
 * alvo com « » (renderizado em negrito na UI).
 */
export function repairHighlightedTerm(
  statement: string,
  hint = "",
): { statement: string; ok: boolean } {
  if (!HIGHLIGHT_CLAIM.test(statement)) return { statement, ok: true };
  if (hasHighlightMark(statement)) return { statement, ok: true };

  const quoted = extractQuotedPassage(statement);
  if (!quoted) return { statement, ok: false };

  const target = findBestConnective(quoted.inner, hint);
  if (!target) return { statement, ok: false };

  const markedInner = quoted.inner.replace(target, `«${target}»`);
  const markedFull = quoted.full[0] + markedInner + quoted.full[quoted.full.length - 1];
  return {
    statement: statement.replace(quoted.full, markedFull),
    ok: true,
  };
}

/**
 * "Assinale a opção em que a substituição mantém o sentido" exige FRASES nas
 * alternativas — não rótulos meta ("Muda para concessão").
 */
export function isBrokenSubstitutionStem(
  statement: string,
  alternatives: { text: string }[],
): boolean {
  const stem = statement.trim();
  const asksWhichContext =
    /assinale a (op[cç][aã]o|alternativa) em que/i.test(stem) ||
    (/assinale.{0,60}substitui/i.test(stem) && /mant[eé]m/i.test(stem));
  const talksSubstitution = /substitui[çc][aã]o de .{2,40} por .{2,40}/i.test(stem);
  if (!asksWhichContext || !talksSubstitution) return false;

  const metaRe =
    /^(muda|altera|mant[eé]m|s[aã]o|passa|expressa|indica|vira|torna)/i;
  const metaCount = alternatives.filter(
    (a) => metaRe.test(a.text.trim()) && a.text.trim().length < 55,
  ).length;
  if (metaCount >= Math.min(3, alternatives.length)) return true;

  const sentenceLike = alternatives.filter((a) => {
    const t = a.text.trim();
    return t.length >= 28 && /\s/.test(t);
  }).length;
  return sentenceLike < 2;
}

/** Enunciado pede "conectivo de consequência" mas OK — só valida coerência básica. */
export function isQuestionCoherent(
  statement: string,
  alternatives: { text: string }[],
): boolean {
  if (!statement.trim() || alternatives.length < 2) return false;
  if (isBrokenSubstitutionStem(statement, alternatives)) return false;
  if (HIGHLIGHT_CLAIM.test(statement) && !hasHighlightMark(statement)) {
    // ainda sem marca após repair → inválida
    return false;
  }
  return true;
}

export function polishPracticeStatement(
  statement: string,
  alternatives: { text: string }[],
  explanation = "",
): { statement: string; accept: boolean } {
  const hint = `${explanation} ${alternatives.map((a) => a.text).join(" ")}`;
  const repaired = repairHighlightedTerm(statement, hint);
  if (!repaired.ok) return { statement: repaired.statement, accept: false };
  const accept = isQuestionCoherent(repaired.statement, alternatives);
  return { statement: repaired.statement, accept };
}
