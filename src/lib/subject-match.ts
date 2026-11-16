/**
 * Compara nomes de matéria da trilha/edital com os do banco e das provas oficiais.
 * Ex.: "Português" ↔ "Língua Portuguesa"; "Matemática" ↔ "Matemática e Raciocínio Lógico".
 */

export function normSubject(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Famílias canônicas — se dois nomes caem na mesma, batem. */
const FAMILIES: RegExp[] = [
  /lingua\s*portuguesa|^portuguesa?$/,
  /^direito\s+penal(?!\s+processual)/,
  /processual\s+penal/,
  /processual\s+civil/,
  /constitucional/,
  /administrativo/,
  /legisla(cao)?\s*(especial|interna)?|normas?\s+da\s+corregedoria/,
  /atualidades/,
  /informa(tica)?/,
  /matematic|raciocin|logic/,
];

function familyIndex(n: string): number {
  return FAMILIES.findIndex((re) => re.test(n));
}

/** True se o rótulo da trilha corresponde à matéria da questão. */
export function subjectsMatch(label: string, questionSubject: string): boolean {
  const a = normSubject(label);
  const b = normSubject(questionSubject);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const fa = familyIndex(a);
  const fb = familyIndex(b);
  if (fa >= 0 && fa === fb) return true;

  // Tokens fortes (ex.: "penal" sozinho é frágil; exige overlap maior).
  const tokens = (s: string) =>
    s
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5 && !["direito", "lingua", "conhecimentos"].includes(t));
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  return tb.some((t) => ta.has(t));
}

/** Algum rótulo pedido casa com a matéria da questão. */
export function matchesAnySubject(questionSubject: string, labels: string[]): boolean {
  return labels.some((l) => subjectsMatch(l, questionSubject));
}
