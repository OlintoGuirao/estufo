import { describe, expect, it } from "vitest";
import { mergeMindMaps } from "./mind-pack-sync";
import type { MindMap } from "@/types";

const map = (id: string, updatedAt: string, title = id) =>
  ({ id, title, subject: "Direito", updatedAt, nodeCount: 0, nodes: [], links: [] }) as unknown as MindMap;

describe("mergeMindMaps", () => {
  it("traz o que foi editado no celular (banco mais novo)", () => {
    const r = mergeMindMaps(
      [map("a", "2026-11-01T10:00:00Z", "velho")],
      [map("a", "2026-11-08T10:00:00Z", "novo do celular")],
      new Set(["a"]),
    );
    expect(r.merged[0]!.title).toBe("novo do celular");
    expect(r.changed).toBe(true);
    expect(r.toUpload).toHaveLength(0);
  });

  it("mapa criado em outro aparelho aparece aqui", () => {
    const r = mergeMindMaps([], [map("b", "2026-11-08T10:00:00Z")], new Set());
    expect(r.merged.map((m) => m.id)).toEqual(["b"]);
  });

  it("edição local mais nova é enviada ao banco", () => {
    const r = mergeMindMaps(
      [map("a", "2026-11-09T10:00:00Z")],
      [map("a", "2026-11-08T10:00:00Z")],
      new Set(["a"]),
    );
    expect(r.toUpload.map((m) => m.id)).toEqual(["a"]);
  });

  it("apagado em outro aparelho some daqui; nunca enviado fica e sobe", () => {
    const r = mergeMindMaps(
      [map("apagado", "2026-11-01T00:00:00Z"), map("novo-local", "2026-11-02T00:00:00Z")],
      [],
      new Set(["apagado"]),
    );
    expect(r.merged.map((m) => m.id)).toEqual(["novo-local"]);
    expect(r.toUpload.map((m) => m.id)).toEqual(["novo-local"]);
  });
});
