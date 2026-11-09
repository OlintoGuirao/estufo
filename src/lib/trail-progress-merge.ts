import type {
  TrailProfessorChatMessage,
  TrailWeekProgress,
  TrailWeekStudyStatus,
} from "@/types/trail-progress";

/**
 * Junta o progresso de uma semana da trilha vindo de dois aparelhos
 * (cópia local × banco). Nada se perde: módulos concluídos e respostas
 * somam, e a conversa com o professor reúne as mensagens dos dois lados.
 */

const STATUS_RANK: Record<TrailWeekStudyStatus, number> = {
  pendente: 0,
  "em-andamento": 1,
  concluida: 2,
};

const CHAT_LIMIT = 40;

function same(a: TrailProfessorChatMessage, b: TrailProfessorChatMessage): boolean {
  return a.role === b.role && a.text.trim() === b.text.trim();
}

/** Conversa: parte em comum + o que só existe no mais antigo + o que só existe no mais novo. */
export function mergeChat(
  older: TrailProfessorChatMessage[],
  newer: TrailProfessorChatMessage[],
): TrailProfessorChatMessage[] {
  let common = 0;
  while (common < older.length && common < newer.length && same(older[common]!, newer[common]!)) {
    common++;
  }
  const out = [...newer.slice(0, common)];
  for (const m of [...older.slice(common), ...newer.slice(common)]) {
    if (!out.some((x) => same(x, m))) out.push(m);
  }
  return out.slice(-CHAT_LIMIT);
}

export function mergeTrailProgress(
  a: TrailWeekProgress,
  b: TrailWeekProgress,
): TrailWeekProgress {
  const [older, newer] =
    new Date(a.updatedAt).getTime() <= new Date(b.updatedAt).getTime() ? [a, b] : [b, a];
  const status =
    STATUS_RANK[older.status] > STATUS_RANK[newer.status] ? older.status : newer.status;
  return {
    ...older,
    ...newer,
    status,
    completedModuleIds: [...new Set([...older.completedModuleIds, ...newer.completedModuleIds])],
    practiceAnswers: { ...older.practiceAnswers, ...newer.practiceAnswers },
    chat: mergeChat(older.chat, newer.chat),
    topicIds: newer.topicIds?.length ? newer.topicIds : (older.topicIds ?? []),
    updatedAt: newer.updatedAt,
  };
}

/** Mesma coisa, só que comparando o conteúdo (para saber se precisa reenviar ao banco). */
export function sameTrailProgress(a: TrailWeekProgress, b: TrailWeekProgress): boolean {
  const pick = (p: TrailWeekProgress) =>
    JSON.stringify([
      p.status,
      p.activeModuleId,
      [...p.completedModuleIds].sort(),
      p.practiceAnswers,
      p.chat,
    ]);
  return pick(a) === pick(b);
}
