/**
 * Executa db/seed.sql. Uso: npm run db:seed
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "./load-env";
import { closePool, getPool, withClient } from "../src/server/db/client";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  if (!process.env["DATABASE_URL"]?.trim()) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }
  getPool();
  const sql = await readFile(path.join(root, "db", "seed.sql"), "utf8");
  console.log("Aplicando seed…");
  await withClient(async (client) => {
    await client.query(sql);
  });
  console.log("Seed ok.");
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
