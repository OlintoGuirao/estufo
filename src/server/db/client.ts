import pg from "pg";
import { getDatabaseUrl, shouldUseSsl } from "./config";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Defina no .env (sem prefixo VITE_) e reinicie o servidor.",
    );
  }
  if (!pool) {
    const useSsl = shouldUseSsl(url);
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      // Supabase: TLS obrigatório; certificados gerenciados — ok rejeitar off em dev.
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    pool.on("error", (err) => {
      console.error("[db] erro inesperado no pool:", err.message);
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
  serverVersion?: string;
  database?: string;
}> {
  const url = getDatabaseUrl();
  if (!url) {
    return {
      configured: false,
      connected: false,
      message: "DATABASE_URL ausente — app continua no mock/localStorage.",
    };
  }
  try {
    const r = await query<{ v: string; db: string }>(
      "select version() as v, current_database() as db",
    );
    const row = r.rows[0];
    return {
      configured: true,
      connected: true,
      message: "PostgreSQL conectado.",
      serverVersion: row?.v?.split(",")[0] ?? "ok",
      ...(row?.db ? { database: row.db } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      configured: true,
      connected: false,
      message: `Falha ao conectar: ${msg}`,
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
