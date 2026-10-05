import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authService } from "@/services";
import { tokenStore } from "@/services/api";
import type { AuthResponse } from "@/types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: authService.me, enabled: !!tokenStore.get(), retry: false });
}

export function useAuthActions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const onAuth = (r: AuthResponse) => {
    tokenStore.set(r.token);
    qc.setQueryData(["me"], r.user);
  };
  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: (r) => {
      onAuth(r);
      navigate({ to: r.user.onboarded ? "/painel" : "/onboarding" });
    },
  });
  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: (r) => {
      onAuth(r);
      navigate({ to: "/onboarding" });
    },
  });
  const logout = () => {
    tokenStore.clear();
    qc.clear();
    navigate({ to: "/login" });
  };
  return { login, register, logout };
}
