import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ListChecks, Network, RefreshCcw, LineChart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AprovaMind — Estude para concursos com método" },
      { name: "description", content: "Plano de estudos, questões, simulados, mapas mentais e revisões espaçadas para sua aprovação." },
      { property: "og:title", content: "AprovaMind — Estude para concursos com método" },
      { property: "og:description", content: "Organize sua preparação para concursos públicos em um só lugar." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CalendarCheck, t: "Plano de estudos", d: "Cronograma semanal montado a partir do seu edital e da sua rotina." },
  { icon: ListChecks, t: "Banco de questões", d: "Filtre por banca, matéria, ano e dificuldade, com comentário de cada resposta." },
  { icon: FileText, t: "Simulados", d: "Provas cronometradas com resultado por matéria e recomendações." },
  { icon: Network, t: "Mapas mentais", d: "Conecte os tópicos do edital e marque seu nível de domínio." },
  { icon: RefreshCcw, t: "Revisões espaçadas", d: "Saiba exatamente o que revisar a cada dia." },
  { icon: LineChart, t: "Desempenho", d: "Acompanhe acertos, horas e pontos fracos ao longo do tempo." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
          <Button asChild><Link to="/cadastro">Criar conta</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:pt-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-highlight">Preparação para concursos</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-6xl">
          Do edital à aprovação, com um plano que se ajusta a você.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          O AprovaMind organiza seus estudos, mostra onde você está errando e lembra o que revisar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" variant="highlight" asChild><Link to="/cadastro">Começar grátis</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/login">Já tenho conta</Link></Button>
        </div>
      </section>
      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-px px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="p-6">
              <f.icon className="h-6 w-6 text-highlight" aria-hidden />
              <h2 className="mt-3 font-display text-lg font-semibold">{f.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">© 2026 AprovaMind</footer>
    </div>
  );
}
