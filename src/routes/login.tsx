import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/brand";
import { Field, errMsg } from "@/components/forms";
import { useAuthActions } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { expirado?: string | undefined } => ({ expirado: s["expirado"] ? String(s["expirado"]) : undefined }),
  head: () => ({
    meta: [
      { title: "Entrar — AprovaMind" },
      { name: "description", content: "Acesse sua conta AprovaMind." },
      { property: "og:title", content: "Entrar — AprovaMind" },
      { property: "og:description", content: "Acesse sua conta AprovaMind." },
    ],
  }),
  component: Login,
});

const schema = z.object({ email: z.string().email("Informe um e-mail válido."), password: z.string().min(6, "Mínimo de 6 caracteres.") });

function Login() {
  const { expirado } = Route.useSearch();
  const { login } = useAuthActions();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    login.mutate(r.data);
  };
  return (
    <AuthCard title="Entrar" subtitle="Bem-vindo de volta. Continue de onde parou.">
      {expirado && <p className="mb-4 rounded-md bg-accent p-3 text-sm">Sua sessão expirou. Entre novamente.</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
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
