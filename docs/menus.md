# Estufoo — Guia dos menus

Documento de referência do que cada item da navegação lateral faz na área logada (`/_area`).

A barra superior (concurso ativo, notificações e perfil) também é descrita no final.

---

## 1. Visão geral (`/painel`)

**Objetivo:** dashboard do dia a dia — ver o estado geral da preparação sem entrar em cada módulo.

**O que mostra**

- Concurso ativo e contagem regressiva até a prova
- Barra de **progresso do edital** (%)
- Cards: horas na semana, questões respondidas, taxa de acerto, sequência de dias
- Gráfico de barras da **semana** (horas × acertos)
- Pizza de **distribuição do tempo** (tipo de atividade)
- Lista de sessões de **hoje** (atalho para o Plano)
- **Próximas revisões** (atalho para Revisões)
- **Pontos fracos** e **pontos fortes** por matéria

**Ações**

- Botão “Resolver questões” → `/questoes`

**Dados:** `dashboardService.get`

---

## 2. Plano de estudos (`/plano`)

**Objetivo:** organizar o cronograma semanal de estudo.

**O que mostra**

- Grade de **7 dias** (segunda a domingo)
- Em cada dia: sessões com matéria, tópico, tipo de atividade e duração
- Status visual: planejada, concluída (destaque) ou atrasada (borda vermelha)

**Ações**

| Ação | Descrição |
|------|-----------|
| Navegar semanas | Setas anterior / próxima |
| Nova sessão | Formulário: data, duração, matéria, tópico, atividade, prioridade |
| + no dia | Abre criação já com aquela data |
| Concluir (✓) | Marca sessão como `concluida` |
| Remover (lixeira) | Exclui a sessão |

**Tipos de atividade:** teoria, questões, revisão, simulado  
**Prioridade:** alta, média, baixa

**Dados:** `studyPlansService` (listar, criar, atualizar, remover)

---

## 3. Questões (`/questoes`)

**Objetivo:** treinar no banco de questões de concursos. Ao errar, permite salvar no **caderno de erros** (motivo + gabarito) e agendar revisão.

**Fontes:** (1) **Locais** — catálogo Supabase (seed) quando `VITE_SUPABASE_*` está definido; senão mock; (2) **Provedor (API)** — server functions + `QUESTIONS_API_*`; (3) questões **aprovadas** após importação PDF (`/importacao`). Sem scraping da VUNESP.

---

## 3b. Importar provas (`/importacao`)

**Objetivo:** enviar manualmente PDF de prova (+ gabarito opcional), extrair rascunhos e revisar antes de publicar.

**Fluxo:** upload → extração de texto (`unpdf`) → conferência lado a lado → aprovar / rejeitar / rascunho.

**Regras:** nada aparece em `/questoes` antes da aprovação; sem OCR nesta versão; persistência mock (`localStorage` + `.data/exam-imports`).

**Docs:** `docs/exam-import.md`

**Filtros**

- Banca (Cebraspe, FGV, FCC, Vunesp)
- Matéria
- Ano
- Dificuldade (fácil / média / difícil)
- Situação: todas, respondidas, não respondidas, erradas, favoritas

**Por questão**

1. Ver enunciado e alternativas A–E
2. Escolher alternativa e clicar **Responder**
3. Ver se acertou + **explicação** do gabarito
4. **Favoritar** (estrela)
5. **Marcar para revisão** (marcador) — também cria/agenda item em Revisões

**Paginação** de resultados.

**Dados:** `questionsService` (list, answer, favorite, review)

---

## 3.1 Caderno de erros (`/erros`)

**Objetivo:** revisar erros salvos a partir das questões.

**O que mostra:** enunciado, sua resposta, gabarito e explicação da questão, motivo do erro, matéria/tópico.

**Ações:** agendar/reagendar revisão do tópico, remover do caderno, atalho para questões/revisões. Não duplica a mesma `questionId`.

**Dados:** `errorNotesService` (persistidos no mock/`localStorage`).

---

## 4. Simulados (`/simulados`)

**Objetivo:** simular prova cronometrada ligada ao concurso ativo.

### Lista (`/simulados`)

- Cards com título, nº de questões, tempo limite, data e status
- Pendente → **Iniciar**
- Concluído → **Ver resultado** (mostra nota %)
- **Novo simulado:** título, quantidade de questões, tempo (min), modo de correção (`ao-final` ou `imediata`)

### Prova em andamento (`/simulados/$id`)

- Cronômetro regressivo (envia automaticamente ao zerar)
- Navegação por número das questões
- Marcar alternativas e **Finalizar**

### Resultado (`/simulados/$id/resultado`)

- Nota, % de acerto, tempo usado
- Desempenho por matéria e por tópico
- Lista de erros
- Recomendações de estudo

**Dados:** `examsService`

---

## 5. Mapas mentais (`/mapas`)

**Objetivo:** transformar material de estudo em **mapa mental** (estilo caderno) + **flashcards** de revisão ativa.

### Lista (`/mapas`)

- Cards com título, matéria, nós, flashcards e data
- **Novo projeto:**
  - **Material + IA** — cola texto e/ou PDF pesquisável; gera resumo, mapa e flashcards (revisar antes de salvar)
  - Mapa rápido (IA sem material), tópicos do edital, ou mapa em branco

### Editor (`/mapas/$id`)

- Aba **Mapa:** React Flow com nós tipados (hub, artigo, conceito, explicação), zoom, conexões com rótulo
- Aba **Flashcards:** frente/verso, marcar “lembrei” / “preciso revisar”
- Aba **Resumo:** texto estruturado + avisos da IA + material de origem
- Gerar novos flashcards a partir dos nós selecionados

**IA:** `tutorService.generateStudyPack` / `generateFlashcardsFromNodes` (Gemini no servidor).  
**Dados:** `mindMapsService` (+ sync opcional `study_mind_packs` via `007_study_mind_packs.sql`)

---

## 6. Revisões (`/revisoes`)

**Objetivo:** revisão espaçada (SRS) dos tópicos estudados.

**Grupos**

| Grupo | Critério |
|-------|----------|
| Atrasadas | `dueDate` no passado |
| Hoje | vence hoje |
| Próximas | data futura |

**Como funciona**

1. Para cada tópico, o usuário escolhe **confiança de 1 a 5**
2. O sistema atualiza o domínio e reagenda a próxima data:
   - 1 → +1 dia  
   - 2 → +1 dia  
   - 3 → +3 dias  
   - 4 → +7 dias  
   - 5 → +15 dias  

Revisões também podem nascer ao marcar uma questão “para revisão”.

**Dados:** `reviewsService`

---

## 7. Desempenho (`/desempenho`)

**Objetivo:** analytics mais profundo que o painel (visão histórica).

**Controles:** período **Semanal** ou **Mensal**

**Indicadores**

- Total de questões respondidas
- Horas estudadas
- Tempo médio por questão
- % de revisões em dia

**Gráficos e listas**

- Evolução de acertos (%)
- Barras de horas × questões
- Desempenho **por matéria**
- Desempenho **por tópico**

**Dados:** `dashboardService.performance`

---

## 8. Concursos (`/concursos`)

**Objetivo:** escolher o concurso-alvo e (no futuro) importar editais.

**O que mostra**

- Nome, órgão, banca, data da prova, vagas, salário, status (`aberto` / `previsto` / `encerrado`)

**Filtros:** busca textual, banca, situação

**Ações**

| Ação | Descrição |
|------|-----------|
| Definir como ativo | Grava `activeContestId` no usuário (base do painel, simulados etc.) |
| Importar edital (PDF) | Upload com barra de progresso; no mock cria concurso de exemplo |

**Dados:** `contestsService`

---

## 9. Configurações (`/configuracoes`)

**Objetivo:** conta, taxonomia e importação de questões por PDF.

| Seção | Função |
|-------|--------|
| Perfil | Editar nome e e-mail |
| Matérias e assuntos | Cadastro livre (localStorage) — não há lista fixa no código |
| Importar questões (PDF) | Fila multi-PDF → extração `unpdf` → revisão em `/importacao/$id` |
| Plano de estudos | “Refazer configuração” → volta ao `/onboarding` |
| Sessão | Sair da conta (limpa token e cache) |

**Dados:** `authService` + `examImportService` + `questionTaxonomyStore`  
**Docs:** `docs/exam-import.md`

---

## Elementos da barra superior (todas as telas da área)

Não são itens do menu lateral, mas fazem parte da navegação global:

| Elemento | Função |
|----------|--------|
| Seletor de concurso | Troca o concurso ativo sem ir em Concursos |
| Sino | Lista notificações; clique marca como lida |
| Avatar / nome | Atalho para Configurações e Sair |
| Menu hambúrguer (mobile) | Abre a mesma navegação lateral |

---

## Mapa rápido rota ↔ serviço

| Menu | Rota | Serviço principal |
|------|------|-------------------|
| Visão geral | `/painel` | `dashboardService` |
| Plano de estudos | `/plano` | `studyPlansService` |
| Questões | `/questoes` | `questionsService` |
| Tutor IA | `/tutor` | `tutorService` (Gemini Flash-Lite) |
| Caderno de erros | `/erros` | `errorNotesService` |
| Simulados | `/simulados` | `examsService` |
| Mapas mentais | `/mapas` | `mindMapsService` |
| Revisões | `/revisoes` | `reviewsService` |
| Desempenho | `/desempenho` | `dashboardService` |
| Configurações | `/configuracoes` | `authService` |

> **Nota — persistência:** a API continua mockada. Dados ficam em `localStorage` (`estufoo.mockdb`). O schema SQL em `db/` **não** está conectado. O painel de desempenho (`/desempenho`) ainda usa métricas majoritariamente simuladas; o painel (`/painel`) e o ciclo de erros/revisões usam dados reais do mock local.
