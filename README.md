# Estufoo

Plataforma de estudo para concursos — foco atual: **TJSP · Escrevente Técnico Judiciário (VUNESP)**.
Trilha da aprovação, Quest gamificado, questões e simulados, caderno de erros, revisões,
mapas mentais, videoaulas, redação e um **Professor IA** que ensina e corrige.

## Stack

- **Web:** React 19 + TanStack Start/Router (SSR, server functions) + Tailwind 4 + shadcn/ui
- **Dados:** Supabase (Postgres + RLS) — sem conta configurada, o app roda em modo local/mock
- **IA:** Google Gemini no servidor (Ollama como fallback local)
- **Mobile:** Capacitor (Android)
- **Testes:** Vitest

## Rodar localmente

```sh
npm i
cp .env.example .env   # preencha GEMINI_API_KEY e (opcional) Supabase
npm run dev
```

Conta demo no modo mock: `aluno@estufoo.app` / `123456`.

## Scripts úteis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes (Vitest) |
| `npm run db:migrate` | aplica `db/migrations/*.sql` (precisa `DATABASE_URL`) |
| `npm run legal:ingest` | baixa a lei seca do edital para o Professor IA |
| `npm run eval:tutor` | mede a qualidade do Professor IA com questões que têm gabarito |
| `npm run apk:debug` | gera o APK de debug (Windows) |

## Estrutura

```
src/
  routes/          páginas (TanStack Router, arquivo = rota)
  components/      UI (ui/ = shadcn)
  services/        acesso a dados + server functions (*.fns.ts rodam no servidor)
  server/          código só-servidor: Gemini/Ollama, lei seca (legal/), verificação de questões
  lib/             regras puras e testáveis (tutor/, approval-trail/, tjsp-quest/, legal/…)
  data/            banco de questões e provas oficiais TJSP (JSON)
db/migrations/     schema Supabase
scripts/           ingestão, parse de provas, migrações, avaliação
docs/              documentação por área (comece por docs/tutor-ollama.md e docs/database.md)
```

## Professor IA

Detalhes em [`docs/tutor-ollama.md`](docs/tutor-ollama.md): dois modelos (rápido / professor),
lei seca com RAG, perfil do aluno, verificação de questões geradas e avaliação.

## Lovable

Projeto conectado ao [Lovable](https://lovable.dev/projects/d65b0ad4-8912-415b-af7c-cbcd45e5bf44):
commits no branch conectado sincronizam com o editor. Evite reescrever histórico já publicado.
