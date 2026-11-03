import { getDeviceId } from "@/lib/device-id";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

const CLAIM_FLAG_PREFIX = "estufoo.study-claimed.";

/** Prefixo estável: linhas sync passam a usar a conta, não o aparelho. */
export function userStudyOwnerKey(userId: string): string {
  return `user_${userId}`;
}

let cachedUserId: string | null = null;

function readCachedCloudUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("estufoo.cloud-user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: unknown };
    return typeof u?.id === "string" && u.id.trim() ? u.id.trim() : null;
  } catch {
    return null;
  }
}

/** Define o usuário autenticado para sync multi-dispositivo (chamar no login / restore). */
export function setStudyOwnerUserId(userId: string | null): void {
  cachedUserId = userId && userId.trim() ? userId.trim() : null;
}

export function getStudyOwnerUserId(): string | null {
  return cachedUserId ?? readCachedCloudUserId();
}

/**
 * Chave gravada na coluna `device_id` das tabelas de estudo.
 * Com conta: `user_<uuid>` (igual em todos os aparelhos).
 * Sem conta: id local do browser/app.
 */
export function getStudyOwnerId(): string {
  const id = cachedUserId ?? readCachedCloudUserId();
  if (id) {
    cachedUserId = id;
    return userStudyOwnerKey(id);
  }
  return getDeviceId();
}

/** Conta + aparelho atual — para hidratar e depois reivindicar dados antigos. */
export function studyOwnerQueryIds(): string[] {
  const owner = getStudyOwnerId();
  const device = getDeviceId();
  return owner === device ? [device] : [owner, device];
}

function claimFlagKey(userId: string): string {
  return `${CLAIM_FLAG_PREFIX}${userId}:${getDeviceId()}`;
}

function alreadyClaimed(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(claimFlagKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markClaimed(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(claimFlagKey(userId), "1");
  } catch {
    /* ignore */
  }
}

type ClaimTable = {
  name: string;
  /** PK ou unique só em device_id — precisa copiar em vez de UPDATE cego. */
  devicePrimary?: boolean;
};

const CLAIM_TABLES: ClaimTable[] = [
  { name: "approval_trails" },
  { name: "trail_week_lessons" },
  { name: "trail_week_progress" },
  { name: "diagnostic_runs" },
  { name: "study_mind_packs" },
  { name: "user_error_notes" },
  { name: "user_mock_exams" },
  { name: "user_reviews" },
  { name: "user_study_sessions" },
  { name: "user_quest_phase_ai" },
  { name: "user_study_plan", devicePrimary: true },
  { name: "user_quest_state", devicePrimary: true },
  { name: "user_question_local_state", devicePrimary: true },
  { name: "user_video_lesson_progress", devicePrimary: true },
  { name: "user_video_lesson_answers", devicePrimary: true },
  { name: "user_video_lesson_notes" },
  { name: "user_video_lesson_quiz" },
  { name: "user_redacao_state", devicePrimary: true },
  { name: "user_study_schedule", devicePrimary: true },
];

/**
 * Move dados sync deste aparelho (`device_id` local) para a chave da conta.
 * Roda no login / restore no aparelho onde o material foi criado.
 */
export async function claimDeviceStudyDataToAccount(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !userId) return;
  const device = getDeviceId();
  const owner = userStudyOwnerKey(userId);
  if (device === owner) return;
  // Reexecuta se a sessão anterior marcou claimed sem subir o material local.
  if (alreadyClaimed(userId)) {
    /* ainda assim tenta UPDATE — é barato e idempotente */
  }

  setStudyOwnerUserId(userId);
  const sb = requireSupabase();
  let anyOk = false;

  for (const table of CLAIM_TABLES) {
    try {
      if (table.devicePrimary) {
        const { data: deviceRow, error: readErr } = await sb
          .from(table.name)
          .select("*")
          .eq("device_id", device)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!deviceRow) continue;

        const { data: ownerRow } = await sb
          .from(table.name)
          .select("device_id")
          .eq("device_id", owner)
          .maybeSingle();

        if (!ownerRow) {
          const next = { ...deviceRow, device_id: owner };
          const { error: upErr } = await sb.from(table.name).upsert(next, {
            onConflict: "device_id",
          });
          if (upErr) throw upErr;
        }
        const { error: delErr } = await sb.from(table.name).delete().eq("device_id", device);
        if (delErr) throw delErr;
        anyOk = true;
        continue;
      }

      const { data, error } = await sb
        .from(table.name)
        .update({ device_id: owner })
        .eq("device_id", device)
        .select("device_id");
      if (error) {
        // Conflito de PK (ex.: progresso já existe na conta) — remove órfãos do aparelho.
        const { error: delErr } = await sb.from(table.name).delete().eq("device_id", device);
        if (delErr) console.warn(`[study-owner] claim delete ${table.name}`, delErr);
      } else if (data?.length) {
        anyOk = true;
      }
    } catch (err) {
      console.warn(`[study-owner] claim ${table.name} falhou`, err);
    }
  }

  if (anyOk) markClaimed(userId);
}
