import { plainTextToSafeHtml, sanitizeQuestionHtml } from "./sanitize";
import type {
  ProviderMatchQuality,
  ProviderQuestionDto,
  ProviderQuestionFilters,
  UpstreamListResponse,
  UpstreamQuestionRaw,
} from "./types";

export const TJSP_ESCREVENTE_PRESET = {
  board: "VUNESP",
  institution: "Tribunal de Justiça de São Paulo",
  institutionAliases: [
    "tjsp",
    "tribunal de justiça de são paulo",
    "tribunal de justica de sao paulo",
    "tj-sp",
    "tj sp",
  ],
  role: "Escrevente Técnico Judiciário",
  roleAliases: ["escrevente tecnico judiciario", "escrevente técnico judiciário", "escrevente"],
  label: "VUNESP · TJSP · Escrevente Técnico Judiciário",
} as const;

export function externalAppId(externalId: string): string {
  return externalId.startsWith("ext:") ? externalId : `ext:${externalId}`;
}

export function stripExternalPrefix(id: string): string {
  return id.startsWith("ext:") ? id.slice(4) : id;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  const h = norm(haystack);
  return needles.some((n) => h.includes(norm(n)));
}

export function evaluateMatchQuality(
  filters: ProviderQuestionFilters,
  items: UpstreamQuestionRaw[],
): { matchQuality: ProviderMatchQuality; matchNote: string | null } {
  const wantBoard = filters.board ? norm(filters.board) : "";
  const wantInst = filters.institution ? norm(filters.institution) : "";
  const wantRole = filters.role ? norm(filters.role) : "";

  if (!items.length) {
    return {
      matchQuality: "unknown",
      matchNote:
        "Nenhum item retornado para os filtros. A banca sozinha (ex.: VUNESP) não garante a prova do TJSP Escrevente.",
    };
  }

  let exact = 0;
  let partial = 0;
  for (const q of items) {
    const boardOk = !wantBoard || norm(q.board) === wantBoard || norm(q.board).includes(wantBoard);
    const inst = q.institution ?? q.organ ?? "";
    const role = q.role ?? q.position ?? "";
    // Compara metadados do ITEM com o filtro (não o inverso — evita falso "exact").
    const instOk =
      !wantInst || includesAny(inst, [wantInst, ...TJSP_ESCREVENTE_PRESET.institutionAliases]);
    const roleOk =
      !wantRole || includesAny(role, [wantRole, ...TJSP_ESCREVENTE_PRESET.roleAliases]);

    if (boardOk && instOk && roleOk) exact += 1;
    else if (boardOk) partial += 1;
  }

  if (exact === items.length) {
    return {
      matchQuality: "exact",
      matchNote: "Metadados de banca, órgão e cargo batem com o filtro solicitado.",
    };
  }
  if (exact > 0 || partial > 0) {
    return {
      matchQuality: "partial",
      matchNote:
        "A API não garantiu correspondência exata de órgão/cargo em todos os itens. Banca VUNESP sozinha não identifica a prova do TJSP Escrevente — revise os metadados de cada questão.",
    };
  }
  return {
    matchQuality: "unknown",
    matchNote:
      "Não foi possível confirmar órgão/cargo nos metadados retornados. Não trate o resultado como a prova alvo.",
  };
}

export function normalizeUpstreamQuestion(
  raw: UpstreamQuestionRaw,
  userState?: {
    favorite?: boolean;
    markedForReview?: boolean;
    answered?: { choice: string; correct: boolean } | null;
  },
): ProviderQuestionDto {
  const externalId = String(raw.id);
  const statementRaw = raw.statementHtml ?? raw.statement ?? "";
  const supportRaw = raw.supportHtml ?? raw.supportText ?? "";
  const statementHtml = statementRaw.includes("<")
    ? sanitizeQuestionHtml(statementRaw)
    : plainTextToSafeHtml(statementRaw);
  const supportHtml = supportRaw
    ? supportRaw.includes("<")
      ? sanitizeQuestionHtml(supportRaw)
      : plainTextToSafeHtml(supportRaw)
    : undefined;

  const alternatives = (raw.alternatives ?? []).map((a) => {
    const text = a.html ?? a.text ?? "";
    return {
      key: String(a.key).toUpperCase().slice(0, 1),
      html: text.includes("<") ? sanitizeQuestionHtml(text) : plainTextToSafeHtml(text),
    };
  });

  const yearNum = raw.year == null || raw.year === "" ? null : Number(raw.year);
  const difficultyRaw = norm(raw.difficulty ?? "");
  const difficulty =
    difficultyRaw === "facil" || difficultyRaw === "fácil"
      ? ("facil" as const)
      : difficultyRaw === "dificil" || difficultyRaw === "difícil"
        ? ("dificil" as const)
        : difficultyRaw === "media" || difficultyRaw === "média"
          ? ("media" as const)
          : null;

  const images = (raw.images ?? [])
    .filter((img) => typeof img.url === "string" && /^https:\/\//i.test(img.url))
    .map((img) => ({
      url: img.url,
      alt: sanitizeQuestionHtml(img.alt ?? "Imagem da questão").replace(/<[^>]+>/g, ""),
    }));

  const dto: ProviderQuestionDto = {
    id: externalAppId(externalId),
    externalId,
    statementHtml,
    alternatives,
    images,
    board: raw.board ?? "",
    year: Number.isFinite(yearNum) ? yearNum : null,
    institution: raw.institution ?? raw.organ ?? "",
    role: raw.role ?? raw.position ?? "",
    examName: raw.examName ?? raw.exam ?? "",
    subject: raw.subject ?? "",
    topic: raw.topic ?? "",
    difficulty,
    source: raw.source ?? raw.attribution ?? "Provedor externo",
    annulled: Boolean(raw.annulled),
    hasAnswerKey: raw.hasAnswerKey !== false,
    outdated: Boolean(raw.outdated),
    favorite: Boolean(userState?.favorite),
    markedForReview: Boolean(userState?.markedForReview),
    answered: userState?.answered ?? null,
  };
  if (supportHtml) dto.supportHtml = supportHtml;
  return dto;
}

export function normalizeListResponse(
  raw: UpstreamListResponse,
  filters: ProviderQuestionFilters,
  userStates: Record<
    string,
    {
      favorite?: boolean;
      markedForReview?: boolean;
      answered?: { choice: string; correct: boolean } | null;
    }
  >,
  providerMatch?: { matchQuality: ProviderMatchQuality; matchNote: string | null },
): Omit<import("./types").ProviderListResult, "providerConfigured" | "providerName"> {
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const page = Number(raw.page ?? filters.page ?? 1);
  const pageSize = Number(raw.pageSize ?? filters.pageSize ?? 10);
  const total = Number(raw.total ?? itemsRaw.length);
  const evaluated = providerMatch ?? evaluateMatchQuality(filters, itemsRaw);

  return {
    items: itemsRaw.map((q) => normalizeUpstreamQuestion(q, userStates[String(q.id)])),
    total,
    page,
    pageSize,
    matchQuality: raw.matchQuality ?? evaluated.matchQuality,
    matchNote: raw.matchNote ?? evaluated.matchNote,
  };
}

export function applyClientSideFilterHints(
  filters: ProviderQuestionFilters | Record<string, string | number | boolean>,
): ProviderQuestionFilters {
  const page = Math.max(1, Number(filters["page"] ?? 1));
  const pageSize = Math.min(20, Math.max(1, Number(filters["pageSize"] ?? 10)));
  const next: ProviderQuestionFilters = { page, pageSize };
  if (filters["board"]) next.board = String(filters["board"]);
  if (filters["institution"]) next.institution = String(filters["institution"]);
  if (filters["role"]) next.role = String(filters["role"]);
  if (
    filters["year"] != null &&
    filters["year"] !== "" &&
    Number.isFinite(Number(filters["year"]))
  ) {
    next.year = Number(filters["year"]);
  }
  if (filters["subject"]) next.subject = String(filters["subject"]);
  if (filters["topic"]) next.topic = String(filters["topic"]);
  if (filters["requireAnswerKey"]) next.requireAnswerKey = true;
  return next;
}
