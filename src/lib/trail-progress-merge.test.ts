import { describe, expect, it } from "vitest";
import { mergeChat, mergeTrailProgress } from "./trail-progress-merge";
import type { TrailWeekProgress } from "@/types/trail-progress";

const base = (over: Partial<TrailWeekProgress>): TrailWeekProgress => ({
  trailId: "t",
  week: 1,
  status: "pendente",
  activeModuleId: null,
  completedModuleIds: [],
  practiceAnswers: {},
  chat: [],
  updatedAt: "2026-11-09T10:00:00Z",
  ...over,
});

const a = (text: string) => ({ role: "aluno" as const, text });
const p = (text: string) => ({ role: "professor" as const, text });

describe("junta progresso da trilha entre aparelhos", () => {
  it("conversa do celular aparece no PC sem perder a do PC", () => {
    const common = [a("O que é marca lexical?"), p("É uma palavra-pista…")];
    const pc = [...common, a("Pergunta no PC"), p("Resposta no PC")];
    const cel = [...common, a("Pergunta no celular"), p("Resposta no celular")];
    const out = mergeChat(pc, cel);
    expect(out.map((m) => m.text)).toEqual([
      "O que é marca lexical?",
      "É uma palavra-pista…",
      "Pergunta no PC",
      "Resposta no PC",
      "Pergunta no celular",
      "Resposta no celular",
    ]);
  });

  it("se um aparelho só tem parte da conversa, fica a conversa inteira", () => {
    const full = [a("1"), p("2"), a("3"), p("4")];
    expect(mergeChat(full.slice(0, 2), full)).toEqual(full);
    expect(mergeChat(full, full.slice(0, 2))).toEqual(full);
  });

  it("soma módulos e respostas, mantém o status mais avançado", () => {
    const local = base({
      status: "concluida",
      completedModuleIds: ["m1"],
      practiceAnswers: { q1: { choice: "A", revealed: true } },
      updatedAt: "2026-11-09T09:00:00Z",
    });
    const remote = base({
      status: "em-andamento",
      completedModuleIds: ["m2"],
      practiceAnswers: { q2: { choice: "B", revealed: false } },
      activeModuleId: "m3",
      updatedAt: "2026-11-09T11:00:00Z",
    });
    const m = mergeTrailProgress(local, remote);
    expect(m.status).toBe("concluida");
    expect(m.completedModuleIds.sort()).toEqual(["m1", "m2"]);
    expect(Object.keys(m.practiceAnswers).sort()).toEqual(["q1", "q2"]);
    expect(m.activeModuleId).toBe("m3");
  });
});
