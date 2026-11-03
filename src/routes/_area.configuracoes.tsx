import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/common";
import { Field, errMsg } from "@/components/forms";
import { PdfImportPanel } from "@/components/exam-import/pdf-import-panel";
import { StudySchedulePanel } from "@/components/study-schedule/study-schedule-panel";
import { useAuthActions, useMe } from "@/hooks/use-auth";
import { authService } from "@/services";
import { examImportService } from "@/services/exam-import.service";

export const Route = createFileRoute("/_area/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Estufoo" },
      { name: "description", content: "Gerencie seu perfil e importação de questões." },
      { property: "og:title", content: "Configurações — Estufoo" },
      { property: "og:description", content: "Gerencie seu perfil e importação de questões." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const { logout } = useAuthActions();
  const [f, setF] = useState({ name: "", email: "" });
  useEffect(() => {
    if (me.data) setF({ name: me.data.name, email: me.data.email });
  }, [me.data]);

  const save = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      toast.success("Perfil atualizado.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const email = me.data?.email ?? "";
  const access = useQuery({
    queryKey: ["exam-import-access", email],
    queryFn: () => examImportService.canAccess(email),
    enabled: !!email,
  });

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Perfil">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(f);
            }}
          >
            <Field label="Nome" htmlFor="n">
              <Input
                id="n"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="E-mail" htmlFor="e">
              <Input
                id="e"
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </form>
        </Panel>

        <Panel title="Dias de estudo, redação e prova">
          <StudySchedulePanel />
        </Panel>

        <Panel title="Importar questões (PDF)">
          {!email ? (
            <p className="text-sm text-muted-foreground">Faça login para importar PDFs.</p>
          ) : access.data && !access.data.allowed ? (
            <p className="text-sm text-muted-foreground">{access.data.reason}</p>
          ) : (
            <PdfImportPanel actorEmail={email} />
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Fluxo completo de revisão também em{" "}
            <Link to="/importacao" className="underline">
              /importacao
            </Link>
            .
          </p>
        </Panel>

        <Panel title="Plano de estudos">
          <p className="mb-3 text-sm text-muted-foreground">
            Refaça a configuração inicial para gerar um novo plano.
          </p>
          <Button variant="outline" onClick={() => window.location.assign("/onboarding")}>
            Refazer configuração
          </Button>
        </Panel>

        <Panel title="Sessão">
          <Button variant="destructive" onClick={logout}>
            Sair da conta
          </Button>
        </Panel>
      </div>
    </>
  );
}
