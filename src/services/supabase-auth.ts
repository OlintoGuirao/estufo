import { ApiError } from "./api";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import type { AuthResponse, OnboardingInput, User } from "@/types";
import type { User as SbUser } from "@supabase/supabase-js";

export function isCloudAuthEnabled(): boolean {
  return isSupabaseConfigured;
}

function mapUser(u: SbUser): User {
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

function authError(err: { message?: string; status?: number } | null, fallback: string): never {
  const msg = err?.message ?? fallback;
  const lower = msg.toLowerCase();
  if (/invalid login|invalid credentials|wrong password/i.test(lower)) {
    throw new ApiError("E-mail ou senha inválidos.", 400);
  }
  if (/already registered|already been registered|user already/i.test(lower)) {
    throw new ApiError("Este e-mail já está cadastrado.", 409);
  }
  if (/email not confirmed/i.test(lower)) {
    throw new ApiError(
      "Confirme seu e-mail antes de entrar (veja a caixa de entrada) ou desative a confirmação no Supabase Auth.",
      400,
    );
  }
  throw new ApiError(msg || fallback, err?.status && err.status >= 400 ? err.status : 400);
}

export async function supabaseRegister(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        name: input.name.trim(),
        onboarded: false,
        activeContestId: null,
      },
    },
  });
  if (error) authError(error, "Não foi possível criar a conta.");
  if (!data.user) throw new ApiError("Não foi possível criar a conta.", 500);

  // Sem sessão = projeto exige confirmação de e-mail.
  if (!data.session?.access_token) {
    throw new ApiError(
      "Conta criada. Confirme o e-mail para entrar — ou, no Supabase → Authentication → Providers → Email, desative “Confirm email”.",
      400,
    );
  }

  return { token: data.session.access_token, user: mapUser(data.user) };
}

export async function supabaseLogin(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) authError(error, "E-mail ou senha inválidos.");
  if (!data.session?.access_token || !data.user) {
    throw new ApiError("E-mail ou senha inválidos.", 400);
  }
  return { token: data.session.access_token, user: mapUser(data.user) };
}

export async function supabaseMe(): Promise<User> {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new ApiError("Sessão inválida.", 401);
  return mapUser(data.user);
}

export async function supabaseUpdateProfile(patch: Partial<User>): Promise<User> {
  const sb = requireSupabase();
  const { data: cur, error: curErr } = await sb.auth.getUser();
  if (curErr || !cur.user) throw new ApiError("Sessão inválida.", 401);
  const prev = (cur.user.user_metadata ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...prev,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.onboarded !== undefined ? { onboarded: patch.onboarded } : {}),
    ...(patch.activeContestId !== undefined
      ? { activeContestId: patch.activeContestId }
      : {}),
  };
  const { data, error } = await sb.auth.updateUser({ data: nextMeta });
  if (error || !data.user) throw new ApiError(error?.message ?? "Falha ao atualizar perfil.", 400);
  return mapUser(data.user);
}

export async function supabaseOnboarding(input: OnboardingInput): Promise<User> {
  return supabaseUpdateProfile({
    onboarded: true,
    activeContestId: input.contestId,
  });
}

export async function supabaseForgotPassword(email: string): Promise<{ ok: true }> {
  const sb = requireSupabase();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (error) authError(error, "Não foi possível enviar o e-mail.");
  return { ok: true };
}

export async function supabaseLogout(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await requireSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
}

/** Se já existe sessão Supabase (outro dispositivo / refresh), devolve o token. */
export async function supabaseRestoreSession(): Promise<AuthResponse | null> {
  if (!isCloudAuthEnabled()) return null;
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  if (!data.session?.access_token || !data.session.user) return null;
  return {
    token: data.session.access_token,
    user: mapUser(data.session.user),
  };
}
