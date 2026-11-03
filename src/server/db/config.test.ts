import { afterEach, describe, expect, it } from "vitest";
import { shouldUseSsl } from "./config";

describe("shouldUseSsl", () => {
  const prev = process.env["DATABASE_SSL"];

  afterEach(() => {
    if (prev === undefined) delete process.env["DATABASE_SSL"];
    else process.env["DATABASE_SSL"] = prev;
  });

  it("detecta hosts Supabase", () => {
    delete process.env["DATABASE_SSL"];
    expect(
      shouldUseSsl(
        "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(true);
    expect(shouldUseSsl("postgresql://postgres:x@db.abc.supabase.co:5432/postgres")).toBe(true);
  });

  it("respeita override e localhost", () => {
    delete process.env["DATABASE_SSL"];
    expect(shouldUseSsl("postgresql://postgres:x@localhost:5432/estufoo")).toBe(false);
    process.env["DATABASE_SSL"] = "true";
    expect(shouldUseSsl("postgresql://postgres:x@localhost:5432/estufoo")).toBe(true);
  });
});
