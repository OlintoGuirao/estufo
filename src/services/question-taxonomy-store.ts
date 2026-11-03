/**
 * Matérias e assuntos cadastráveis pelo usuário (não hardcoded).
 * Persistência local — alinhada ao mock atual do app.
 */

const KEY = "estufoo.question-taxonomy.v1";

export type TaxonomyTopic = { id: string; name: string };
export type TaxonomySubject = { id: string; name: string; topics: TaxonomyTopic[] };

export type QuestionTaxonomy = {
  subjects: TaxonomySubject[];
  updatedAt: string;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function empty(): QuestionTaxonomy {
  return { subjects: [], updatedAt: new Date().toISOString() };
}

function read(): QuestionTaxonomy {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as QuestionTaxonomy;
    if (!parsed?.subjects || !Array.isArray(parsed.subjects)) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(data: QuestionTaxonomy): QuestionTaxonomy {
  const next = { ...data, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }
  return next;
}

export const questionTaxonomyStore = {
  list(): QuestionTaxonomy {
    return read();
  },

  ensureSubject(name: string): TaxonomySubject {
    const n = name.trim();
    if (!n) throw new Error("Nome da matéria é obrigatório.");
    const tax = read();
    const found = tax.subjects.find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (found) return found;
    const subject: TaxonomySubject = { id: uid("sub"), name: n, topics: [] };
    write({ ...tax, subjects: [...tax.subjects, subject] });
    return subject;
  },

  ensureTopic(subjectName: string, topicName: string): TaxonomyTopic {
    const t = topicName.trim();
    if (!t) throw new Error("Nome do assunto é obrigatório.");
    const subject = questionTaxonomyStore.ensureSubject(subjectName);
    const tax = read();
    const idx = tax.subjects.findIndex((s) => s.id === subject.id);
    if (idx < 0) throw new Error("Matéria não encontrada.");
    const current = tax.subjects[idx]!;
    const found = current.topics.find((x) => x.name.toLowerCase() === t.toLowerCase());
    if (found) return found;
    const topic: TaxonomyTopic = { id: uid("top"), name: t };
    const subjects = [...tax.subjects];
    subjects[idx] = { ...current, topics: [...current.topics, topic] };
    write({ ...tax, subjects });
    return topic;
  },

  renameSubject(id: string, name: string): void {
    const n = name.trim();
    if (!n) return;
    const tax = read();
    write({
      ...tax,
      subjects: tax.subjects.map((s) => (s.id === id ? { ...s, name: n } : s)),
    });
  },

  /** Seeds a partir de matérias já usadas em questões/importações (não sobrescreve). */
  mergeNames(pairs: { subject: string; topic?: string }[]): QuestionTaxonomy {
    for (const p of pairs) {
      if (!p.subject.trim()) continue;
      questionTaxonomyStore.ensureSubject(p.subject);
      if (p.topic?.trim()) questionTaxonomyStore.ensureTopic(p.subject, p.topic);
    }
    return read();
  },

  slugify,
};
