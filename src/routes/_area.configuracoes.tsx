import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/common";
import { Field, errMsg } from "@/components/forms";
import { useAuthActions, useMe } from "@/hooks/use-auth";
import { authService } from "@/services";

export const Route = createFileRoute("/_area/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — AprovaMind" }, { name: "description", content: "Gerencie seu perfil." }, { property: "og:title", content: "Configurações — AprovaMind" }, { property: "og:description", content: "Gerencie seu perfil." }] }),
  component: Settings,
});

function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const { logout } = useAuthActions();
  const [f, setF] = useState({ name: "", email: "" });
  useEffect(() => { if (me.data) setF({ name: me.data.name, email: me.data.email }); }, [me.data]);
  const save = useMutation({ mutationFn: authService.updateProfile, onSuccess: (u) => { qc.setQueryData(["me"], u); toast.success("Perfil atualizado."); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid max-w-2xl gap-6">
        <Panel title="Perfil">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }}>
            <Field label="Nome" htmlFor="n"><Input id="n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="E-mail" htmlFor="e"><Input id="e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Button type="submit" disabled={save.isPending}>Salvar</Button>
          </form>
        </Panel>
        <Panel title="Plano de estudos"><p className="mb-3 text-sm text-muted-foreground">Refaça a configuração inicial para gerar um novo plano.</p><Button variant="outline" onClick={() => window.location.assign("/onboarding")}>Refazer configuração</Button></Panel>
        <Panel title="Sessão"><Button variant="destructive" onClick={logout}>Sair da conta</Button></Panel>
      </div>
    </>
  );
}
