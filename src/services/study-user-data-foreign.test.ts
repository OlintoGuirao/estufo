/**
 * Dados de outra conta que ficaram no navegador nunca entram nesta conta
 * (antes eram gravados como "<id>__<dono>").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Banco simulado: linha "foreign" é de outra conta (RLS esconde, PK conflita). */
const rows = new Map<string, { owner: string }>();
const inserted: string[] = [];

function table() {
  let mode: "update" | "upsert" = "update";
  let payload: { id: string; device_id: string } | null = null;
  let filterId = "";
  const api = {
    update(row: { id: string; device_id: string }) {
      mode = "update";
      payload = row;
      return api;
    },
    upsert(row: { id: string; device_id: string }) {
      mode = "upsert";
      payload = row;
      return api;
    },
    eq(_col: string, v: string) {
      filterId = v;
      return api;
    },
    async select() {
      const own = rows.get(mode === "update" ? filterId : payload!.id);
      if (mode === "update") {
        return { data: own && own.owner === payload!.device_id ? [{ id: filterId }] : [], error: null };
      }
      if (own) return { data: [], error: null }; // ON CONFLICT DO NOTHING
      rows.set(payload!.id, { owner: payload!.device_id });
      inserted.push(payload!.id);
      return { data: [{ id: payload!.id }], error: null };
    },
  };
  return api;
}

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: () => table(),
    auth: { getSession: async () => ({ data: { session: { user: { id: "fabiola" } } } }) },
  }),
}));

beforeEach(() => {
  rows.clear();
  inserted.length = 0;
});

describe("upsertOwnedById", () => {
  it("pula item cujo id é de outra conta e NÃO cria cópia '__'", async () => {
    rows.set("nota_do_juninho", { owner: "user_juninho" });
    const { upsertOwnedById } = await import("./study-user-data-db");
    await upsertOwnedById("user_error_notes", [
      { id: "nota_do_juninho", device_id: "x" },
      { id: "nota_da_fabiola", device_id: "x" },
    ]);
    expect(inserted).toEqual(["nota_da_fabiola"]);
    expect([...rows.keys()].some((k) => k.includes("__"))).toBe(false);
  });

  it("cópias '__' antigas não são reenviadas", async () => {
    const { upsertOwnedById } = await import("./study-user-data-db");
    await upsertOwnedById("user_error_notes", [{ id: "abc__027f71e3ac", device_id: "x" }]);
    expect(inserted).toEqual([]);
  });

  it("isForeignCopyId", async () => {
    const { isForeignCopyId } = await import("./study-user-data-db");
    expect(isForeignCopyId("trail_mw0u2rp1__027f71e3ac")).toBe(true);
    expect(isForeignCopyId("k3j9x0ab")).toBe(false);
  });
});
