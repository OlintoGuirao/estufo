import { errorFromHttpStatus, QuestionProviderError, redactSecrets } from "./errors";
import type {
  QuestionProvider,
  ProviderQuestionFilters,
  UpstreamListResponse,
  UpstreamQuestionRaw,
} from "./types";

type HttpProviderOptions = {
  baseUrl: string;
  apiKey: string;
  name: string;
  fetchImpl?: typeof fetch;
};

/**
 * Adaptador HTTP genérico para um fornecedor licenciado.
 * Contrato esperado: docs/question-provider.md
 * Não faz varredura de páginas nem cache de enunciados.
 */
export class HttpLicensedQuestionProvider implements QuestionProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpProviderOptions) {
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async list(filters: ProviderQuestionFilters) {
    const qs = new URLSearchParams();
    if (filters.board) qs.set("board", filters.board);
    if (filters.institution) qs.set("institution", filters.institution);
    if (filters.role) qs.set("role", filters.role);
    if (filters.year != null) qs.set("year", String(filters.year));
    if (filters.subject) qs.set("subject", filters.subject);
    if (filters.topic) qs.set("topic", filters.topic);
    if (filters.requireAnswerKey) qs.set("hasAnswerKey", "true");
    qs.set("page", String(filters.page ?? 1));
    qs.set("pageSize", String(Math.min(filters.pageSize ?? 10, 20)));

    const raw = await this.requestJson<UpstreamListResponse>("GET", `/questions?${qs.toString()}`);
    return {
      raw,
      matchQuality: raw.matchQuality ?? ("unknown" as const),
      matchNote: raw.matchNote ?? null,
    };
  }

  async get(externalId: string): Promise<UpstreamQuestionRaw> {
    return this.requestJson<UpstreamQuestionRaw>(
      "GET",
      `/questions/${encodeURIComponent(externalId)}`,
    );
  }

  async checkAnswer(externalId: string, choice: string) {
    return this.requestJson<{
      correct: boolean;
      correctKey?: string | null;
      explanation?: string | null;
      explanationHtml?: string | null;
      annulled?: boolean;
      source?: string;
    }>("POST", `/questions/${encodeURIComponent(externalId)}/check`, { choice });
  }

  private async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : null,
        cache: "no-store",
      });
    } catch {
      throw new QuestionProviderError(
        "temporary",
        "Falha de rede ao contatar o provedor.",
        503,
        true,
      );
    }

    if (!res.ok) {
      // Não logar corpo/headers (podem ecoar a chave). Apenas status.
      throw errorFromHttpStatus(res.status);
    }

    try {
      return (await res.json()) as T;
    } catch (e) {
      const msg = e instanceof Error ? redactSecrets(e.message) : "invalid_response";
      throw new QuestionProviderError(
        "invalid_response",
        `Resposta inválida do provedor (${msg}).`,
        502,
        false,
      );
    }
  }
}
