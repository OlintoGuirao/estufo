# Professor IA (Gemini)

Tudo roda **no servidor** (sem prefixo `VITE_` — a chave nunca vai para o browser).
Ollama continua só como **fallback** quando o Gemini não está configurado.

## Como funciona

```
pergunta do aluno
   │
   ├─ perfil do aluno (erros + dificuldades marcadas)      src/lib/tutor/student-profile.ts
   ├─ lei seca recuperada (RAG)                              src/server/legal/retrieve.ts
   ├─ questões reais VUNESP como exemplo de estilo           src/server/vunesp-examples.ts
   ▼
tutorChat(messages, { task })                                src/server/tutor-llm.ts
   │  task → modelo (fast/smart), temperatura, JSON, thinking   src/server/llm-tasks.ts
   │  JSON quebrado → pede correção 1x automaticamente
   ▼
Gemini (retry em 429/5xx, chave no header)                   src/server/gemini/client.ts
   │
   ├─ questões geradas → 2ª passagem resolve sem gabarito    src/server/question-verify.ts
   └─ artigos citados → conferidos contra as fontes          src/server/legal/citations.ts
```

## Dois modelos

| Tier | Variável | Usado em |
| --- | --- | --- |
| fast | `GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`) | dicas, flashcards, mapa mental, temas de redação, quiz de videoaula |
| smart | `GEMINI_MODEL_SMART` (padrão `gemini-3.5-flash`) | Mastigado, explicação, chat da trilha, aula da semana, geração/verificação de questões, correção de redação |

Se o modelo smart não existir na sua conta, o app usa o fast automaticamente (veja o log `[gemini] modelo … indisponível`).
Confira os nomes exatos no [Google AI Studio](https://aistudio.google.com).

## Lei seca (RAG)

1. `npm run legal:ingest` baixa CF, CP, CPP, CPC, Lei 9.099, 12.153, 8.429, 13.146, 6.830, Estatuto SP (10.261), Taxa Judiciária SP e Normas da Corregedoria,
   divide por artigo (remove texto revogado/riscado) e grava `data/legal/corpus.json`.
   Já funciona assim, com busca por palavras — **sem banco**.
2. Opcional (busca semântica): rode `db/migrations/013_legal_corpus.sql` no Supabase, defina `DATABASE_URL` e rode o ingest de novo — ele grava embeddings em `legal_chunks`.
3. Lista de leis: `src/server/legal/laws.ts`. Confira com o edital vigente e acrescente o que faltar.

Faça commit do `data/legal/corpus.json` para ele ir junto no deploy.

## Mastigado: dois modos

- **Aula** (aluno ainda não respondeu): o professor recebe o gabarito só para não ensinar errado, e é proibido revelar a letra (se revelar, o servidor pede para reescrever).
- **Correção** (aluno já respondeu — botão “Corrigir com a IA”): resolve a questão original alternativa por alternativa e explica o erro do aluno.

## Medir qualidade

```bash
npm run eval:tutor                     # 40 questões do banco/provas, tier smart
npm run eval:tutor -- --n 80 --tier fast
```

Mostra % de acerto por matéria, dicas que entregam a letra e explicações com artigo sem fonte.
Rode antes e depois de mudar prompt/modelo e compare.

## Variáveis

Veja `.env.example` (seção “Professor IA”). Principais:

```env
GEMINI_API_KEY=sua-chave
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MODEL_SMART=gemini-3.5-flash
ANSWER_TOKEN_SECRET=texto-longo-aleatorio
```

## Troubleshooting

| Sintoma | Ação |
| --- | --- |
| Status “Indisponível” / chave ausente | Definir `GEMINI_API_KEY` no `.env` |
| Log “modelo … indisponível — usando …” | Ajustar `GEMINI_MODEL_SMART` para um modelo que exista |
| Erro 400 sobre thinking | O app já reenvia sem; para desligar de vez: `GEMINI_THINKING=off` |
| “Limite de uso do Gemini atingido” | Cota/429 — o app já tenta 3x com espera; aguarde ou suba o plano |
| Professor sem FONTE LEGAL | Rodar `npm run legal:ingest` |
| Questões demais descartadas | Ver log `[verify]`; para testar sem: `QUESTION_VERIFY=off` |
| Respostas “mockadas” | Desligar `GEMINI_USE_MOCK` |
