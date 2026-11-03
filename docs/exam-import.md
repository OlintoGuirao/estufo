# Importação manual de questões (PDF)

Envio **manual** de PDFs por usuário autorizado.  
**Não** há bot, scraping, OCR remoto nem envio de PDF a serviços externos pagos.

## Onde usar

1. **Configurações** (`/configuracoes`) — fila multi-PDF, matéria/assunto cadastráveis, resumo por arquivo.
2. **Importar provas** (`/importacao`) — lista de lotes e metadados completos.
3. **Revisão** (`/importacao/$id`) — uma questão por registro, preview do PDF, aprovar só no final.

## Fluxo

1. Arraste/selecione um ou mais PDFs (máx. 15 MB cada).
2. Informe matéria (e assunto opcional) por arquivo — cadastre matérias novas na mesma tela.
3. Extração local com `unpdf` (texto por página).
4. Parser tenta separar questões, alternativas, gabarito (se houver PDF de gabarito) e página.
5. **Revisão obrigatória** — edite, marque revisada, exclua ou confirme importação.
6. Só então a questão aparece em `/questoes` (banco mock local).

## Status da questão

| Status interno | Rótulo na UI |
|----------------|--------------|
| `draft` | Pendente |
| `reviewed` | Revisada (ainda não no banco) |
| `approved` | Importada |
| `rejected` | Excluída |

## Variáveis de ambiente (servidor — sem `VITE_`)

```env
EXAM_IMPORT_ADMIN_EMAILS=
EXAM_IMPORT_STORAGE_DIR=.data/exam-imports
```

Lista de e-mails vazia = modo local aberto (qualquer usuário logado).

## Dependências

| Pacote | Uso |
|--------|-----|
| `unpdf` | Extração de texto por página no servidor |

**OCR:** não há Tesseract/OCR. PDF digitalizado → alerta `needs_ocr` + revisão manual.

## Persistência (limitação atual)

| Dado | Onde |
|------|------|
| Lotes + rascunhos | `localStorage` (`estufoo.exam-imports`) |
| Matérias/assuntos | `localStorage` (`estufoo.question-taxonomy.v1`) |
| Questões aprovadas | Mock `estufoo.mockdb` → `/questoes` |
| Arquivos PDF | `.data/exam-imports/` (servidor, privado) |
| Schema SQL | `db/migrations/002_exam_imports.sql` (**ainda não conectado**) |

## Regras de qualidade

- Gabarito só com correspondência segura número → letra (A–E ou C/E). Em dúvida, fica em branco.
- Duplicata de enunciado: só **alerta**; nunca sobrescreve questão existente.
- Texto extraído não é “corrigido” automaticamente — só edição explícita na revisão.
- Sem IA inventando respostas/comentários neste fluxo.

## Limitações conhecidas

- Extração heurística (regex); layouts muito diferentes exigem edição manual.
- Um gabarito opcional por fila (Configurações), não um gabarito por arquivo.
- Preview do PDF depende do armazenamento local do servidor de desenvolvimento.
- Sem OCR; PDFs escaneados não são lidos automaticamente.
- Persistência ainda é mock/local — não é produção multi-dispositivo.

## Segurança

- Valida `.pdf`, MIME e tamanho (máx. 15 MB).
- PDFs não vão para `public/`.
- Preview via server function + autorização.
- Sem publicação automática.
