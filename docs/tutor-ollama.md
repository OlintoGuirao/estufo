# Tutor IA (Gemini 2.5 Flash-Lite)

Tutor de estudos via **Google Gemini** no servidor. Modelo padrão: `gemini-3.5-flash-lite`.

Ollama permanece apenas como **fallback** se `GEMINI_API_KEY` / `GEMINI_USE_MOCK` não estiverem ativos.

## Variáveis de ambiente (servidor)

```env
GEMINI_API_KEY=sua-chave
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=60000
# Só para UI sem chave — respostas vêm rotuladas como mock
GEMINI_USE_MOCK=false
```

Sem prefixo `VITE_` — a chave nunca vai para o browser.

### Fallback Ollama (opcional)

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:4b
OLLAMA_TIMEOUT_MS=60000
OLLAMA_USE_MOCK=false
```

Usado só quando Gemini não está `enabled` (`apiKey` ausente e `GEMINI_USE_MOCK` off).

## Setup rápido

1. Crie uma chave em [Google AI Studio](https://aistudio.google.com/apikey).
2. Copie de `.env.example` e preencha `GEMINI_API_KEY`.
3. Reinicie o servidor de desenvolvimento.
4. Em `/tutor`, confira o status do modelo.

Para desenvolver a UI sem gastar cota: `GEMINI_USE_MOCK=true`.

## Código

- Camada única: `src/server/tutor-llm.ts` (`tutorChat`, `checkTutorLlmStatus`)
- Gemini: `src/server/gemini/**`
- Fallback Ollama: `src/server/ollama/**`
- Handlers: `src/services/tutor.fns.ts`

## Troubleshooting

| Sintoma | Ação |
| --- | --- |
| Status “Indisponível” / chave ausente | Definir `GEMINI_API_KEY` no `.env` |
| Modelo ausente | Conferir `GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`) |
| Timeout | Aumentar `GEMINI_TIMEOUT_MS` |
| Respostas “mockadas” | Desligar `GEMINI_USE_MOCK` |
