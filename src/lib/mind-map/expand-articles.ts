import type { StudyPackAi } from "@/lib/tutor/study-pack";
import type { StudyPackNode } from "@/lib/mind-map/layout";

const MAX_EXPAND_PER_RANGE = 14;
const MAX_EXPAND_TOTAL = 20;

const STUB_RE =
  /complete com|revise a tipifica|citado no material|conforme o material\.?$/i;

/** Extrai números de artigo citados no texto (Art. 293, art 312…). */
export function extractArticleNumbers(text: string): number[] {
  const found = new Set<number>();
  const re = /\bart\.?\s*(\d{1,4})(?:-?[A-Za-z])?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 3000) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Busca no material o trecho do Art. N: tipificação (+ pena se houver).
 */
export function extractArticleTipification(
  material: string,
  artNum: number,
): string | null {
  const text = String(material ?? "").replace(/\r/g, "");
  if (!text.trim()) return null;

  const artRe = new RegExp(
    `\\bart(?:igo)?\\.?\\s*${artNum}\\b(?:-?[A-Za-z])?`,
    "i",
  );
  const match = artRe.exec(text);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const windowEnd = Math.min(text.length, start + 700);
  let chunk = text.slice(start, windowEnd);

  // Parar no próximo Art. N (outro número)
  const nextArt = chunk.slice(20).search(/\n\s*Art(?:igo)?\.?\s*\d+/i);
  if (nextArt >= 0) chunk = chunk.slice(0, 20 + nextArt);

  chunk = chunk.replace(/\s+/g, " ").trim();

  // Preferir conteúdo após "Art. N -" / ":"
  const afterLabel = chunk.match(
    new RegExp(
      `\\bart(?:igo)?\\.?\\s*${artNum}\\b(?:-?[A-Za-z])?\\s*[-–—:]\\s*(.+)`,
      "i",
    ),
  );
  let body = afterLabel?.[1]?.trim() ?? chunk;

  // Captação de pena no trecho (ou logo após)
  const penaNear = text
    .slice(start, Math.min(text.length, start + 900))
    .replace(/\s+/g, " ");
  const penaMatch = penaNear.match(
    /\bPena\s*:\s*[^.]{8,120}(?:\.[^.]{0,80})?/i,
  );

  // Limpar ruído
  body = body.replace(/^[^A-Za-zÀ-ú0-9]+/, "").trim();

  // Montar tipificação: 1–2 frases + pena
  const sentences = body
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !/^pena\s*:/i.test(s));

  let tip = "";
  for (const s of sentences) {
    const next = tip ? `${tip} ${s}` : s;
    if (next.length > 360) break;
    tip = next;
    if (tip.length >= 70) break;
  }
  if (!tip) tip = body.slice(0, 320);

  if (penaMatch) {
    const pena = penaMatch[0].replace(/\s+/g, " ").trim();
    if (!/pena\s*:/i.test(tip)) {
      tip = `${tip.replace(/\.\s*$/, "")}. ${pena}${pena.endsWith(".") ? "" : "."}`;
    }
  }

  tip = tip.replace(/\s+/g, " ").trim();
  if (tip.length < 25) return null;
  return tip.length > 480 ? `${tip.slice(0, 477)}…` : tip;
}

/** Título curto do card de tipificação. */
export function tipificationTitle(artNum: number, tip: string): string {
  const cleaned = tip
    .replace(new RegExp(`\\bart(?:igo)?\\.?\\s*${artNum}\\b(?:-?[A-Za-z])?[,:]?\\s*`, "i"), "")
    .replace(/\s*Pena\s*:.*$/i, "")
    .replace(/^(do|da|de|o|a|os|as)\s+/i, "")
    .trim();
  const first = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  const short = first.length > 72 ? `${first.slice(0, 69)}…` : first;
  return short.length >= 12 ? short : `Tipificação do Art. ${artNum}`;
}

/** Expande faixas tipo "Arts. 293 a 305, 307 e 308" em lista de números. */
export function parseArticleNumbersFromTitle(title: string, max = 40): number[] {
  const t = String(title ?? "");
  const nums = new Set<number>();

  const rangeRe = /arts?\.?\s*(\d+)\s*(?:a|–|-|até)\s*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(t))) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
    const end = Math.min(to, from + max - 1);
    for (let n = from; n <= end; n++) nums.add(n);
  }

  const singleRe = /(?:^|[,;e\s])(?:art\.?\s*)?(\d{2,4})(?![0-9])/gi;
  while ((m = singleRe.exec(t))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n < 3000) nums.add(n);
  }

  return [...nums].sort((a, b) => a - b).slice(0, max);
}

/** Escolhe quais arts expandir: material > faixa curta (nunca dezenas vazias). */
export function pickArticlesToExpand(
  rangeNums: number[],
  materialArts: Set<number>,
  max = MAX_EXPAND_PER_RANGE,
): number[] {
  if (!rangeNums.length) return [];

  const inMaterial = rangeNums.filter((n) => materialArts.has(n));
  if (inMaterial.length >= 1) return inMaterial.slice(0, max);

  // Sem citação no material: só expande se a faixa for curta (ex. 293–305 = 13)
  if (rangeNums.length <= max) return rangeNums;
  return [];
}

function hasArtNode(nodes: StudyPackNode[], num: number): boolean {
  const re = new RegExp(`\\bart\\.?\\s*${num}\\b`, "i");
  return nodes.some((n) => n.kind === "artigo" && re.test(n.title));
}

function hasExplanationForArt(nodes: StudyPackNode[], num: number): boolean {
  const re = new RegExp(`\\bart\\.?\\s*${num}\\b`, "i");
  return nodes.some(
    (n) =>
      n.kind === "explicacao" &&
      (re.test(n.title) || re.test(n.summary) || n.keywords.some((k) => re.test(k))) &&
      !STUB_RE.test(n.summary),
  );
}

function codeSuffix(title: string): string {
  if (/\bCP\b/i.test(title)) return " CP";
  if (/\bCPC\b/i.test(title)) return " CPC";
  if (/\bCF\b/i.test(title)) return " CF";
  return "";
}

function artNumFromNode(n: StudyPackNode): number | null {
  const m =
    n.title.match(/\bart\.?\s*(\d{1,4})\b/i) ||
    n.summary.match(/\bart\.?\s*(\d{1,4})\b/i) ||
    n.keywords.map((k) => k.match(/\bart\.?\s*(\d{1,4})\b/i)).find(Boolean);
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isFinite(num) ? num : null;
}

/** Preenche nós com texto genérico usando trechos do material. */
export function fillStubNodesFromMaterial(
  nodes: StudyPackNode[],
  material: string,
): number {
  let filled = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (!STUB_RE.test(n.summary) && !STUB_RE.test(n.title)) continue;
    const num = artNumFromNode(n);
    if (num == null) continue;
    const tip = extractArticleTipification(material, num);
    if (!tip) continue;
    if (n.kind === "explicacao") {
      nodes[i] = {
        ...n,
        title: tipificationTitle(num, tip),
        summary: tip,
      };
    } else if (n.kind === "artigo") {
      nodes[i] = {
        ...n,
        summary: tipificationTitle(num, tip),
      };
    }
    filled += 1;
  }
  return filled;
}

function pushArtWithTip(
  nodes: StudyPackNode[],
  opts: {
    num: number;
    tip: string;
    parentId: string | null;
    suffix: string;
    added: number;
  },
): void {
  const { num, tip, parentId, suffix, added } = opts;
  const artId = `auto_a${num}_${added}`;
  const expId = `auto_e${num}_${added}`;
  const label = tipificationTitle(num, tip);
  nodes.push({
    tempId: artId,
    title: `Art. ${num}${suffix}`.trim(),
    kind: "artigo",
    summary: label,
    keywords: [`Art. ${num}`],
    parentTempId: parentId,
  });
  nodes.push({
    tempId: expId,
    title: label,
    kind: "explicacao",
    summary: tip,
    keywords: [`Art. ${num}`],
    parentTempId: artId,
  });
}

/** Garante explicação real para arts que já existem sem filho útil. */
function ensureExplanations(
  nodes: StudyPackNode[],
  material: string,
): number {
  let added = 0;
  const arts = nodes.filter((n) => n.kind === "artigo");
  for (const art of arts) {
    const num = artNumFromNode(art);
    if (num == null) continue;
    if (hasExplanationForArt(nodes, num)) continue;
    const tip = extractArticleTipification(material, num);
    if (!tip) continue;
    const label = tipificationTitle(num, tip);
    // Atualiza summary curto do art se genérico
    if (STUB_RE.test(art.summary) || art.summary.length < 12) {
      art.summary = label;
    }
    nodes.push({
      tempId: `auto_e${num}_fix`,
      title: label,
      kind: "explicacao",
      summary: tip,
      keywords: [`Art. ${num}`],
      parentTempId: art.tempId,
    });
    added += 1;
  }
  return added;
}

/**
 * Garante cards Art. N + explicação real (tipificação + pena do material).
 * Hierarquia: faixa (topico) → Art. N → explicação.
 */
export function expandStudyPackArticles(
  pack: StudyPackAi,
  material = "",
): StudyPackAi {
  const nodes = pack.nodes.map((n) => ({ ...n }));
  const materialArts = new Set(extractArticleNumbers(material));
  let added = 0;

  const filled = fillStubNodesFromMaterial(nodes, material);

  // Faixa: title "Arts. X a Y" + summary = nome do capítulo (visível no card)
  for (const n of nodes) {
    if (n.kind !== "topico") continue;
    if (!/arts?\.?\s*\d+/i.test(n.title)) continue;
    if (n.summary.length > 20 && !n.title.includes("—") && !n.title.includes(" - ")) {
      const theme = n.summary.split(/[.(]/)[0]!.trim().slice(0, 70);
      if (theme.length >= 12) {
        n.title = `${n.title.replace(/\s*—.*$/, "").trim()} — ${theme}`;
      }
    }
  }

  // Arts órfãos (sem parent / parent inexistente) → sob a faixa
  {
    const faixa = nodes.find((n) => n.kind === "topico");
    const ids = new Set(nodes.map((n) => n.tempId));
    if (faixa) {
      for (const n of nodes) {
        if (n.kind !== "artigo") continue;
        if (!n.parentTempId || !ids.has(n.parentTempId)) {
          n.parentTempId = faixa.tempId;
        }
      }
    }
  }

  const faixaParent =
    nodes.find((n) => n.kind === "topico")?.tempId ??
    nodes.find((n) => n.kind === "conceito" && /arts?\.?\s*\d+/i.test(n.title))
      ?.tempId ??
    null;

  const rangeNodes = nodes.filter(
    (n) =>
      n.kind === "topico" ||
      /arts?\.?\s*\d+\s*(?:a|–|-|até)/i.test(n.title) ||
      /arts?\.?\s*\d+.+\d+/i.test(n.title),
  );

  for (const range of rangeNodes) {
    if (added >= MAX_EXPAND_TOTAL) break;

    const allNums = parseArticleNumbersFromTitle(range.title, 80);
    if (!allNums.length) continue;

    const nums = pickArticlesToExpand(allNums, materialArts, MAX_EXPAND_PER_RANGE);
    const parentId = range.tempId;
    const suffix = codeSuffix(range.title);

    for (const num of nums) {
      if (added >= MAX_EXPAND_TOTAL) break;
      if (hasArtNode(nodes, num)) continue;

      const tip = extractArticleTipification(material, num);
      if (!tip) continue;

      pushArtWithTip(nodes, { num, tip, parentId, suffix, added });
      added += 1;
    }

    if (allNums.length > nums.length) {
      range.summary = [
        range.summary,
        `(Mapa detalha ${nums.length} art(s) com base no material.)`,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  // Arts citados no material ainda sem nó → sob a faixa
  if (materialArts.size && added < MAX_EXPAND_TOTAL) {
    for (const num of materialArts) {
      if (added >= MAX_EXPAND_TOTAL) break;
      if (hasArtNode(nodes, num)) continue;
      const tip = extractArticleTipification(material, num);
      if (!tip) continue;
      pushArtWithTip(nodes, {
        num,
        tip,
        parentId: faixaParent,
        suffix: "",
        added,
      });
      added += 1;
    }
  }

  const filled2 = fillStubNodesFromMaterial(nodes, material);
  const ensured = ensureExplanations(nodes, material);

  if (!added && !filled && !filled2 && !ensured) return pack;

  const warnings = [...pack.warnings];
  if (added) {
    warnings.push(
      `Expandidos ${added} artigo(s) com tipificação tirada do material.`,
    );
  }
  if (filled + filled2) {
    warnings.push(
      `Preenchidas ${filled + filled2} explicações a partir do texto enviado.`,
    );
  }
  if (ensured) {
    warnings.push(`Completadas ${ensured} tipificações ligadas aos artigos.`);
  }

  const flashcards = [...pack.flashcards];
  for (const n of nodes) {
    if (flashcards.length >= 24) break;
    if (n.kind !== "explicacao") continue;
    if (STUB_RE.test(n.summary)) continue;
    const num = artNumFromNode(n);
    const front =
      num != null
        ? `O que tipifica o Art. ${num}?`
        : `O que trata o ${n.title}?`;
    if (flashcards.some((f) => f.front === front)) continue;
    flashcards.push({
      front,
      back: n.summary,
      topic: n.title,
      tags: n.keywords.slice(0, 3),
      nodeId: n.tempId,
    });
  }

  return { ...pack, nodes, flashcards, warnings };
}
