/** Configuração PostgreSQL / Supabase — SOMENTE servidor (sem VITE_). */

export function getDatabaseUrl(): string | null {
  const url = process.env["DATABASE_URL"]?.trim();
  return url || null;
}

export function isDatabaseConfigured(): boolean {
  return !!getDatabaseUrl();
}

/** Supabase (e a maioria dos PG gerenciados) exige TLS. */
export function shouldUseSsl(connectionString: string): boolean {
  const force = process.env["DATABASE_SSL"]?.trim().toLowerCase();
  if (force === "true" || force === "1" || force === "require") return true;
  if (force === "false" || force === "0" || force === "disable") return false;
  const u = connectionString.toLowerCase();
  if (u.includes("sslmode=disable")) return false;
  if (u.includes("sslmode=require") || u.includes("sslmode=verify")) return true;
  return u.includes("supabase.co") || u.includes("pooler.supabase.com");
}
