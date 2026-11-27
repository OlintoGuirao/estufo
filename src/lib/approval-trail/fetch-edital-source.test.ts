import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearSourceCacheForTest,
  createSourceFetcher,
  enrichNotesWithSources,
} from "./fetch-edital-source";

afterEach(() => __clearSourceCacheForTest());

const URL_A = "https://esaj.tjsp.jus.br/gcn-frontend-vue/legislacao/find/196070";

describe("createSourceFetcher (uma por requisição)", () => {
  it("itens com o mesmo link baixam uma vez só dentro da requisição", async () => {
    const download = vi.fn(async (url: string) => ({ url, text: "texto oficial" }));
    const fetchSource = createSourceFetcher(download);
    await Promise.all([fetchSource(URL_A), fetchSource(URL_A), fetchSource(URL_A)]);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("outra requisição reaproveita o TEXTO já baixado, não a Promise da anterior", async () => {
    const download = vi.fn(async (url: string) => ({ url, text: "texto oficial" }));
    await createSourceFetcher(download)(URL_A);
    const segunda = vi.fn(async (url: string) => ({ url, text: "não deveria baixar" }));
    const got = await createSourceFetcher(segunda)(URL_A);
    expect(got?.text).toBe("texto oficial");
    expect(segunda).not.toHaveBeenCalled();
  });

  it("falha não fica em cache: a próxima requisição tenta de novo", async () => {
    await createSourceFetcher(async () => null)(URL_A);
    const retry = vi.fn(async (url: string) => ({ url, text: "agora veio" }));
    expect((await createSourceFetcher(retry)(URL_A))?.text).toBe("agora veio");
  });

  it("enrichNotesWithSources usa o fetcher da requisição", async () => {
    const fetchSource = createSourceFetcher(async (url) => ({ url, text: "Art. 1º O teletrabalho…" }));
    const out = await enrichNotesWithSources(`Resolução 850/2021. Disponível em: ${URL_A}`, fetchSource);
    expect(out).toContain("Art. 1º O teletrabalho");
  });
});
