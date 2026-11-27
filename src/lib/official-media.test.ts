/**
 * Imagens e tabelas das questões oficiais TJSP chegam ao material final
 * (TJ Quest, simulados, Mais cobradas).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import data from "@/data/tjsp-official-provas.json";
import media from "@/data/tjsp-official-media.json";
import { altMedia, officialMediaFor } from "./official-media";
import { cleanOfficialProva, dependsOnFigure, isCleanOfficialQuestion } from "./official-question-clean";
import { buildDailyQuestions, DAILY_WHEEL } from "./tjsp-quest/daily";

type Q = {
  id: string;
  number: number;
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
};
const provas = (data as { provas: { questions: Q[] }[] }).provas;
const all = provas.flatMap((p) => cleanOfficialProva(p.questions));
const byId = new Map(all.map((q) => [q.id, q]));

describe("arquivos de mídia", () => {
  it("todo recorte referenciado existe em public/", () => {
    const srcs = Object.values(media as Record<string, { statement?: { src: string }[]; alternatives?: Record<string, { src: string }[]> }>)
      .flatMap((m) => [...(m.statement ?? []), ...Object.values(m.alternatives ?? {}).flat()])
      .map((x) => x.src);
    expect(srcs.length).toBeGreaterThan(50);
    for (const src of srcs) {
      expect(existsSync(path.resolve(process.cwd(), "public", src.replace(/^\//, ""))), src).toBe(true);
    }
  });
});

describe("dados das provas oficiais", () => {
  it("nenhuma alternativa diz 'consulte o caderno oficial' nem traz rótulo de outra vazado", () => {
    const bad = all.filter((q) =>
      q.alternatives.some((a) => /consulte o caderno|^\s*\([A-E]\)|\s\([A-E]\)\s/.test(a.text)),
    );
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("alternativa sem texto é sempre uma figura com recorte", () => {
    for (const q of all) {
      for (const a of q.alternatives.filter((x) => !x.text.trim())) {
        expect(altMedia(officialMediaFor(q.id), a.key).length, `${q.id} ${a.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("toda questão que depende de figura tem a figura", () => {
    const sem = all.filter((q) => dependsOnFigure(q.statement) && !officialMediaFor(q.id)?.statement?.length);
    expect(sem.map((q) => q.id)).toEqual([]);
  });

  it("questão com figura passa no filtro de qualidade (antes era escondida ou ia sem imagem)", () => {
    for (const id of ["tjsp-oficial-2024-q001", "tjsp-oficial-2024-q012", "tjsp-oficial-2021-q067", "tjsp-oficial-2025-q059"]) {
      expect(isCleanOfficialQuestion(byId.get(id)!), id).toBe(true);
    }
  });

  it("figura das alternativas: 2018 Q91, 2021 Q97 e 2023 Q92 têm imagem em A–E", () => {
    for (const id of ["tjsp-oficial-2018-q091", "tjsp-oficial-2021-q097", "tjsp-oficial-2023-q092"]) {
      const m = officialMediaFor(id);
      for (const k of ["A", "B", "C", "D", "E"]) expect(altMedia(m, k).length, `${id} ${k}`).toBe(1);
    }
  });

  it("apoio compartilhado: a tira das questões 01 e 02 (2024) vai para as duas", () => {
    const a = officialMediaFor("tjsp-oficial-2024-q001")?.statement?.[0]?.src;
    expect(a).toMatch(/apoio/);
    expect(officialMediaFor("tjsp-oficial-2024-q002")?.statement?.[0]?.src).toBe(a);
    const tira21 = officialMediaFor("tjsp-oficial-2024-q021")?.statement?.[0]?.src;
    for (const n of [22, 23, 24]) {
      expect(officialMediaFor(`tjsp-oficial-2024-q0${n}`)?.statement?.[0]?.src).toBe(tira21);
    }
    // e não fica pendurada na questão anterior
    expect(officialMediaFor("tjsp-oficial-2024-q020")).toBeUndefined();
  });

  it("alternativas embaralhadas pelo import foram corrigidas pelo PDF", () => {
    expect(byId.get("tjsp-oficial-2018-q004")!.alternatives.map((a) => a.text)).toEqual([
      "recíproco, possessivo e reflexivo.",
      "recíproco, reflexivo e reflexivo.",
      "reflexivo, possessivo e reflexivo.",
      "reflexivo, demonstrativo e enfático.",
      "reflexivo, enfático e possessivo.",
    ]);
    expect(byId.get("tjsp-oficial-2021-q074")!.alternatives.map((a) => a.text)).toEqual([
      "1/5",
      "1/2",
      "1/4",
      "1/6",
      "1/3",
    ]);
  });
});

describe("TJ Quest (desafio do dia)", () => {
  it("questão oficial com figura chega ao Quest com a mídia", async () => {
    let checked = 0;
    for (let d = 0; d < 120 && checked < 3; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      for (const slice of DAILY_WHEEL) {
        for (const q of await buildDailyQuestions(slice, date)) {
          const base = q.id.replace(/^daily:/, "");
          const expected = officialMediaFor(base);
          if (!expected) continue;
          expect(q.media, q.id).toEqual(expected);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 60_000);
});
