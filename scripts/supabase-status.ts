import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "./load-env";

loadEnv();

const url = process.env["VITE_SUPABASE_URL"]?.trim() ?? "";
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";

if (!url || !key) {
  console.log(JSON.stringify({ ok: false, message: "VITE_SUPABASE_URL ou KEY ausentes" }, null, 2));
  process.exit(1);
}

const sb = createClient(url, key);
const host = new URL(url).host;
const session = await sb.auth.getSession();

const tables = ["contests", "subjects", "topics", "questions", "users", "exam_imports"] as const;
const tableStatus: Record<string, string> = {};
for (const t of tables) {
  const r = await sb.from(t).select("*", { count: "exact", head: true });
  tableStatus[t] = r.error ? `ERR: ${r.error.message}` : `ok (count=${r.count ?? 0})`;
}

console.log(
  JSON.stringify(
    {
      host,
      authOk: !session.error,
      authError: session.error?.message ?? null,
      tables: tableStatus,
    },
    null,
    2,
  ),
);

process.exit(session.error ? 1 : 0);
