/**
 * Limpa dados de estudo no Supabase pelas contas (mantém auth.users).
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/wipe-account-study-data.mjs
 *
 * Chave: Dashboard → Project Settings → API → service_role (secret)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EMAILS = [
  "fabiolaferreiraconcursos@gmail.com",
  "Fabiola_ferreira@hotmail.com",
].map((e) => e.trim().toLowerCase());

const TABLES = [
  "approval_trails",
  "trail_week_lessons",
  "trail_week_progress",
  "diagnostic_runs",
  "study_mind_packs",
  "user_error_notes",
  "user_mock_exams",
  "user_reviews",
  "user_study_sessions",
  "user_quest_phase_ai",
  "user_quest_state",
  "user_question_local_state",
  "user_video_lesson_progress",
  "user_video_lesson_answers",
  "user_video_lesson_notes",
  "user_video_lesson_quiz",
  "user_redacao_state",
  "user_study_schedule",
];

function loadUrl() {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL.trim();
  const env = readFileSync(resolve("d:/estufoo/estufoo-b0542839/.env"), "utf8");
  const m = env.match(/^VITE_SUPABASE_URL=(.+)$/m);
  if (!m) throw new Error("VITE_SUPABASE_URL não encontrado");
  return m[1].trim();
}

const url = loadUrl();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!key) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role).",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listErr } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listErr) {
  console.error("listUsers:", listErr.message);
  process.exit(1);
}

const targets = (listed?.users ?? []).filter((u) =>
  EMAILS.includes(String(u.email ?? "").toLowerCase()),
);

if (!targets.length) {
  console.error("Nenhuma conta encontrada para:", EMAILS.join(", "));
  process.exit(1);
}

for (const u of targets) {
  const owner = `user_${u.id}`;
  console.log(`\n→ ${u.email} (${u.id}) owner=${owner}`);
  for (const table of TABLES) {
    const { error, count } = await sb
      .from(table)
      .delete({ count: "exact" })
      .eq("device_id", owner);
    if (error) console.warn(`  ${table}:`, error.message);
    else if (count) console.log(`  ${table}: ${count}`);
  }
  {
    const { error, count } = await sb
      .from("quest_player_progress")
      .delete({ count: "exact" })
      .eq("user_id", u.id);
    if (error) console.warn("  quest_player_progress(user_id):", error.message);
    else if (count) console.log(`  quest_player_progress(user_id): ${count}`);
  }
  {
    const { error, count } = await sb
      .from("quest_player_progress")
      .delete({ count: "exact" })
      .eq("device_id", owner);
    if (error) console.warn("  quest_player_progress(device):", error.message);
    else if (count) console.log(`  quest_player_progress(device): ${count}`);
  }
}

console.log("\nPronto. Contas de login mantidas; dados de estudo apagados.");
console.log(
  "No celular/PC delas: limpar dados do app ou storage do site para não reenviar lixo local.",
);
