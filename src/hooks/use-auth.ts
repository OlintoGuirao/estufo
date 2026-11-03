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
  const onAuth = async (r: AuthResponse, remember = true) => {
    tokenStore.set(r.token, { remember });
    qc.setQueryData(["me"], r.user);
    if (authService.isCloud()) {
      const { setStudyOwnerUserId, claimDeviceStudyDataToAccount } = await import(
        "@/lib/study-owner"
      );
      setStudyOwnerUserId(r.user.id);
      try {
        await claimDeviceStudyDataToAccount(r.user.id);
      } catch (err) {
        console.warn("[auth] claim estudo → conta falhou", err);
      }
      void import("@/services/mock/handlers").then(({ syncCloudUserIntoMock }) => {
        syncCloudUserIntoMock(r.user);
      });
    }
  };
  const login = useMutation({
    mutationFn: async ({ email, password, remember }: LoginInput) => {
      const r = await authService.login({ email, password });
      return { ...r, remember: remember !== false };
    },
    onSuccess: (r) => {
      void onAuth(r, r.remember).then(() => {
        window.location.assign(r.user.onboarded ? "/painel" : "/onboarding");
      });
    },
  });
  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: (r) => {
      void onAuth(r, true).then(() => {
        window.location.assign("/onboarding");
      });
    },
  });
  const logout = () => {
    void authService.logoutCloud().finally(() => {
      tokenStore.clear();
      try {
        localStorage.removeItem("estufoo.cloud-user");
      } catch {
        /* ignore */
      }
      void import("@/lib/study-owner").then(({ setStudyOwnerUserId }) => {
        setStudyOwnerUserId(null);
      });
      qc.clear();
      window.location.assign("/login");
    });
  };
  return { login, register, logout };
}
