import { config as loadEnv } from "./load-env";

loadEnv();

// Espelha o client browser para o script Node
process.env["VITE_SUPABASE_URL"] = process.env["VITE_SUPABASE_URL"];
process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

const { createClient } = await import("@supabase/supabase-js");
const url = process.env["VITE_SUPABASE_URL"]!;
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
const sb = createClient(url, key);

const contests = await sb.from("contests").select("id, name").limit(5);
console.log("contests", contests.error?.message ?? contests.data?.length);

const questions = await sb
  .from("questions")
  .select(
    `id, statement, board, year, contest_label, difficulty, source, correct_key,
     subjects ( name ), topics ( name ), question_alternatives ( key, text )`,
  )
  .limit(2);

if (questions.error) {
  console.log("questions ERR", questions.error.message, questions.error.details, questions.error.hint);
} else {
  const row = questions.data?.[0] as Record<string, unknown> | undefined;
  console.log("questions ok", questions.data?.length, {
    subject: row?.["subjects"],
    topic: row?.["topics"],
    alts: Array.isArray(row?.["question_alternatives"])
      ? (row?.["question_alternatives"] as unknown[]).length
      : 0,
  });
}
