import { describe, expect, it } from "vitest";
import { tjspQuestCatalog } from "@/data/tjsp-quest-catalog";
import {
  editalFocusForPhase,
  editalItemsForPhase,
  QUEST_CHEFAO_PHASES,
  TJSP_EDITAL_ITEMS,
} from "./edital-topics";

describe("cobertura do edital no TJSP Quest", () => {
  const phaseIds = new Set(tjspQuestCatalog.phases.map((p) => p.id));

  it("todo item do edital aponta para uma fase existente da mesma matéria", () => {
    for (const it of TJSP_EDITAL_ITEMS) {
      expect(phaseIds.has(it.phase), it.id).toBe(true);
      expect(tjspQuestCatalog.phases.find((p) => p.id === it.phase)?.subjectId, it.id).toBe(it.subject);
    }
  });

  it("toda fase (não chefão) cobra ao menos um item; ids únicos", () => {
    const chefoes = new Set(Object.values(QUEST_CHEFAO_PHASES));
    for (const p of tjspQuestCatalog.phases) {
      if (chefoes.has(p.id)) continue;
      expect(editalItemsForPhase(p.id).length, p.id).toBeGreaterThan(0);
    }
    expect(new Set(TJSP_EDITAL_ITEMS.map((i) => i.id)).size).toBe(TJSP_EDITAL_ITEMS.length);
  });

  it("chefão revisa todos os itens da matéria", () => {
    const port = TJSP_EDITAL_ITEMS.filter((i) => i.subject === "port").length;
    expect(editalItemsForPhase("port-6")).toHaveLength(port);
    expect(port).toBeGreaterThanOrEqual(13);
  });

  it("o rodízio de foco passa por todos os itens ao longo da trilha (10 etapas × 5)", () => {
    for (const p of tjspQuestCatalog.phases) {
      const all = editalItemsForPhase(p.id).map((i) => i.id);
      const seen = new Set<string>();
      for (let n = 0; n < 50; n += 5) editalFocusForPhase(p.id, n, 3).forEach((i) => seen.add(i.id));
      expect([...seen].sort(), p.id).toEqual([...new Set(all)].sort());
    }
  });
});
