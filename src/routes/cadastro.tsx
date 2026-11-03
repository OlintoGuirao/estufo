import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/brand";
import { Field, errMsg } from "@/components/forms";
import { useAuthActions } from "@/hooks/use-auth";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Estufoo" },
      { name: "description", content: "Crie sua conta e monte seu plano de estudos para concursos." },
      { property: "og:title", content: "Criar conta — Estufoo" },
      { property: "og:description", content: "Comece sua preparação com o Estufoo." },
    ],
  }),
  component: Register,
});

const schema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome."),
    email: z.string().email("Informe um e-mail válido."),
    password: z.string().min(6, "Mínimo de 6 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem.", path: ["confirm"] });

function Register() {
  const { register } = useAuthActions();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "password" | "confirm", string>>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    register.mutate({ name: r.data.name, email: r.data.email, password: r.data.password });
  };
  return (
    <AuthCard title="Criar conta" subtitle="Leva menos de um minuto.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="name" error={errors.name}><Input id="name" value={form.name} onChange={set("name")} /></Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}><Input id="email" type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Senha" htmlFor="password" error={errors.password}><Input id="password" type="password" value={form.password} onChange={set("password")} /></Field>
        <Field label="Confirmar senha" htmlFor="confirm" error={errors.confirm}><Input id="confirm" type="password" value={form.confirm} onChange={set("confirm")} /></Field>
        {register.error && <p role="alert" className="text-sm text-destructive">{errMsg(register.error)}</p>}
        <Button type="submit" className="w-full" disabled={register.isPending}>{register.isPending ? "Criando..." : "Criar conta"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="font-medium text-primary">Entrar</Link>
      </p>
    </AuthCard>
  );
}
