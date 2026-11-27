/**
 * Caso Fabiola (27/11): uma trilha de OUTRA conta ficou no navegador e foi
 * gravada na conta dela como "<id>__<dono>". A trilha real (com 13 dias
 * concluídos) ficou escondida. O app nunca pode abrir nem gravar trilha alheia.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalTrail } from "@/types/approval-trail";

const foreign = new Set<string>();
const db = {
  loadLatestTrailMeta: vi.fn(),
  loadLatestTrail: vi.fn(),
  upsertTrail: vi.fn(),
};

vi.mock("@/lib/study-account-sync", () => ({ waitForAccountStudySync: async () => {} }));
vi.mock("./approval-trail-db", async () => {
  const real = await vi.importActual<typeof import("./approval-trail-db")>("./approval-trail-db");
  return {
    approvalTrailDb: db,
    pickOwnTrailRow: real.pickOwnTrailRow,
    isForeignTrail: (id: string) => foreign.has(id),
    syncApprovalTrail: vi.fn(),
    syncApprovalTrailNow: vi.fn(async () => {}),
  };
});

const trail = (id: string, updatedAt: string): ApprovalTrail =>
  ({
    id,
    createdAt: updatedAt,
    updatedAt,
    fileName: "edital.pdf",
    contestName: "TJSP",
    organ: "TJSP",
    role: "Escrevente",
    board: "VUNESP",
    examDate: null,
    summary: "",
    subjects: [],
    weeks: [],
    warnings: [],
    sourceTextChars: 0,
    mocked: false,
  }) as unknown as ApprovalTrail;

beforeEach(() => {
  vi.resetModules();
  foreign.clear();
  localStorage.clear();
  db.loadLatestTrailMeta.mockReset();
  db.loadLatestTrail.mockReset();
  db.upsertTrail.mockReset();
});

describe("pickOwnTrailRow", () => {
  it("ignora as cópias '<id>__<dono>' gravadas por engano", async () => {
    const { pickOwnTrailRow } = await vi.importActual<typeof import("./approval-trail-db")>("./approval-trail-db");
    const rows = [
      { id: "trail_mw0u2rp1__027f71e3ac", updated_at: "2026-11-27T21:08:49Z" },
      { id: "trail_mw86i4sb", updated_at: "2026-11-27T01:21:08Z" },
    ];
    expect(pickOwnTrailRow(rows)?.id).toBe("trail_mw86i4sb");
  });
});

describe("hydrate com trilha de outra conta no navegador", () => {
  it("abre a trilha real da conta quando o banco recusa a trilha local", async () => {
    const real = trail("trail_mw86i4sb", "2026-11-27T01:21:08.991Z");
    const alheia = trail("trail_mw0u2rp1", "2026-11-27T21:08:49.137Z"); // mais nova
    localStorage.setItem("estufoo.approval-trail.v1", JSON.stringify(alheia));
    db.loadLatestTrailMeta.mockResolvedValue({ id: real.id, updatedAt: real.updatedAt });
    db.loadLatestTrail.mockResolvedValue(real);
    db.upsertTrail.mockImplementation(async (t: ApprovalTrail) => {
      foreign.add(t.id); // banco: id pertence a outra conta
      throw new Error("outra conta");
    });
    const { approvalTrailStore } = await import("./approval-trail-store");
    const got = await approvalTrailStore.hydrate();
    expect(got?.id).toBe("trail_mw86i4sb");
  });

  it("trilha local já marcada como alheia nem é considerada", async () => {
    const real = trail("trail_mw86i4sb", "2026-11-27T01:21:08.991Z");
    localStorage.setItem("estufoo.approval-trail.v1", JSON.stringify(trail("trail_mw0u2rp1", "2026-11-27T21:08:49Z")));
    foreign.add("trail_mw0u2rp1");
    db.loadLatestTrailMeta.mockResolvedValue({ id: real.id, updatedAt: real.updatedAt });
    db.loadLatestTrail.mockResolvedValue(real);
    const { approvalTrailStore } = await import("./approval-trail-store");
    expect((await approvalTrailStore.hydrate())?.id).toBe("trail_mw86i4sb");
    expect(db.upsertTrail).not.toHaveBeenCalled();
  });

  it("trilha local nova e legítima (o banco aceita) continua aberta", async () => {
    const antiga = trail("trail_antiga", "2026-11-01T00:00:00Z");
    const nova = trail("trail_nova", "2026-11-27T22:00:00Z");
    localStorage.setItem("estufoo.approval-trail.v1", JSON.stringify(nova));
    db.loadLatestTrailMeta.mockResolvedValue({ id: antiga.id, updatedAt: antiga.updatedAt });
    db.loadLatestTrail.mockResolvedValue(antiga);
    db.upsertTrail.mockResolvedValue(undefined);
    const { approvalTrailStore } = await import("./approval-trail-store");
    expect((await approvalTrailStore.hydrate())?.id).toBe("trail_nova");
  });
});
