import { tokenStore } from "@/services/api";
import type { User } from "@/types";
import type { Session } from "@supabase/supabase-js";

const REMEMBER_KEY = "estufoo.auth.remember";

let readyPromise: Promise<boolean> | null = null;
let listenerBound = false;

export function getAuthRememberPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function setAuthRememberPreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function mapSessionUser(session: Session): User {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    String(meta["name"] ?? meta["full_name"] ?? "").trim() ||
    (u.email ? u.email.split("@")[0]! : "Aluno");
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    onboarded: Boolean(meta["onboarded"]),
    activeContestId: (meta["activeContestId"] as string | null | undefined) ?? null,
  };
}

async function applySession(session: Session, remember: boolean): Promise<boolean> {
  if (!session.access_token || !session.user) return false;

  tokenStore.set(session.access_token, { remember });

  const user = mapSessionUser(session);
  const { syncCloudUserIntoMock } = await import("@/services/mock/handlers");
  syncCloudUserIntoMock(user);

  const { setStudyOwnerUserId } = await import("@/lib/study-owner");
  setStudyOwnerUserId(user.id);

  return true;
}

function bindAuthListener(): void {
  if (listenerBound || typeof window === "undefined") return;
  listenerBound = true;
  void import("@/lib/supabase").then(({ supabase }) => {
    if (!supabase) return;
    supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        if (event === "SIGNED_OUT" || !session) {
          tokenStore.clear();
          try {
            localStorage.removeItem("estufoo.cloud-user");
          } catch {
            /* ignore */
          }
          try {
            const { setStudyOwnerUserId } = await import("@/lib/study-owner");
            setStudyOwnerUserId(null);
          } catch {
            /* ignore */
          }
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION" ||
          event === "USER_UPDATED"
        ) {
          try {
            await applySession(session, getAuthRememberPreference());
          } catch (err) {
            console.warn("[auth-session] sync após", event, err);
          }
        }
      })();
    });
  });
}

/**
 * Garante sessão pronta antes de proteger rotas.
 * Supabase persistSession é a fonte da verdade; espelhamos no tokenStore.
 */
export async function ensureAuthReady(): Promise<boolean> {
  if (typeof window === "undefined") return !!tokenStore.get();

  if (!readyPromise) {
    readyPromise = (async () => {
      bindAuthListener();

      const { authService } = await import("@/services/auth.service");
      if (!authService.isCloud()) {
        return !!tokenStore.get();
      }

      const remember = getAuthRememberPreference();

      try {
        const { requireSupabase } = await import("@/lib/supabase");
        const sb = requireSupabase();
        const { data, error } = await sb.auth.getSession();
        if (error) console.warn("[auth-session] getSession", error.message);

        if (data.session) {
          // "Não manter conectado": só restaura se ainda houver token desta aba.
          if (!remember && !sessionStorage.getItem("estufoo.token")) {
            return false;
          }
          const ok = await applySession(data.session, remember);
          if (ok) {
            void import("@/lib/study-account-sync").then(({ syncAccountStudyData }) =>
              syncAccountStudyData(data.session!.user.id).catch((err) =>
                console.warn("[auth-session] sync estudo falhou", err),
              ),
            );
            return true;
          }
        }
      } catch (err) {
        console.warn("[auth-session] ensureAuthReady falhou", err);
      }

      return !!tokenStore.get();
    })();
  }

  try {
    return await readyPromise;
  } catch {
    readyPromise = null;
    return !!tokenStore.get();
  }
}

/** Após login/cadastro explícito — evita re-hidratar do zero. */
export function markAuthReady(): void {
  readyPromise = Promise.resolve(true);
  bindAuthListener();
}

export function resetAuthReadyGate(): void {
  readyPromise = null;
}
