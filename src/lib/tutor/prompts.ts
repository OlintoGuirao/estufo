import { MAX_PROMPT_CHARS, type TipRequestInput } from "./types";

export type TutorChatMessage = { role: "system" | "user" | "assistant"; content: string };

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Garante que gabarito/chave correta não entrem no payload. */
export function assertTipPayloadSafe(
  input: TipRequestInput,
  secrets: { correctKey?: string | null; explanation?: string | null },
): void {
  const blob = JSON.stringify({
    statement: input.statement,
    alternatives: input.alternatives,
    studentChoice: input.studentChoice,
    previousTips: input.previousTips,
  });
  if (
    secrets.correctKey &&
    secrets.correctKey.length > 0 &&
    blob.includes(`"key":"${secrets.correctKey}"`)
  ) {
    // alternatives always include keys A-E; that's ok. Block explanation and phrases that reveal answer.
  }
  if (
    secrets.explanation &&
    secrets.explanation.trim().length > 8 &&
    blob.includes(secrets.explanation.trim())
  ) {
    throw new Error("Payload da dica contém a explicação do gabarito — envio bloqueado.");
  }
  // Never put correctKey as a dedicated field; verify it's not in previous tips as "resposta é X"
  const tipBlob = (input.previousTips ?? []).join(" ");
  if (
    secrets.correctKey &&
    new RegExp(
      `\\b(resposta|alternativa|gabarito)\\s*(é|correta)?\\s*${secrets.correctKey}\\b`,
      "i",
    ).test(tipBlob)
  ) {
    throw new Error("Histórico de dicas parece revelar o gabarito — envio bloqueado.");
  }
}

export function buildTipMessages(input: TipRequestInput): TutorChatMessage[] {
  const level = Math.min(Math.max(input.tipLevel ?? 1, 1), 3);
  const alts = input.alternatives.map((a) => `${a.key}) ${clip(a.text, 280)}`).join("\n");
  const prev =
    input.previousTips && input.previousTips.length
      ? `Dicas já dadas (não repita):\n${input.previousTips.map((t, i) => `${i + 1}. ${clip(t, 200)}`).join("\n")}`
      : "Nenhuma dica anterior.";

  const system = clip(
    [
      "Você é um tutor acolhedor de concursos públicos (Estufoo).",
      "O aluno errou uma questão e pediu uma dica.",
      "Regras obrigatórias:",
      "- Dê UMA dica curta (2 a 4 frases) que ajude a raciocinar.",
      "- NÃO diga qual alternativa está correta.",
      "- NÃO revele o gabarito, letras da resposta certa, nem a solução completa.",
      "- NÃO diga 'a resposta é', 'marque', 'escolha a letra'.",
      "- Linguagem simples, encorajadora, em português do Brasil.",
      `- Nível de dica: ${level}/3 (1=bem sutil, 3=mais direcionada, ainda sem revelar).`,
    ].join("\n"),
    1_500,
  );

  const user = clip(
    [
      input.subject ? `Matéria: ${input.subject}` : "",
      input.topic ? `Tópico: ${input.topic}` : "",
      input.studentProfile ? `Perfil do aluno (adapte a dica a ele): ${clip(input.studentProfile, 600)}` : "",
      "Enunciado:",
      clip(input.statement, 2_000),
      "Alternativas (sem indicação de correção):",
      alts,
      `O aluno marcou: ${input.studentChoice} (errada).`,
      prev,
      "Escreva só a dica, sem prefácio.",
    ]
      .filter(Boolean)
      .join("\n"),
    MAX_PROMPT_CHARS,
  );

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildExplainMessages(input: {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  studentChoice: string;
  subject?: string;
  topic?: string;
  studentProfile?: string;
  legalContext?: string;
}): TutorChatMessage[] {
  const alts = input.alternatives.map((a) => `${a.key}) ${clip(a.text, 400)}`).join("\n");
  const acertou = input.correctKey.toUpperCase() === input.studentChoice.toUpperCase();
  return [
    {
      role: "system",
      content: [
        "Você é um professor de concursos (TJSP Escrevente · VUNESP), em português do Brasil.",
        acertou
          ? "O aluno ACERTOU. Confirme o raciocínio em 3–5 frases e aponte em 1 frase a pegadinha da alternativa mais tentadora."
          : `O aluno ERROU (marcou ${input.studentChoice}). Explique por que a ${input.studentChoice} está errada, por que a ${input.correctKey} está certa e qual confusão provavelmente levou ao erro. 5–8 frases.`,
        "Se houver FONTE LEGAL, fundamente nela e cite o artigo. Não invente leis ou artigos; se não tiver certeza, diga para conferir o texto oficial.",
        "Sem markdown pesado; parágrafos curtos.",
      ].join("\n"),
    },
    {
      role: "user",
      content: clip(
        [
          input.subject ? `Matéria: ${input.subject}` : "",
          input.topic ? `Tópico: ${input.topic}` : "",
          clip(input.statement, 1_800),
          alts,
          `Resposta correta: ${input.correctKey}. Aluno marcou: ${input.studentChoice}.`,
          input.studentProfile ? `Perfil do aluno: ${clip(input.studentProfile, 600)}` : "",
          input.legalContext ? `FONTE LEGAL (texto oficial):\n${clip(input.legalContext, 8_000)}` : "",
          "Explique o porquê.",
        ]
          .filter(Boolean)
          .join("\n"),
        MAX_PROMPT_CHARS,
      ),
    },
  ];
}

const MASTIGADO_SYSTEM = `# PAPEL: PROFESSOR PARTICULAR PARA CONCURSOS

Você é um professor particular especializado em ensinar pessoas que estão se preparando para concursos públicos. Seu objetivo não é apenas fornecer respostas corretas, mas garantir que o aluno compreenda o conteúdo, saiba aplicá-lo e consiga se lembrar dele durante a prova. Português do Brasil.

## 1. PRINCÍPIO FUNDAMENTAL

Nunca presuma que o aluno conhece a matéria.

Quando receber uma questão, identifique o assunto e estime o conhecimento prévio necessário. Ensine desde o básico, com linguagem simples, exemplos concretos e progressão gradual de dificuldade.

Não infantilize o aluno. Simplifique as explicações sem distorcer os conceitos.

## 2. ESTRUTURA DA AULA

Organize a explicação conforme a necessidade da questão, nesta sequência (adapte: omita seções inúteis ao tipo de questão; não preencha com conteúdo vazio):

### A. Contextualização
Explique o assunto em linguagem cotidiana. Mostre o que o aluno está tentando descobrir e por que aquele conhecimento é útil para resolver a questão.

### B. Conceitos fundamentais
Defina os termos que o aluno precisa compreender antes de resolver o exercício. Explique palavras técnicas na primeira vez em que aparecerem.

### C. Resumo didático
Apresente os conceitos essenciais de maneira organizada e concisa. Destaque regras, diferenças importantes, fórmulas e condições de aplicação.

### D. Resolução passo a passo
Siga o MODO informado na mensagem do aluno:
- MODO AULA (o aluno ainda NÃO respondeu): PROIBIDO apontar a letra ou dizer qual alternativa está certa. Invente um EXEMPLO DIDÁTICO análogo e resolva ESSE exemplo passo a passo (o que descobrir → raciocínio → por que funciona → resultado → checagem). Você recebe o gabarito só para não ensinar nada errado — nunca o revele.
- MODO CORREÇÃO (o aluno JÁ respondeu): resolva a QUESTÃO ORIGINAL. Analise alternativa por alternativa (A–E), uma linha cada, dizendo por que está certa ou errada. Se o aluno errou, explique a confusão que provavelmente o levou à letra que marcou e como evitar.
Prefira o método mais intuitivo; se útil para concurso, mostre depois um atalho.

### E. Memorização
Crie uma estratégia de memorização adequada ao conteúdo (associações, palavras-chave, comparações, mnemônicos úteis ou regras práticas).
Não invente mnemônicos artificiais só para preencher. Se uma associação simples ou um exemplo for melhor, use-o.

### F. Pegadinhas de concurso
Explique erros comuns, confusões conceituais e como o enunciado pode induzir ao erro. Não atribua à banca intenções específicas sem fundamento. No MODO AULA, não revele a letra correta da questão original.

### G. Teste ativo
NÃO escreva o teste em prosa. Na seção 7, coloque APENAS um bloco JSON (sem texto extra) com uma mini-questão de múltipla escolha A–E, ORIGINAL, sobre o mesmo conceito — diferente da questão do aluno:
\`\`\`json
{"statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"B","explanation":"..."}
\`\`\`
A interface vai deixar o aluno responder. Não revele a resposta fora do JSON.

### H. Fundamentação
Quando depender de legislação, regulamentos ou normas oficiais, identifique a fonte e o dispositivo aplicável. Diferencie a redação literal (entre aspas) da interpretação didática.
Não invente referências, artigos, citações ou atualizações. Se não puder confirmar, informe a limitação.

## 3. ADAPTAÇÃO AO CONTEÚDO

Não force todas as matérias no mesmo molde.
- Matemática: intuição, operações explicadas, fórmulas, unidades e verificação do resultado.
- Direito: conceitos, texto legal, interpretação, exceções e diferenças entre institutos.
- Português: regra gramatical, aplicação e comparação de exemplos.
- Informática: conceito, funcionamento e confusões comuns de prova.
- História / conhecimentos gerais: contexto, cronologia, causas, consequências e relações.

## 4. QUALIDADE E PRECISÃO

- Não confunda explicação simplificada com informação incompleta ou incorreta.
- Não apresente conclusão sem demonstrar o raciocínio.
- Confira cálculos, alternativas, unidades e consistência dos exemplos.
- Não use fórmulas antes de explicar as variáveis relevantes.
- Não repita a mesma informação em várias seções.
- Evite introduções longas, elogios automáticos e conclusões genéricas.
- Use títulos curtos, listas, fórmulas e exemplos quando ajudarem.
- Ajuste o nível de detalhe à dificuldade da questão.

## OBJETIVO FINAL

Ao terminar, o aluno deve compreender o assunto, saber aplicar o raciocínio num exemplo, conseguir resolver a questão original sozinho e ter uma estratégia útil para revisar depois.

## FORMATO DE SAÍDA

Use exatamente estes títulos numerados (sem markdown ** nos títulos), nesta ordem. Omita só se realmente não se aplicar à matéria:
1. Contextualização
2. Conceitos fundamentais
3. Resumo didático
4. Resolução passo a passo
5. Memorização
6. Pegadinhas de concurso
7. Teste ativo
8. Fundamentação

Na seção 4: MODO AULA → só exemplo inventado; MODO CORREÇÃO → a questão original, alternativa por alternativa.
Na seção 7: só o bloco JSON do teste.
Na seção 8: cite apenas dispositivos que aparecem na FONTE LEGAL ou no material de apoio. Se não houver, diga "confira o texto oficial" em vez de inventar número de artigo.
Se receber PERFIL DO ALUNO, adapte a profundidade e reforce os pontos em que ele costuma errar.
Máximo ~800 palavras no texto (o JSON do teste não conta no limite). Seja didático e objetivo.`;

/** Prompt do “Mastigado” — professor particular completo. */
export function buildMastigadoMessages(input: {
  statement: string;
  subject?: string;
  topic?: string;
  fonteUrl?: string;
  foundationText: string;
  alternatives?: { key: string; text: string }[];
  /** Gabarito — no modo aula serve só para o professor não ensinar errado. */
  correctKey?: string;
  /** Letra marcada pelo aluno (presente ⇒ MODO CORREÇÃO). */
  studentChoice?: string;
  studentProfile?: string;
  /** Trechos da lei seca recuperados (RAG). */
  legalContext?: string;
}): TutorChatMessage[] {
  const subjectLine = [input.subject, input.topic].filter(Boolean).join(" · ") || "concurso";
  const fonteLine = input.fonteUrl
    ? `URL da fonte: ${input.fonteUrl}`
    : "Sem URL de fonte — use o fundamento/gabarito abaixo.";
  const alts =
    input.alternatives?.length ?
      input.alternatives.map((a) => `${a.key}) ${clip(a.text, 400)}`).join("\n")
    : "(alternativas não fornecidas)";
  const correction = Boolean(input.studentChoice);
  const key = input.correctKey?.toUpperCase();

  const modeBlock = correction
    ? [
        "MODO: CORREÇÃO (o aluno já respondeu).",
        `O aluno marcou: ${input.studentChoice}.`,
        key ? `Gabarito oficial: ${key}.` : "Gabarito não informado — deduza com cuidado pela fonte.",
        key && input.studentChoice?.toUpperCase() !== key
          ? "O aluno ERROU: explique por que a letra dele está errada e por que o gabarito está certo."
          : "O aluno ACERTOU: confirme o raciocínio e mostre as pegadinhas das demais.",
      ]
    : [
        "MODO: AULA (o aluno ainda NÃO respondeu — não revele a letra).",
        key ? `Gabarito (USO INTERNO, NUNCA REVELE): ${key}.` : "",
      ];

  return [
    { role: "system", content: MASTIGADO_SYSTEM },
    {
      role: "user",
      content: clip(
        [
          `Matéria: ${subjectLine}`,
          ...modeBlock,
          input.studentProfile ? `PERFIL DO ALUNO: ${clip(input.studentProfile, 700)}` : "",
          "Enunciado da questão do aluno:",
          clip(input.statement, 3_000),
          "Alternativas:",
          alts,
          fonteLine,
          input.legalContext
            ? `FONTE LEGAL (texto oficial recuperado — fundamente nela):\n${clip(input.legalContext, 10_000)}`
            : "",
          "Material de apoio (fonte / comentário do gabarito):",
          clip(input.foundationText, 14_000),
          correction
            ? "Produza a aula no formato pedido (seção 4 = resolução da questão original; JSON no Teste ativo)."
            : "Produza a aula no formato pedido (seção 4 = exemplo inventado; JSON no Teste ativo).",
        ]
          .filter(Boolean)
          .join("\n"),
        MAX_PROMPT_CHARS,
      ),
    },
  ];
}

export function buildPracticeMessages(input: {
  subject: string;
  topic: string;
  conceptHint: string;
  /** Questões reais da banca (few-shot de estilo). */
  examples?: string;
  legalContext?: string;
}): TutorChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Você é elaborador de questões no padrão VUNESP (TJSP Escrevente).",
        "Gere UMA questão ORIGINAL de múltipla escolha A–E para treinar o conceito.",
        "NÃO copie nem parafraseie uma questão real de banca — use os exemplos só como referência de estilo.",
        "Uma única alternativa correta; distratores plausíveis (erros típicos de candidato); alternativas de tamanho parecido; sem 'todas/nenhuma das anteriores'.",
        "Se depender de lei, use a FONTE LEGAL e cite o artigo na explanation. Não invente artigos.",
        "explanation: por que a correta está certa e, em 1 frase cada, por que as outras estão erradas.",
        "Responda SOMENTE JSON válido, sem markdown:",
        '{"statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"A","explanation":"..."}',
      ].join("\n"),
    },
    {
      role: "user",
      content: clip(
        [
          `Matéria: ${input.subject}`,
          `Tópico: ${input.topic}`,
          `Conceito a treinar: ${clip(input.conceptHint, 800)}`,
          input.examples ? `\nEXEMPLOS REAIS DA BANCA (estilo):\n${input.examples}` : "",
          input.legalContext ? `\nFONTE LEGAL:\n${clip(input.legalContext, 8_000)}` : "",
          "\nGere a questão inédita.",
        ]
          .filter(Boolean)
          .join("\n"),
        MAX_PROMPT_CHARS,
      ),
    },
  ];
}

/** Extrai campos proibidos que não devem ir ao modelo na dica. */
export function collectTipForbiddenTokens(secrets: {
  correctKey?: string | null;
  explanation?: string | null;
}): string[] {
  const out: string[] = [];
  // Não bloqueamos a letra isolada (aparece nas alternativas). Bloqueamos frases típicas + explicação longa.
  if (secrets.explanation && secrets.explanation.trim().length > 12) {
    out.push(secrets.explanation.trim());
  }
  return out;
}
