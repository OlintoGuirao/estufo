import { describe, expect, it } from "vitest";
import { chunkLawText, formatLegalContext, keywordSearch } from "./chunk";
import { isAllowedFonteUrl, pickRelevantExcerpt } from "@/lib/tutor/fonte";
import { buildStudentProfileText } from "@/lib/tutor/student-profile";
import { buildMastigadoMessages } from "@/lib/tutor/prompts";

const LAW = "Preâmbulo da lei de execução fiscal. Art. 1º A execução judicial para cobrança da Dívida Ativa será regida por esta Lei e, subsidiariamente, pelo Código de Processo Civil. Art. 2º Constitui Dívida Ativa da Fazenda Pública aquela definida como tributária ou não tributária. Art. 8º O executado será citado para, no prazo de 5 (cinco) dias, pagar a dívida.";

describe("lei seca", () => {
  const chunks = chunkLawText(LAW, { id: "l6830", name: "Lei 6.830/1980", url: "https://x.gov.br" });

  it("divide por artigo", () => {
    expect(chunks.map((c) => c.article)).toEqual(["Preâmbulo", "Art. 1", "Art. 2", "Art. 8"]);
  });

  it("busca por palavras e prioriza artigo citado", () => {
    expect(keywordSearch(chunks, "prazo para o executado pagar após citado", { limit: 1 })[0]!.article).toBe("Art. 8");
    expect(keywordSearch(chunks, "o que diz o art. 2", { limit: 1 })[0]!.article).toBe("Art. 2");
    expect(formatLegalContext(chunks.slice(1, 2))).toContain("[Lei 6.830/1980 — Art. 1]");
  });

  it("pega o trecho do artigo citado, não o começo da página", () => {
    const big = `${"blá ".repeat(5000)} ${LAW}`;
    const ex = pickRelevantExcerpt(big, "segundo o art. 8 da LEF", 1_000);
    expect(ex).toContain("Art. 8º O executado");
  });
});

describe("allowlist de fontes (SSRF)", () => {
  it("aceita oficiais e bloqueia internos", () => {
    expect(isAllowedFonteUrl("https://www.planalto.gov.br/ccivil_03/leis/l6830.htm")).toBe(true);
    expect(isAllowedFonteUrl("https://api.tjsp.jus.br/Handlers/x")).toBe(true);
    expect(isAllowedFonteUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedFonteUrl("http://localhost:3000/admin")).toBe(false);
    expect(isAllowedFonteUrl("https://evil.com/x.gov.br")).toBe(false);
    expect(isAllowedFonteUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("perfil do aluno", () => {
  it("resume erros e dificuldades", () => {
    const t = buildStudentProfileText({
      errorNotes: [
        { subject: "Português", topic: "Crase" },
        { subject: "Português", topic: "Crase" },
        { subject: "Direito Penal", topic: "Peculato" },
      ],
      difficulties: [{ subject: "Português", topic: "Crase", code: "confundiu", at: "2026-11-01" }],
      currentSubject: "Português",
    });
    expect(t).toContain("Crase (2)");
    expect(t).toContain("confundiu conceitos");
  });
});

describe("mastigado", () => {
  const base = {
    statement: "Enunciado",
    foundationText: "Fundamento",
    alternatives: [{ key: "A", text: "x" }, { key: "B", text: "y" }],
    correctKey: "B",
  };
  it("modo aula manda gabarito só como uso interno", () => {
    const user = buildMastigadoMessages(base)[1]!.content;
    expect(user).toContain("MODO: AULA");
    expect(user).toContain("NUNCA REVELE");
  });
  it("modo correção quando o aluno já respondeu", () => {
    const user = buildMastigadoMessages({ ...base, studentChoice: "A" })[1]!.content;
    expect(user).toContain("MODO: CORREÇÃO");
    expect(user).toContain("O aluno ERROU");
  });
  it("material longo não é mais cortado em 6 mil caracteres", () => {
    const user = buildMastigadoMessages({ ...base, foundationText: "z".repeat(12_000) })[1]!.content;
    expect(user.length).toBeGreaterThan(12_000);
  });
});
