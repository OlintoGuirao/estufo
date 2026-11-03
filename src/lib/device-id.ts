const KEY = "estufoo.device-id";

/** ID estável deste browser (até limpar storage). Usado para sync do diagnóstico no Supabase. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `dev_${crypto.randomUUID()}`
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `dev_ephemeral_${Date.now().toString(36)}`;
  }
}
