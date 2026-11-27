/**
 * Figuras, prints e tabelas das provas oficiais TJSP (recortes do PDF original).
 *
 * O import das provas converte o PDF em texto e perdia tudo que era desenho:
 * a questão dizia "conforme a imagem a seguir" e não havia imagem. Os recortes
 * são gerados por `scripts/extract-tjsp-official-media.py` e servidos de
 * `public/provas-media/`.
 */
import mediaJson from "@/data/tjsp-official-media.json";
import type { QuestionMedia, QuestionMediaSet } from "@/types";

const MEDIA = mediaJson as Record<
  string,
  { statement?: QuestionMedia[]; alternatives?: Record<string, QuestionMedia[]> }
>;

/** Mídia da questão oficial (enunciado e/ou alternativas), se houver. */
export function officialMediaFor(id: string): QuestionMediaSet | undefined {
  const m = MEDIA[id];
  if (!m) return undefined;
  const out: QuestionMediaSet = {};
  if (m.statement?.length) out.statement = m.statement;
  if (m.alternatives && Object.keys(m.alternatives).length) out.alternatives = m.alternatives;
  return out.statement || out.alternatives ? out : undefined;
}

export function altMedia(set: QuestionMediaSet | undefined, key: string): QuestionMedia[] {
  return set?.alternatives?.[key.toUpperCase()] ?? [];
}

export function hasAnyMedia(set: QuestionMediaSet | undefined): boolean {
  return !!(set?.statement?.length || (set?.alternatives && Object.keys(set.alternatives).length));
}
