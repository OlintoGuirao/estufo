import { describe, expect, it } from "vitest";
import {
  applyStubEnrichment,
  listStubNodes,
  scrubRemainingStubs,
} from "./enrich-stubs";
import type { StudyPackAi } from "@/lib/tutor/study-pack";

const stubPack = (): StudyPackAi => ({
  summary: "t",
  centralTitle: "CP",
  nodes: [
    {
      tempId: "e301",
      title: "O que tipifica o Art. 301",
      kind: "explicacao",
      summary: "Complete com o que o Art. 301 pune ou tipifica, conforme o material.",
      keywords: ["Art. 301"],
      parentTempId: "a301",
    },
    {
      tempId: "a301",
      title: "Art. 301 CP",
      kind: "artigo",
      summary: "Artigo 301 — revise a tipificação no material.",
      keywords: ["Art. 301"],
      parentTempId: null,
    },
  ],
  links: [{ sourceTempId: "a301", targetTempId: "e301", label: null }],
  flashcards: [],
  warnings: [],
});

describe("enrich-stubs", () => {
  it("lista stubs genericos", () => {
    expect(listStubNodes(stubPack()).map((s) => s.tempId)).toEqual([
      "e301",
      "a301",
    ]);
  });

  it("aplica enriquecimento da IA", () => {
    const out = applyStubEnrichment(
      stubPack(),
      JSON.stringify({
        items: [
          {
            tempId: "e301",
            title: "Falsificacao de atestado",
            summary:
              "O Art. 301 tipifica falsificar, no todo ou em parte, atestado ou certidao.",
          },
          {
            tempId: "a301",
            title: "Art. 301 CP",
            summary: "Falsificacao de atestado ou certidao.",
          },
        ],
      }),
    );
    expect(out.nodes.find((n) => n.tempId === "e301")?.summary).toMatch(
      /atestado/i,
    );
    expect(listStubNodes(out)).toHaveLength(0);
  });

  it("remove explicacoes stub restantes", () => {
    const scrubbed = scrubRemainingStubs(stubPack());
    expect(scrubbed.nodes.some((n) => n.tempId === "e301")).toBe(false);
    expect(scrubbed.nodes.find((n) => n.tempId === "a301")?.summary).toMatch(
      /nao estava claro/i,
    );
  });
});
