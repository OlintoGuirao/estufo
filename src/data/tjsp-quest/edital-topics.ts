/**
 * Conteúdo programático do edital TJSP — Escrevente Técnico Judiciário (VUNESP).
 *
 * Cada item do edital está ligado a uma fase do Quest. A IA recebe a lista de
 * itens da fase e, a cada lote/etapa, um FOCO diferente (rodízio), para que o
 * banco de questões cubra o edital inteiro — não só o assunto "mais fácil".
 *
 * O teste `edital-topics.test.ts` garante que nenhum item fica sem fase.
 */

export type EditalItem = {
  id: string;
  /** Matéria do Quest (subjectId). */
  subject: string;
  /** Fase que ensina/cobra o item (os chefões revisam todos os da matéria). */
  phase: string;
  text: string;
};

const item = (subject: string, phase: string, id: string, text: string): EditalItem => ({
  id,
  subject,
  phase,
  text,
});

export const TJSP_EDITAL_ITEMS: EditalItem[] = [
  // ───────── BLOCO I — Língua Portuguesa (16 questões) ─────────
  item("port", "port-1", "port.textos", "Análise, compreensão e interpretação de textos verbais, não verbais, literários e não literários (charge, tirinha, gráfico, crônica, notícia)"),
  item("port", "port-1", "port.inferencia", "Informações literais e inferências possíveis"),
  item("port", "port-1", "port.ponto-vista", "Ponto de vista do autor"),
  item("port", "port-1", "port.relacoes", "Estruturação do texto: relações entre ideias (causa, consequência, oposição, concessão, conclusão, finalidade)"),
  item("port", "port-1", "port.coesao", "Recursos de coesão (conectivos, pronomes e retomadas/referência)"),
  item("port", "port-2", "port.virgula", "Pontuação: emprego da vírgula (sujeito/verbo, adjuntos deslocados, aposto, vocativo, orações)"),
  item("port", "port-2", "port.pontos", "Pontuação: ponto e vírgula, dois-pontos, ponto final, interrogação e exclamação"),
  item("port", "port-2", "port.travessao", "Pontuação: travessão, parênteses, aspas e reticências"),
  item("port", "port-2", "port.pont-sentido", "Pontuação e mudança de sentido (reescritura com outra pontuação)"),
  item("port", "port-3", "port.substantivo", "Classes de palavras: substantivo — emprego e sentido"),
  item("port", "port-3", "port.adjetivo", "Classes de palavras: adjetivo — emprego e sentido"),
  item("port", "port-3", "port.artigo", "Classes de palavras: artigo — emprego e sentido (definido × indefinido, substantivação)"),
  item("port", "port-3", "port.numeral", "Classes de palavras: numeral — emprego e sentido"),
  item("port", "port-3", "port.pronome", "Classes de palavras: pronome (pessoais, possessivos, demonstrativos, relativos, indefinidos, interrogativos)"),
  item("port", "port-3", "port.verbo", "Classes de palavras: verbo — tempos, modos, vozes e sentido"),
  item("port", "port-3", "port.adverbio", "Classes de palavras: advérbio — circunstâncias e sentido"),
  item("port", "port-3", "port.preposicao", "Classes de palavras: preposição — relações que estabelece"),
  item("port", "port-3", "port.conjuncao", "Classes de palavras: conjunção — coordenativas e subordinativas e o sentido que imprimem"),
  item("port", "port-4", "port.conc-verbal", "Concordância verbal"),
  item("port", "port-4", "port.conc-nominal", "Concordância nominal"),
  item("port", "port-4", "port.reg-verbal", "Regência verbal"),
  item("port", "port-4", "port.reg-nominal", "Regência nominal"),
  item("port", "port-4", "port.colocacao", "Colocação pronominal (próclise, mesóclise, ênclise)"),
  item("port", "port-4", "port.crase", "Crase"),
  item("port", "port-5", "port.contexto", "Significação contextual de palavras e expressões"),
  item("port", "port-5", "port.sinonimos", "Sinônimos e antônimos"),
  item("port", "port-5", "port.figurado", "Sentido próprio e figurado das palavras"),

  // ───────── BLOCO II — Direito Constitucional ─────────
  item("const", "const-1", "const.art5-a", "CF, Título II, Cap. I — art. 5º: igualdade, legalidade, liberdades, inviolabilidades e propriedade (incisos I a XXXVI)"),
  item("const", "const-1", "const.art5-b", "CF, Título II, Cap. I — art. 5º: garantias penais e processuais (incisos XXXVII a LXVII)"),
  item("const", "const-1", "const.remedios", "CF, Título II, Cap. I — remédios constitucionais: habeas corpus, mandado de segurança, mandado de injunção, habeas data, ação popular; §§ do art. 5º"),
  item("const", "const-2", "const.sociais", "CF, Título II, Cap. II — direitos sociais (arts. 6º a 11)"),
  item("const", "const-2", "const.nacionalidade", "CF, Título II, Cap. III — nacionalidade (arts. 12 e 13)"),
  item("const", "const-3", "const.adm-gerais", "CF, Título III, Cap. VII, Seção I — Administração Pública: disposições gerais (arts. 37 e 38)"),
  item("const", "const-3", "const.servidores", "CF, Título III, Cap. VII, Seção II — servidores públicos (arts. 39 a 41)"),
  item("const", "const-3", "const.art92", "CF, art. 92 — órgãos do Poder Judiciário"),

  // ───────── Direito Penal ─────────
  item("penal", "penal-1", "penal.293-297", "CP arts. 293 a 297 — falsificação de papéis públicos, selo/sinal público e documento público"),
  item("penal", "penal-1", "penal.298-302", "CP arts. 298 a 302 — documento particular, cartão, falsidade ideológica, falso reconhecimento de firma, certidão/atestado falso"),
  item("penal", "penal-1", "penal.303-305", "CP arts. 303 a 305 — reprodução/adulteração de selo, uso de documento falso, supressão de documento"),
  item("penal", "penal-1", "penal.307-311A", "CP arts. 307, 308 e 311-A — falsa identidade e fraudes em certames de interesse público"),
  item("penal", "penal-2", "penal.312-317", "CP arts. 312 a 317 — peculato e modalidades, inserção de dados falsos, extravio, emprego irregular, concussão, excesso de exação, corrupção passiva"),
  item("penal", "penal-2", "penal.319-326", "CP arts. 319 a 326 — prevaricação, condescendência criminosa, advocacia administrativa, violência arbitrária, abandono de função, violação de sigilo"),
  item("penal", "penal-2", "penal.327", "CP art. 327 — conceito de funcionário público para fins penais (e equiparado)"),
  item("penal", "penal-2", "penal.328-333", "CP arts. 328 a 333 — usurpação de função, resistência, desobediência, desacato, tráfico de influência, corrupção ativa"),
  item("penal", "penal-2", "penal.336-337", "CP arts. 336 e 337 — inutilização de edital/sinal e subtração ou inutilização de livro ou documento"),
  item("penal", "penal-3", "penal.339-341", "CP arts. 339 a 341 — denunciação caluniosa, comunicação falsa de crime, autoacusação falsa"),
  item("penal", "penal-3", "penal.342-343", "CP arts. 342 e 343 — falso testemunho ou falsa perícia e corrupção de testemunha/perito"),
  item("penal", "penal-3", "penal.344-347", "CP arts. 344 a 347 — coação no curso do processo, exercício arbitrário das próprias razões, fraude processual"),
  item("penal", "penal-3", "penal.357-359", "CP arts. 357 e 359 — exploração de prestígio e desobediência a decisão judicial sobre perda ou suspensão de direito"),

  // ───────── Direito Processual Penal ─────────
  item("procpen", "procpen-1", "procpen.251-258", "CPP arts. 251 a 258 — do juiz e do Ministério Público (impedimentos e suspeição)"),
  item("procpen", "procpen-1", "procpen.261-267", "CPP arts. 261 a 267 — do acusado e seu defensor"),
  item("procpen", "procpen-1", "procpen.274", "CPP art. 274 — suspeição dos serventuários e funcionários da justiça"),
  item("procpen", "procpen-1", "procpen.351-369", "CPP arts. 351 a 369 — citações (pessoal, por mandado, precatória, hora certa, edital)"),
  item("procpen", "procpen-1", "procpen.370-372", "CPP arts. 370 a 372 — intimações"),
  item("procpen", "procpen-2", "procpen.394-405", "CPP arts. 394 a 405 — procedimento comum: ritos, recebimento da denúncia, resposta à acusação, absolvição sumária, audiência de instrução"),
  item("procpen", "procpen-2", "procpen.406-421", "CPP arts. 406 a 421 — Júri: acusação e instrução preliminar, pronúncia, impronúncia, desclassificação e absolvição sumária"),
  item("procpen", "procpen-2", "procpen.422-497", "CPP arts. 422 a 497 — Júri: preparação do plenário, alistamento, sorteio, jurados, julgamento, quesitos e sentença"),
  item("procpen", "procpen-2", "procpen.531-538", "CPP arts. 531 a 538 — procedimento sumário"),
  item("procpen", "procpen-2", "procpen.541-548", "CPP arts. 541 a 548 — restauração de autos extraviados ou destruídos"),
  item("procpen", "procpen-3", "procpen.574-592", "CPP arts. 574 a 592 — recursos: disposições gerais e recurso em sentido estrito"),
  item("procpen", "procpen-3", "procpen.593-620", "CPP arts. 593 a 620 — apelação, protesto, embargos e procedimento nos tribunais"),
  item("procpen", "procpen-3", "procpen.621-646", "CPP arts. 621 a 646 — revisão criminal, recurso extraordinário e carta testemunhável"),
  item("procpen", "procpen-3", "procpen.647-667", "CPP arts. 647 a 667 — habeas corpus e seu processo"),
  item("procpen", "procpen-3", "procpen.9099-60-76", "Lei 9.099/95 arts. 60 a 76 — Juizado Especial Criminal: competência, atos, fase preliminar, composição civil e transação penal"),
  item("procpen", "procpen-3", "procpen.9099-77-83", "Lei 9.099/95 arts. 77 a 83 — procedimento sumaríssimo"),
  item("procpen", "procpen-3", "procpen.9099-88-89", "Lei 9.099/95 arts. 88 e 89 — representação nas lesões leves/culposas e suspensão condicional do processo"),

  // ───────── Direito Processual Civil ─────────
  item("procciv", "procciv-1", "procciv.144-148", "CPC arts. 144 a 148 — impedimento e suspeição"),
  item("procciv", "procciv-1", "procciv.149-155", "CPC arts. 149 a 155 — auxiliares da justiça: escrivão/chefe de secretaria e oficial de justiça"),
  item("procciv", "procciv-1", "procciv.188-211", "CPC arts. 188 a 211 — forma dos atos processuais, atos das partes, pronunciamentos do juiz, atos do escrivão"),
  item("procciv", "procciv-1", "procciv.212-235", "CPC arts. 212 a 235 — tempo e lugar dos atos e prazos"),
  item("procciv", "procciv-1", "procciv.236-275", "CPC arts. 236 a 275 — comunicação dos atos: cartas, citação e intimações"),
  item("procciv", "procciv-1", "procciv.294-311", "CPC arts. 294 a 311 — tutela provisória: urgência (antecipada e cautelar) e evidência"),
  item("procciv", "procciv-2", "procciv.318-334", "CPC arts. 318 a 334 — petição inicial, improcedência liminar, audiência de conciliação ou mediação"),
  item("procciv", "procciv-2", "procciv.335-368", "CPC arts. 335 a 368 — contestação, reconvenção, revelia, providências preliminares, julgamento conforme o estado e saneamento"),
  item("procciv", "procciv-2", "procciv.369-484", "CPC arts. 369 a 484 — provas e audiência de instrução e julgamento"),
  item("procciv", "procciv-2", "procciv.485-512", "CPC arts. 485 a 512 — sentença, coisa julgada e liquidação"),
  item("procciv", "procciv-2", "procciv.513-538", "CPC arts. 513 a 538 — cumprimento de sentença"),
  item("procciv", "procciv-2", "procciv.994-1008", "CPC arts. 994 a 1008 — recursos: disposições gerais e apelação"),
  item("procciv", "procciv-2", "procciv.1009-1026", "CPC arts. 1009 a 1026 — agravo de instrumento, agravo interno e embargos de declaração"),
  item("procciv", "procciv-3", "procciv.9099-3-19", "Lei 9.099/95 arts. 3º a 19 — Juizado Especial Cível: competência, juiz, conciliadores, partes, atos, pedido, citações e intimações"),
  item("procciv", "procciv-3", "procciv.12153", "Lei 12.153/2009 — Juizados Especiais da Fazenda Pública"),

  // ───────── Direito Administrativo ─────────
  item("admin", "admin-1", "admin.10261-1-86", "Lei 10.261/68 (Estatuto SP) arts. 1º a 86 — cargos, provimento, nomeação, posse, exercício, estágio probatório, vacância e movimentação"),
  item("admin", "admin-1", "admin.10261-171-175", "Lei 10.261/68 arts. 171 a 175"),
  item("admin", "admin-1", "admin.10261-239-323", "Lei 10.261/68 arts. 239 a 323 — direito de petição, deveres, proibições, responsabilidades, penalidades, sindicância e processo administrativo"),
  item("admin", "admin-2", "admin.8429-sujeitos", "Lei 8.429/92 — disposições gerais, dolo e sujeitos (arts. 1º a 8º)"),
  item("admin", "admin-2", "admin.8429-atos", "Lei 8.429/92 — atos de improbidade: enriquecimento ilícito, prejuízo ao erário e violação a princípios (arts. 9º a 11)"),
  item("admin", "admin-2", "admin.8429-penas", "Lei 8.429/92 — sanções, declaração de bens, procedimento e prescrição (arts. 12 a 23)"),

  // ───────── Legislação Interna ─────────
  item("legis", "legis-1", "legis.res850", "Resolução TJSP nº 850/2021 — teletrabalho"),
  item("legis", "legis-1", "legis.res963", "Resolução TJSP nº 963/2025 — eproc"),
  item("legis", "legis-2", "legis.lc1111", "Lei Complementar estadual nº 1.111/2010 — Plano de Cargos e Carreiras dos servidores do TJSP"),
  item("legis", "legis-2", "legis.regimento", "Regimento Interno do TJSP"),
  item("legis", "legis-3", "legis.nscgj-c2", "NSCGJ Tomo I, Cap. II, Seção I, Subseções I e II"),
  item("legis", "legis-3", "legis.nscgj-c3-a", "NSCGJ Tomo I, Cap. III, Seções I, II, V, VI e VII"),
  item("legis", "legis-3", "legis.nscgj-c3-b", "NSCGJ Tomo I, Cap. III, Seção VIII, Subseções I, II e III"),
  item("legis", "legis-3", "legis.nscgj-c3-c", "NSCGJ Tomo I, Cap. III, Seções IX a XIX"),
  item("legis", "legis-3", "legis.nscgj-c11", "NSCGJ Tomo I, Cap. XI, Seções I a VII"),

  // ───────── BLOCO III — Atualidades (04) ─────────
  item("atual", "atual-1", "atual.13146-1-13", "Lei 13.146/2015 arts. 1º a 13 — disposições gerais, igualdade e não discriminação, atendimento prioritário"),
  item("atual", "atual-1", "atual.13146-34-38", "Lei 13.146/2015 arts. 34 a 38 — direito ao trabalho, habilitação/reabilitação e inclusão no trabalho"),
  item("atual", "atual-2", "atual.politica", "Atualidades: fatos políticos nacionais e internacionais a partir do 1º semestre de 2026"),
  item("atual", "atual-2", "atual.economia", "Atualidades: fatos econômicos nacionais e internacionais a partir do 1º semestre de 2026"),
  item("atual", "atual-2", "atual.social", "Atualidades: fatos sociais e culturais nacionais e internacionais a partir do 1º semestre de 2026"),

  // ───────── Matemática (04) ─────────
  item("mat", "mat-1", "mat.reais", "Operações com números reais"),
  item("mat", "mat-1", "mat.mmc-mdc", "Mínimo múltiplo comum e máximo divisor comum"),
  item("mat", "mat-1", "mat.razao", "Razão e proporção"),
  item("mat", "mat-1", "mat.porcentagem", "Porcentagem"),
  item("mat", "mat-1", "mat.regra-tres", "Regra de três simples e composta"),
  item("mat", "mat-1", "mat.juros", "Juros simples"),
  item("mat", "mat-2", "mat.equacoes", "Equação do 1º e do 2º graus"),
  item("mat", "mat-2", "mat.sistemas", "Sistema de equações do 1º grau"),
  item("mat", "mat-2", "mat.geometria", "Noções de geometria: forma, perímetro, área, volume, ângulo, teorema de Pitágoras"),
  item("mat", "mat-3", "mat.medias", "Média aritmética simples e ponderada"),
  item("mat", "mat-3", "mat.graficos", "Relação entre grandezas: tabelas e gráficos"),
  item("mat", "mat-3", "mat.medidas", "Sistemas de medidas usuais"),
  item("mat", "mat-3", "mat.problemas", "Resolução de situações-problema"),

  // ───────── Informática (09) ─────────
  item("info", "info-1", "info.win-arquivos", "Windows 10+: pastas, diretórios, arquivos e manipulação de arquivos e pastas"),
  item("info", "info-1", "info.win-atalhos", "Windows 10+: atalhos, área de trabalho e área de transferência"),
  item("info", "info-1", "info.win-programas", "Windows 10+: uso dos menus, programas e aplicativos; interação com o Microsoft 365"),
  item("info", "info-2", "info.word-formatacao", "Word: estrutura básica, edição e formatação de textos, fontes, parágrafos, marcadores"),
  item("info", "info-2", "info.word-layout", "Word: cabeçalhos, colunas, quebras, numeração de páginas e impressão"),
  item("info", "info-2", "info.word-objetos", "Word: tabelas, legendas, índices, inserção de objetos, campos predefinidos e caixas de texto"),
  item("info", "info-3", "info.excel-basico", "Excel: células, linhas, colunas, pastas, impressão e quebras"),
  item("info", "info-3", "info.excel-formulas", "Excel: fórmulas e funções"),
  item("info", "info-3", "info.excel-dados", "Excel: tabelas, gráficos, macros, objetos, campos, numeração, obtenção de dados externos e classificação"),
  item("info", "info-4", "info.email", "Correio eletrônico: preparo e envio de mensagens, anexação de arquivos"),
  item("info", "info-5", "info.internet", "Internet: navegação, URL, links, sites, busca e impressão de páginas"),
  item("info", "info-6", "info.teams", "MS Teams: chats, chamadas de áudio e vídeo, grupos, trabalho em equipe com Word/Excel/PowerPoint/SharePoint/OneNote, agendamento e gravação de reuniões"),
  item("info", "info-7", "info.onedrive", "OneDrive: armazenamento e compartilhamento de arquivos e pastas"),

  // ───────── Raciocínio Lógico (07) ─────────
  item("rlm", "rlm-1", "rlm.relacoes", "Estrutura lógica de relações arbitrárias entre pessoas, lugares, coisas ou eventos fictícios"),
  item("rlm", "rlm-1", "rlm.deducao", "Deduzir novas informações das relações fornecidas e avaliar as condições usadas para estabelecer a estrutura"),
  item("rlm", "rlm-2", "rlm.estruturas", "Estruturas lógicas: proposições, conectivos, negação e equivalências"),
  item("rlm", "rlm-2", "rlm.argumentacao", "Lógica de argumentação: validade, premissas e conclusão"),
  item("rlm", "rlm-3", "rlm.diagramas", "Diagramas lógicos (todo, algum, nenhum)"),
  item("rlm", "rlm-4", "rlm.seq-numericas", "Sequências numéricas: compreensão do processo e identificação de termos"),
  item("rlm", "rlm-4", "rlm.seq-figurais", "Sequências figurais e de letras/palavras"),
];

const CHEFAO_BY_SUBJECT: Record<string, string> = {
  port: "port-6",
  const: "const-4",
  penal: "penal-4",
  procpen: "procpen-4",
  procciv: "procciv-4",
  admin: "admin-3",
  legis: "legis-4",
  atual: "atual-3",
  mat: "mat-4",
  info: "info-8",
  rlm: "rlm-5",
};

/** Itens do edital cobrados numa fase (o chefão revisa todos da matéria). */
export function editalItemsForPhase(phaseId: string): EditalItem[] {
  const subject = Object.entries(CHEFAO_BY_SUBJECT).find(([, p]) => p === phaseId)?.[0];
  if (subject) return TJSP_EDITAL_ITEMS.filter((i) => i.subject === subject);
  return TJSP_EDITAL_ITEMS.filter((i) => i.phase === phaseId);
}

/**
 * Itens em foco num lote: rodízio pela quantidade de questões que a fase já
 * tem. Assim cada etapa da trilha (5 questões) puxa itens diferentes e, ao
 * longo da trilha, o edital da fase é coberto por inteiro.
 */
export function editalFocusForPhase(
  phaseId: string,
  existingCount: number,
  howMany = 3,
): EditalItem[] {
  const items = editalItemsForPhase(phaseId);
  if (items.length <= howMany) return items;
  const start = Math.floor(Math.max(0, existingCount) / 5) * howMany;
  return Array.from({ length: howMany }, (_, k) => items[(start + k) % items.length]!);
}

export const QUEST_CHEFAO_PHASES = CHEFAO_BY_SUBJECT;
