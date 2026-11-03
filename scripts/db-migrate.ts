/**
 * Aplica SQL em db/migrations/*.sql em ordem e registra em schema_migrations.
 * Uso: npm run db:migrate
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "./load-env";
import { closePool, getPool, query, withClient } from "../src/server/db/client";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "db", "migrations");

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedIds(): Promise<Set<string>> {
  const r = await query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");
  return new Set(r.rows.map((x) => x.id));
}

async function main() {
  if (!process.env["DATABASE_URL"]?.trim()) {
    console.error("DATABASE_URL não definida. Configure o .env e tente de novo.");
    process.exit(1);
  }

  // força criação do pool
  getPool();
  await ensureMigrationsTable();
  const done = await appliedIds();
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.log("Nenhuma migration em db/migrations.");
    await closePool();
    return;
  }

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file} …`);
    await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    });
    console.log(`ok    ${file}`);
  }

  console.log("Migrations concluídas.");
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
