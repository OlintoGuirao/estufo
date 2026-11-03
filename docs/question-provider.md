# Provedor de questões (Estufoo)

## O que foi escolhido

**Nenhum fornecedor comercial está embutido** (não há scraping da VUNESP nem cópia de acervo).

O adaptador implementado é o **`HttpLicensedQuestionProvider`**: um cliente HTTP genérico que fala com a API **licenciada** que você configurar no servidor.

Arquitetura (importante para o Vite):
- Cliente importa só `src/services/provider-questions.fns.ts` (RPC via `createServerFn`).
- Chave e HTTP ficam em `src/server/question-provider/**` e entram só no handler (ambiente server).

Alvo de produto (filtros padrão na UI): **VUNESP · Tribunal de Justiça de São Paulo · Escrevente Técnico Judiciário**.

## Configuração (servidor)

Variáveis **sem** prefixo `VITE_` (não vão para o browser):

| Variável                      | Obrigatória | Descrição                                              |
| ----------------------------- | ----------- | ------------------------------------------------------ |
| `QUESTIONS_API_KEY`           | sim*        | Bearer token do fornecedor                             |
| `QUESTIONS_API_BASE_URL`      | sim*        | Base URL da API licenciada (sem `/` final)             |
| `QUESTIONS_API_PROVIDER_NAME` | não         | Nome amigável (padrão: `http-licensed`)                |
| `QUESTIONS_API_CACHE`         | não         | Ignorado — cache de enunciados permanece **desligado** |

\*Sem as duas primeiras, a aba **Provedor (API)** mostra “não configurado” e o app continua com questões **locais de exemplo**.

Coloque-as no `.env` local / secrets do host (Nitro/Cloudflare). Nunca no código, PRs ou `VITE_*`.

## Contrato HTTP esperado

Autenticação: `Authorization: Bearer <QUESTIONS_API_KEY>`.

### `GET /questions`

Query: `board`, `institution`, `role`, `year`, `subject`, `topic`, `hasAnswerKey`, `page`, `pageSize` (máx. 20 no cliente).

Resposta JSON:

```json
{
  "items": [
    {
      "id": "upstream-id",
      "statementHtml": "<p>...</p>",
      "supportHtml": "<p>...</p>",
      "alternatives": [{ "key": "A", "html": "..." }],
      "images": [{ "url": "https://...", "alt": "..." }],
      "board": "VUNESP",
      "year": 2023,
      "institution": "Tribunal de Justiça de São Paulo",
      "role": "Escrevente Técnico Judiciário",
      "examName": "TJSP — Escrevente",
      "subject": "Língua Portuguesa",
      "topic": "Concordância",
      "difficulty": "media",
      "source": "Nome do fornecedor / atribuição",
      "annulled": false,
      "hasAnswerKey": true,
      "outdated": false
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "matchQuality": "exact",
  "matchNote": "opcional"
}
```

### `GET /questions/:id`

Um item no mesmo formato.

### `POST /questions/:id/check`

Body: `{ "choice": "B" }`  
Resposta: `{ "correct": true, "correctKey": "B", "explanationHtml": "...", "annulled": false, "source": "..." }`

## Política de dados

- Frontend **não** chama o fornecedor; só server functions do Estufoo.
- **Não** persistimos enunciado, alternativas, gabarito, imagens ou explicações da API.
- Persistimos localmente só **ID externo** + flags/desempenho (`estufoo.provider-question-state`).
- HTML é sanitizado (allowlist) antes de ir à UI.
- Correspondência “exata” exige metadados de banca **e** órgão **e** cargo — não só “VUNESP”.

## Como testar

1. Sem env: aba Provedor → estado “não configurado”; aba Locais funciona.
2. Com env apontando para um stub HTTP que implemente o contrato: listar/paginar/responder.
3. `npm test` — normalização, filtros, sanitize, erros HTTP e redacao de segredos (fetch mockado).
