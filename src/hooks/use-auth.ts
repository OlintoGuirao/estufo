import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services";
import { tokenStore } from "@/services/api";
import type { AuthResponse } from "@/types";

export type LoginInput = {
  email: string;
  password: string;
  /** Manter conectado — persiste o token além da sessão do browser. */
  remember?: boolean;
};

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: authService.me, enabled: !!tokenStore.get(), retry: false });
}

export function useAuthActions() {
  const qc = useQueryClient();
  const onAuth = (r: AuthResponse, remember = true) => {
    tokenStore.set(r.token, { remember });
    qc.setQueryData(["me"], r.user);
  };
  const login = useMutation({
    mutationFn: async ({ email, password, remember }: LoginInput) => {
      const r = await authService.login({ email, password });
      return { ...r, remember: remember !== false };
    },
    onSuccess: (r) => {
      onAuth(r, r.remember);
      window.location.assign(r.user.onboarded ? "/painel" : "/onboarding");
    },
  });
  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: (r) => {
      onAuth(r, true);
      window.location.assign("/onboarding");
    },
  });
  const logout = () => {
    tokenStore.clear();
    qc.clear();
    window.location.assign("/login");
  };
  return { login, register, logout };
}
