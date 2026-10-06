import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/brand";
import { Field, errMsg } from "@/components/forms";
import { authService } from "@/services";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — AprovaMind" },
      { name: "description", content: "Receba um link para redefinir sua senha." },
      { property: "og:title", content: "Recuperar senha — AprovaMind" },
      { property: "og:description", content: "Receba um link para redefinir sua senha." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const m = useMutation({ mutationFn: authService.forgotPassword });
  return (
    <AuthCard title="Recuperar senha" subtitle="Enviaremos um link para o seu e-mail.">
      {m.isSuccess ? (
        <p className="rounded-md bg-highlight-soft p-4 text-sm">Se o e-mail estiver cadastrado, você receberá as instruções em instantes.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); m.mutate({ email }); }} className="space-y-4">
          <Field label="E-mail" htmlFor="email"><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {m.error && <p className="text-sm text-destructive">{errMsg(m.error)}</p>}
          <Button type="submit" className="w-full" disabled={m.isPending}>Enviar link</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link to="/login" className="text-primary">Voltar para o login</Link></p>
    </AuthCard>
  );
}
