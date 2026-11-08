import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services";
import { tokenStore } from "@/services/api";
import {
  markAuthReady,
  resetAuthReadyGate,
  setAuthRememberPreference,
} from "@/lib/auth-session";
import type { AuthResponse } from "@/types";

export type LoginInput = {
  email: string;
  password: string;
  /** Manter conectado — persiste o token além da sessão do browser. */
  remember?: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
    enabled: !!tokenStore.get(),
    retry: false,
  });
}

export function useAuthActions() {
  const qc = useQueryClient();
  const onAuth = async (r: AuthResponse, remember = true) => {
    setAuthRememberPreference(remember);
    tokenStore.set(r.token, { remember });
    markAuthReady();
    qc.setQueryData(["me"], r.user);
    if (authService.isCloud()) {
      // A troca de conta (gaveta + limpeza) é feita em syncAccountStudyData,
      // antes de qualquer envio ao banco.
      const { syncCloudUserIntoMock } = await import("@/services/mock/handlers");
      syncCloudUserIntoMock(r.user);
      const { setStudyOwnerUserId } = await import("@/lib/study-owner");
      setStudyOwnerUserId(r.user.id);
      const { syncAccountStudyData } = await import("@/lib/study-account-sync");
      try {
        await syncAccountStudyData(r.user.id, { willNavigate: true });
      } catch (err) {
        console.warn("[auth] sync estudo → conta falhou", err);
      }
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
    // Antes de sair: garante que o que só estava no aparelho subiu para o banco.
    void import("@/lib/study-account-sync")
      .then(({ flushAllStudyDataToCloud }) => flushAllStudyDataToCloud())
      .catch(() => undefined)
      .finally(() => doLogout());
  };
  const doLogout = () => {
    void authService.logoutCloud().finally(async () => {
      // Sair = limpar o aparelho: o próximo a entrar não vê os dados desta conta.
      // (Tudo continua salvo no banco e volta quando esta conta entrar de novo.)
      try {
        const { wipeLocalStudyData, setLocalDataOwner } = await import("@/lib/local-study-data");
        await wipeLocalStudyData();
        setLocalDataOwner(null);
      } catch (err) {
        console.warn("[auth] limpar dados locais falhou", err);
      }
      tokenStore.clear();
      resetAuthReadyGate();
      try {
        localStorage.removeItem("estufoo.cloud-user");
      } catch {
        /* ignore */
      }
      void import("@/lib/study-owner").then(({ setStudyOwnerUserId }) => {
        setStudyOwnerUserId(null);
      });
      void import("@/lib/study-account-sync").then(({ resetAccountStudySync }) => {
        resetAccountStudySync();
      });
      qc.clear();
      window.location.assign("/login");
    });
  };
  return { login, register, logout };
}
