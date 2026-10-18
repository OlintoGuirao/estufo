import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell, CalendarDays, FileText, Gauge, LineChart, ListChecks, LogOut, Menu, Network, RefreshCcw, Settings, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/brand";
import { NativeSelect } from "@/components/forms";
import { useAuthActions, useMe } from "@/hooks/use-auth";
import { contestsService, dashboardService } from "@/services";
import { tokenStore } from "@/services/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area")({
  ssr: false,
  beforeLoad: () => {
    if (!tokenStore.get()) throw redirect({ to: "/login" });
  },
  component: AppShell,
});

const nav = [
  { to: "/painel", label: "Visão geral", icon: Gauge },
  { to: "/plano", label: "Plano de estudos", icon: CalendarDays },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/mapas", label: "Mapas mentais", icon: Network },
  { to: "/revisoes", label: "Revisões", icon: RefreshCcw },
  { to: "/desempenho", label: "Desempenho", icon: LineChart },
  { to: "/concursos", label: "Concursos", icon: Trophy },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}>
          <n.icon className="h-4 w-4" aria-hidden />{n.label}
        </Link>
      ))}
    </nav>
  );
}

function AppShell() {
  const [open, setOpen] = useState(false);
  const me = useMe();
  const { logout } = useAuthActions();
  const qc = useQueryClient();
  const contests = useQuery({ queryKey: ["contests", {}], queryFn: () => contestsService.list({}) });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: dashboardService.notifications });
  const activate = useMutation({
    mutationFn: contestsService.setActive,
    onSuccess: (u) => { qc.setQueryData(["me"], u); qc.invalidateQueries(); },
  });
  const read = useMutation({ mutationFn: dashboardService.readNotification, onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const initials = me.data?.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <div className="mb-6 px-2"><Logo to="/painel" className="text-sidebar-foreground" /></div>
        <NavList />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-4">
          <SheetTitle className="mb-6 px-2"><Logo to="/painel" className="text-sidebar-foreground" /></SheetTitle>
          <NavList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></Button>
          <div className="w-full max-w-xs">
            <NativeSelect aria-label="Concurso ativo" value={me.data?.activeContestId ?? ""} onChange={(e) => activate.mutate(e.target.value)}>
              <option value="" disabled>Selecione um concurso</option>
              {contests.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
                  <Bell />
                  {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-highlight" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notes.data?.length ? notes.data.map((n) => (
                  <DropdownMenuItem key={n.id} onSelect={() => !n.read && read.mutate(n.id)} className="flex-col items-start gap-0.5">
                    <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                  </DropdownMenuItem>
                )) : <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação.</p>}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2" aria-label="Menu do perfil">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials || "?"}</span>
                  <span className="hidden text-sm sm:inline">{me.data?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal"><p className="text-sm">{me.data?.name}</p><p className="text-xs text-muted-foreground">{me.data?.email}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/configuracoes"><Settings />Configurações</Link></DropdownMenuItem>
                <DropdownMenuItem onSelect={logout}><LogOut />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
