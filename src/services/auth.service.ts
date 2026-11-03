import { request } from "./api";
import type { AuthResponse, OnboardingInput, User } from "@/types";

export const authService = {
  login: (d: { email: string; password: string }) => request<AuthResponse>("POST", "/auth/login", d),
  register: (d: { name: string; email: string; password: string }) =>
    request<AuthResponse>("POST", "/auth/register", d),
  forgotPassword: (d: { email: string }) => request<{ ok: true }>("POST", "/auth/forgot-password", d),
  me: () => request<User>("GET", "/auth/me"),
  onboarding: (d: OnboardingInput) => request<User>("POST", "/onboarding", d),
  updateProfile: (d: Partial<User>) => request<User>("PATCH", "/auth/me", d),
};
