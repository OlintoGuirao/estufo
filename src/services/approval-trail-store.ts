import type { ApprovalTrail } from "@/types/approval-trail";
import {
  approvalTrailDb,
  syncApprovalTrail,
  syncApprovalTrailNow,
} from "./approval-trail-db";

const KEY = "estufoo.approval-trail.v1";

let memory: ApprovalTrail | null = null;

function explanationCount(trail: ApprovalTrail): number {
  let n = 0;
  for (const s of trail.subjects) {
    for (const t of s.topics) {
      if (t.explanation?.trim()) n += 1;
    }
  }
  return n;
}

function read(): ApprovalTrail | null {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    return JSON.parse(raw) as ApprovalTrail;
  } catch {
    return memory;
  }
}

function write(trail: ApprovalTrail | null): void {
  memory = trail;
  if (typeof window === "undefined") return;
  try {
    if (!trail) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    /* quota */
  }
}

export const approvalTrailStore = {
  get(): ApprovalTrail | null {
    return read();
  },
  save(trail: ApprovalTrail): ApprovalTrail {
    const next = { ...trail, updatedAt: new Date().toISOString() };
    write(next);
    syncApprovalTrail(next);
    return next;
  },

  /** Salva e aguarda upsert no banco (material gerado pela IA). */
  async saveNow(trail: ApprovalTrail): Promise<ApprovalTrail> {
    const next = { ...trail, updatedAt: new Date().toISOString() };
    write(next);
    try {
      await syncApprovalTrailNow(next);
    } catch (err) {
      console.warn("[approval-trail] sync imediato falhou", err);
    }
    return next;
  },
  clear(): void {
    const prev = read();
    write(null);
    if (prev?.id) {
      void approvalTrailDb.deleteTrail(prev.id).catch(() => {});
    }
  },
  updateTopicStatus(
    subjectId: string,
    topicId: string,
    status: ApprovalTrail["subjects"][0]["topics"][0]["status"],
  ): ApprovalTrail | null {
    const t = read();
    if (!t) return null;
    const subjects = t.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map((tp) => (tp.id === topicId ? { ...tp, status } : tp)),
      };
    });
    return approvalTrailStore.save({ ...t, subjects });
  },

  /** Atualiza status de várias etapas (ex.: ao concluir o dia no cronograma). */
  updateTopicsStatusByIds(
    topicIds: string[],
    status: ApprovalTrail["subjects"][0]["topics"][0]["status"],
  ): ApprovalTrail | null {
    const t = read();
    if (!t || !topicIds.length) return t;
    const set = new Set(topicIds);
    const subjects = t.subjects.map((s) => ({
      ...s,
      topics: s.topics.map((tp) => (set.has(tp.id) ? { ...tp, status } : tp)),
    }));
    return approvalTrailStore.save({ ...t, subjects });
  },

  applyTopicExplanations(
    subjectId: string,
    items: { id: string; explanation: string }[],
  ): ApprovalTrail | null {
    const t = read();
    if (!t) return null;
    const map = new Map(items.map((i) => [i.id, i.explanation]));
    const subjects = t.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map((tp) => {
          const explanation = map.get(tp.id);
          return explanation ? { ...tp, explanation } : tp;
        }),
      };
    });
    return approvalTrailStore.save({ ...t, subjects });
  },

  addCustomTopic(
    subjectId: string,
    input?: { name?: string; notes?: string },
  ): ApprovalTrail | null {
    const t = read();
    if (!t) return null;
    const name = (input?.name ?? "").trim() || "Novo assunto";
    const notes =
      (input?.notes ?? "").trim() ||
      "Assunto criado pelo aluno. Gerar material explicando o conceito e como cai na prova.";
    const topicId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `top_${crypto.randomUUID()}`
        : `top_${Date.now().toString(36)}`;
    const artMatch = name.match(/\b(?:art(?:igo)?\.?\s*)(\d{1,4}(?:-[A-Za-z])?)\b/i);
    const subjects = t.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      const topic: ApprovalTrail["subjects"][0]["topics"][0] = {
        id: topicId,
        name,
        weightHint: "media",
        notes,
        status: "pendente",
        kind: artMatch ? "artigo" : "assunto",
        custom: true,
      };
      if (artMatch?.[1]) topic.articleRef = artMatch[1];
      return { ...s, topics: [...s.topics, topic] };
    });
    return approvalTrailStore.save({ ...t, subjects });
  },

  updateTopicName(subjectId: string, topicId: string, name: string): ApprovalTrail | null {
    const t = read();
    if (!t) return null;
    const trimmed = name.trim();
    if (!trimmed) return t;
    const artMatch = trimmed.match(/\b(?:art(?:igo)?\.?\s*)(\d{1,4}(?:-[A-Za-z])?)\b/i);
    const subjects = t.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map((tp) => {
          if (tp.id !== topicId) return tp;
          const next = { ...tp, name: trimmed };
          if (artMatch?.[1]) {
            next.articleRef = artMatch[1];
            next.kind = "artigo";
          }
          // Novo nome → precisa regenerar material
          delete next.explanation;
          return next;
        }),
      };
    });
    return approvalTrailStore.save({ ...t, subjects });
  },

  removeTopic(subjectId: string, topicId: string): ApprovalTrail | null {
    const t = read();
    if (!t) return null;
    const subjects = t.subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.filter((tp) => tp.id !== topicId) };
    });
    return approvalTrailStore.save({ ...t, subjects });
  },

  async hydrate(): Promise<ApprovalTrail | null> {
    try {
      const { waitForAccountStudySync } = await import("@/lib/study-account-sync");
      await waitForAccountStudySync();
    } catch {
      /* ignore */
    }
    const local = read();
    try {
      const remote = await approvalTrailDb.loadLatestTrail();
      if (remote) {
        const localN = local ? explanationCount(local) : 0;
        const remoteN = explanationCount(remote);
        const preferRemote =
          !local ||
          remoteN > localN ||
          (remoteN === localN &&
            new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime());
        if (preferRemote) {
          write(remote);
          return remote;
        }
        await syncApprovalTrailNow(local);
        return local;
      }
    } catch (err) {
      console.warn("[approval-trail] hydrate falhou", err);
    }
    if (local) {
      try {
        await syncApprovalTrailNow(local);
      } catch {
        syncApprovalTrail(local);
      }
      return local;
    }
    return null;
  },
};
