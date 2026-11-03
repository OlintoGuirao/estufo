import { afterEach, describe, expect, it } from "vitest";
import { canImportExams } from "./config";

describe("canImportExams", () => {
  const prev = process.env["EXAM_IMPORT_ADMIN_EMAILS"];

  afterEach(() => {
    if (prev === undefined) delete process.env["EXAM_IMPORT_ADMIN_EMAILS"];
    else process.env["EXAM_IMPORT_ADMIN_EMAILS"] = prev;
  });

  it("modo local aberto sem allowlist", () => {
    delete process.env["EXAM_IMPORT_ADMIN_EMAILS"];
    const r = canImportExams("aluno@teste.com");
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe("local-open");
  });

  it("respeita allowlist", () => {
    process.env["EXAM_IMPORT_ADMIN_EMAILS"] = "admin@estufoo.app, outro@x.com";
    expect(canImportExams("admin@estufoo.app").allowed).toBe(true);
    expect(canImportExams("aluno@teste.com").allowed).toBe(false);
  });
});
