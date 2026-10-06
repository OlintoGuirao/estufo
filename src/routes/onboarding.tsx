import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/brand";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { ListSkeleton } from "@/components/common";
import { authService, contestsService } from "@/services";
import { tokenStore } from "@/services/api";
import type { OnboardingInput } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: () => {
    if (!tokenStore.get()) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Configurar seus estudos — AprovaMind" },
      { name: "description", content: "Escolha seu concurso e sua rotina de estudos." },
      { property: "og:title", content: "Configurar seus estudos — AprovaMind" },
      { property: "og:description", content: "Escolha seu concurso e sua rotina de estudos." },
    ],
  }),
  component: Onboarding,
});

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Onboarding() {
  const qc = useQueryClient();
  const contests = useQuery({ queryKey: ["contests", {}], queryFn: () => contestsService.list({}) });
  const [step, setStep] = useState(0);
  const [d, setD] = useState<OnboardingInput>({ contestId: "", role: "", board: "", examDate: "", hoursPerDay: 3, weekDays: [1, 2, 3, 4, 5], level: "iniciante", prioritySubjects: [] });
  const contest = contests.data?.find((c) => c.id === d.contestId);
  const save = useMutation({
    mutationFn: authService.onboarding,
    onSuccess: (u) => { qc.setQueryData(["me"], u); window.location.assign("/painel"); },
  });
  const pick = (id: string) => {
    const c = contests.data?.find((x) => x.id === id);
    if (c) setD({ ...d, contestId: c.id, role: c.role, board: c.board, examDate: c.examDate, prioritySubjects: [] });
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const canNext = [!!d.contestId, d.weekDays.length > 0 && d.hoursPerDay > 0, true][step];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <p className="mt-8 text-sm text-muted-foreground">Etapa {step + 1} de 3</p>
        <Progress value={((step + 1) / 3) * 100} className="mt-2" />
        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-card">
          {step === 0 && (
            <>
              <h1 className="font-display text-2xl font-semibold">Qual concurso você vai prestar?</h1>
              <div className="mt-5 space-y-3">
                {contests.isLoading ? <ListSkeleton count={3} /> : contests.data?.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c.id)}
                    className={cn("w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent", d.contestId === c.id && "border-primary ring-1 ring-primary")}>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.board} · {c.status}</p>
                  </button>
                ))}
              </div>
              {contest && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Cargo" htmlFor="role"><Input id="role" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} /></Field>
                  <Field label="Data da prova" htmlFor="date"><Input id="date" type="date" value={d.examDate} onChange={(e) => setD({ ...d, examDate: e.target.value })} /></Field>
                </div>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="font-display text-2xl font-semibold">Como é sua rotina?</h1>
              <div className="mt-5 space-y-5">
                <Field label="Horas por dia" htmlFor="h"><Input id="h" type="number" min={1} max={14} value={d.hoursPerDay} onChange={(e) => setD({ ...d, hoursPerDay: Number(e.target.value) })} /></Field>
                <div>
                  <p className="mb-2 text-sm font-medium">Dias da semana</p>
                  <div className="flex flex-wrap gap-2">
                    {days.map((n, i) => (
                      <Button key={n} type="button" size="sm" variant={d.weekDays.includes(i) ? "default" : "outline"} onClick={() => setD({ ...d, weekDays: toggle(d.weekDays, i) })}>{n}</Button>
                    ))}
                  </div>
                </div>
                <Field label="Seu nível" htmlFor="lvl">
                  <NativeSelect id="lvl" value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as OnboardingInput["level"] })}>
                    <option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option>
                  </NativeSelect>
                </Field>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="font-display text-2xl font-semibold">Quais matérias são prioridade?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Elas terão mais tempo no seu plano.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {contest?.subjects.map((s) => (
                  <Button key={s.id} type="button" variant={d.prioritySubjects.includes(s.name) ? "highlight" : "outline"} onClick={() => setD({ ...d, prioritySubjects: toggle(d.prioritySubjects, s.name) })}>{s.name}</Button>
                ))}
              </div>
              {save.error && <p className="mt-4 text-sm text-destructive">{errMsg(save.error)}</p>}
            </>
          )}
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
            {step < 2 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button>
            ) : (
              <Button variant="highlight" disabled={save.isPending} onClick={() => save.mutate(d)}>{save.isPending ? "Gerando plano..." : "Gerar meu plano"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
