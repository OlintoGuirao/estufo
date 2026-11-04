import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/brand";
import { Field, errMsg } from "@/components/forms";
import { useAuthActions } from "@/hooks/use-auth";
import { USE_MOCK } from "@/services/api";
import { authService } from "@/services/auth.service";
import { DEMO_AUTH } from "@/services/mock/demo-auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { expirado?: string | undefined } => ({
    expirado: s["expirado"] ? String(s["expirado"]) : undefined,
  }),
  ssr: false,
  beforeLoad: async ({ search }) => {
    // Já tem sessão válida? Não pede login de novo.
    if (search.expirado) return;
    const { ensureAuthReady } = await import("@/lib/auth-session");
    const { tokenStore } = await import("@/services/api");
    const ok = await ensureAuthReady();
    if (ok || tokenStore.get()) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Entrar — Estufoo" },
      { name: "description", content: "Acesse sua conta Estufoo." },
      { property: "og:title", content: "Entrar — Estufoo" },
      { property: "og:description", content: "Acesse sua conta Estufoo." },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "Mínimo de 6 caracteres."),
});

function Login() {
  const { expirado } = Route.useSearch();
  const { login } = useAuthActions();
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    login.mutate({ ...r.data, remember });
  };
  return (
    <AuthCard title="Entrar" subtitle="Bem-vindo de volta. Continue de onde parou.">
      {expirado && <p className="mb-4 rounded-md bg-accent p-3 text-sm">Sua sessão expirou. Entre novamente.</p>}
      {authService.isCloud() ? (
        <p className="mb-4 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          Conta no servidor (Supabase): o mesmo e-mail/senha funciona no PC, no celular e no APK.
          Se ainda não tem conta na nuvem, use <strong>Criar conta</strong> uma vez.
        </p>
      ) : (
        USE_MOCK && (
          <div className="mb-4 space-y-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm">
            <div>
              <p className="font-medium">Acesso demo</p>
              <p className="mt-1 text-muted-foreground">
                E-mail: <code className="text-xs">{DEMO_AUTH.email}</code>
                <br />
                Senha: <code className="text-xs">{DEMO_AUTH.password}</code>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setForm({ email: DEMO_AUTH.email, password: DEMO_AUTH.password });
                  setErrors({});
                }}
              >
                Preencher demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sem Supabase configurado, as contas ficam só neste navegador.
            </p>
          </div>
        )
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <Label htmlFor="remember" className="text-sm font-normal leading-none cursor-pointer">
            Manter conectado
          </Label>
        </div>
        {login.error && <p role="alert" className="text-sm text-destructive">{errMsg(login.error)}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>{login.isPending ? "Entrando..." : "Entrar"}</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link to="/recuperar-senha" className="text-muted-foreground hover:text-foreground">Esqueci minha senha</Link>
        <Link to="/cadastro" className="font-medium text-primary">Criar conta</Link>
      </div>
    </AuthCard>
  );
}
