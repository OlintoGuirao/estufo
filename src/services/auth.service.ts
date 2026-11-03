import { request } from "./api";
import { isCloudAuthEnabled } from "./supabase-auth";
import type { AuthResponse, OnboardingInput, User } from "@/types";
import * as cloud from "./supabase-auth";

/**
 * Auth: Supabase (nuvem, multi-dispositivo) quando configurado;
 * senão cai no mock local (só neste navegador).
 */
export const authService = {
  login: (d: { email: string; password: string }) =>
    isCloudAuthEnabled() ? cloud.supabaseLogin(d) : request<AuthResponse>("POST", "/auth/login", d),

  register: (d: { name: string; email: string; password: string }) =>
    isCloudAuthEnabled()
      ? cloud.supabaseRegister(d)
      : request<AuthResponse>("POST", "/auth/register", d),

  forgotPassword: (d: { email: string }) =>
    isCloudAuthEnabled()
      ? cloud.supabaseForgotPassword(d.email)
      : request<{ ok: true }>("POST", "/auth/forgot-password", d),

  me: () => (isCloudAuthEnabled() ? cloud.supabaseMe() : request<User>("GET", "/auth/me")),

  onboarding: (d: OnboardingInput) =>
    isCloudAuthEnabled()
      ? cloud.supabaseOnboarding(d)
      : request<User>("POST", "/onboarding", d),

  updateProfile: (d: Partial<User>) =>
    isCloudAuthEnabled()
      ? cloud.supabaseUpdateProfile(d)
      : request<User>("PATCH", "/auth/me", d),

  logoutCloud: () => cloud.supabaseLogout(),

  restoreCloudSession: () => cloud.supabaseRestoreSession(),

  isCloud: () => isCloudAuthEnabled(),
};
