/** Configuração server-only da importação de provas. */

export function getExamImportAdminEmails(): string[] {
  const raw = process.env["EXAM_IMPORT_ADMIN_EMAILS"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sem allowlist: em ambiente local qualquer usuário autenticado pode importar
 * (modo aberto com aviso na UI). Com allowlist, só e-mails listados.
 */
export function canImportExams(actorEmail: string): {
  allowed: boolean;
  reason: string;
  mode: "allowlist" | "local-open";
} {
  const email = actorEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { allowed: false, reason: "E-mail do usuário inválido.", mode: "allowlist" };
  }
  const list = getExamImportAdminEmails();
  if (!list.length) {
    return {
      allowed: true,
      reason: "Modo local: EXAM_IMPORT_ADMIN_EMAILS vazio — qualquer usuário logado pode importar.",
      mode: "local-open",
    };
  }
  if (list.includes(email)) {
    return { allowed: true, reason: "E-mail autorizado.", mode: "allowlist" };
  }
  return {
    allowed: false,
    reason: "Seu e-mail não está em EXAM_IMPORT_ADMIN_EMAILS.",
    mode: "allowlist",
  };
}

export function getExamImportStorageDir(): string {
  return process.env["EXAM_IMPORT_STORAGE_DIR"]?.trim() || ".data/exam-imports";
}
