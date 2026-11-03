import { describe, expect, it, vi } from "vitest";
import { HttpLicensedQuestionProvider } from "./http-provider";
import { QuestionProviderError, redactSecrets } from "./errors";
import { sanitizeQuestionHtml } from "./sanitize";

describe("redactSecrets", () => {
  it("não deixa Bearer token nem api key visíveis", () => {
    const raw = 'Authorization: Bearer super-secret-key QUESTIONS_API_KEY=abc123 api_key:"xyz"';
    const out = redactSecrets(raw);
    expect(out).not.toContain("super-secret-key");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("xyz");
    expect(out).toContain("[REDACTED]");
  });
});

describe("sanitizeQuestionHtml", () => {
  it("remove script e handlers", () => {
    const html = sanitizeQuestionHtml(
      '<p onclick="x">Oi</p><script>evil()</script><img src="https://a.com/x.png" onerror="x">',
    );
    expect(html).toContain("<p");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });
});

describe("HttpLicensedQuestionProvider", () => {
  it("lista com Authorization e sem cache", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/questions?");
      expect(String(url)).toContain("board=VUNESP");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key-not-for-prod" });
      expect(init?.cache).toBe("no-store");
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const provider = new HttpLicensedQuestionProvider({
      baseUrl: "https://provider.example",
      apiKey: "test-key-not-for-prod",
      name: "test",
      fetchImpl,
    });
    const res = await provider.list({ board: "VUNESP", page: 1, pageSize: 10 });
    expect(res.raw.total).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("mapeia 429 para rate_limited", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("nope", { status: 429 }),
    ) as unknown as typeof fetch;
    const provider = new HttpLicensedQuestionProvider({
      baseUrl: "https://provider.example",
      apiKey: "k",
      name: "test",
      fetchImpl,
    });
    await expect(provider.list({})).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    } satisfies Partial<QuestionProviderError>);
  });

  it("mapeia 401/403/503", async () => {
    for (const [status, code] of [
      [401, "unauthorized"],
      [403, "forbidden"],
      [503, "temporary"],
    ] as const) {
      const fetchImpl = vi.fn(async () => new Response("", { status })) as unknown as typeof fetch;
      const provider = new HttpLicensedQuestionProvider({
        baseUrl: "https://provider.example",
        apiKey: "k",
        name: "test",
        fetchImpl,
      });
      await expect(provider.get("1")).rejects.toMatchObject({ code });
    }
  });

  it("não inclui a chave em erros de JSON inválido", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("not-json", { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = new HttpLicensedQuestionProvider({
      baseUrl: "https://provider.example",
      apiKey: "VERY_SECRET_KEY_VALUE",
      name: "test",
      fetchImpl,
    });
    try {
      await provider.get("1");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(QuestionProviderError);
      expect(String((e as Error).message)).not.toContain("VERY_SECRET_KEY_VALUE");
    }
  });
});
