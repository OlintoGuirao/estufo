/**
 * Corpus de lei no servidor de borda (Cloudflare Workers): lá o servidor não
 * enxerga o disco — antes `existsSync("data/legal/corpus.json")` era sempre
 * falso em produção e a IA gerava o material sem o texto da lei.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { __setLawLoadersForTest, loadLawChunks, retrieveLegalContext } from "./retrieve";
import { guessLawIds, lawIdsFromLabels } from "./laws";
import type { LegalChunk } from "@/lib/legal/chunk";

const chunk = (lawId: string, article: string, content: string): LegalChunk => ({
  id: `${lawId}:${article}`,
  lawId,
  lawName: lawId.toUpperCase(),
  article,
  content,
  sourceUrl: "",
});

afterEach(() => __setLawLoadersForTest(null));

describe("loadLawChunks", () => {
  it("sem disco (edge), carrega o arquivo estático da lei", async () => {
    const disk = vi.fn(async () => null);
    const asset = vi.fn(async (id: string) => [chunk(id, "Art. 1", "texto")]);
    __setLawLoadersForTest([disk, asset]);
    const got = await loadLawChunks(["cpp"]);
    expect(got).toHaveLength(1);
    expect(disk).toHaveBeenCalledWith("cpp");
    expect(asset).toHaveBeenCalledWith("cpp");
  });

  it("guarda em cache só o que carregou; falha tenta de novo", async () => {
    let ok = false;
    const asset = vi.fn(async (id: string) => (ok ? [chunk(id, "Art. 1", "texto")] : null));
    __setLawLoadersForTest([asset]);
    expect(await loadLawChunks(["cp"])).toHaveLength(0);
    ok = true;
    expect(await loadLawChunks(["cp"])).toHaveLength(1);
    expect(await loadLawChunks(["cp"])).toHaveLength(1);
    expect(asset).toHaveBeenCalledTimes(2); // 3ª veio do cache
  });

  it("o cache guarda dados, não Promise (nada compartilhado entre requisições)", async () => {
    const asset = vi.fn(async (id: string) => [chunk(id, "Art. 1", "texto")]);
    __setLawLoadersForTest([asset]);
    await Promise.all([loadLawChunks(["cf88"]), loadLawChunks(["cf88"])]);
    const third = await loadLawChunks(["cf88"]);
    expect(Array.isArray(third)).toBe(true);
  });
});

describe("retrieveLegalContext", () => {
  it("etapa 'Art. 351 (CPP)' traz o 351 do CPP, nunca o do CP", async () => {
    __setLawLoadersForTest([
      async (id) =>
        ({
          cp: [chunk("cp", "Art. 351", "Art. 351 - Promover ou facilitar a fuga de pessoa legalmente presa.")],
          cpp: [
            chunk("cpp", "Art. 351", "Art. 351. A citação inicial far-se-á por mandado."),
            chunk("cpp", "Art. 3", "Art. 3º A lei processual penal admitirá interpretação extensiva."),
          ],
        })[id] ?? null,
    ]);
    const prev = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "";
    try {
      const r = await retrieveLegalContext("Direito Processual Penal\nArt. 351 (CPP)\nEdital (Código de Processo Penal)", {
        limit: 2,
      });
      expect(r.via).toBe("keyword");
      expect(r.sources[0]).toMatchObject({ lawName: "CPP", article: "Art. 351" });
      expect(r.text).not.toMatch(/fuga de pessoa/);
    } finally {
      if (prev === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = prev;
    }
  });
});

describe("guessLawIds", () => {
  it("rótulo explícito da etapa manda", () => {
    expect(lawIdsFromLabels("Art. 60 (Lei 9.099/1995)")).toEqual(["l9099"]);
    expect(guessLawIds("Direito Processual Penal\nArt. 351 (CPP)")).toEqual(["cpp"]);
    expect(guessLawIds("Título II — Nacionalidade (CF, arts. 12 e 13)")).toEqual(["cf88"]);
  });

  it("'processual penal' não puxa o Código Penal junto", () => {
    expect(guessLawIds("Direito Processual Penal\ncitação do acusado")).not.toContain("cp");
    expect(guessLawIds("Direito Penal\npeculato")).toContain("cp");
  });
});

describe("corpus publicado", () => {
  it("cada lei do edital tem arquivo com artigos rotulados (não 'Preâmbulo') e sem acento quebrado", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "public", "legal");
    for (const id of ["cf88", "cp", "cpp", "cpc", "l9099", "l12153", "l8429", "sp-l10261", "tjsp-nscgj"]) {
      const { chunks } = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8")) as {
        chunks: LegalChunk[];
      };
      expect(chunks.length, id).toBeGreaterThan(20);
      const labeled = chunks.filter((c) => c.article !== "Preâmbulo").length;
      expect(labeled / chunks.length, id).toBeGreaterThan(0.95);
      expect(chunks.some((c) => /�|&[a-z]+;|&#\d+;/.test(c.content)), id).toBe(false);
    }
    const nscgj = JSON.parse(fs.readFileSync(path.join(dir, "tjsp-nscgj.json"), "utf8")).chunks as LegalChunk[];
    // antes: 355 trechos rotulados "Art. 1" (milhar com ponto)
    expect(nscgj.filter((c) => c.article === "Art. 1").length).toBeLessThan(5);
  });
});
