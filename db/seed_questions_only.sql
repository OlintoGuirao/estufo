-- Reinsere só as questões do seed (idempotente).
-- Use se questions estiver vazia no Supabase.

BEGIN;

INSERT INTO questions (
  id, statement, board, year, contest_id, contest_label,
  subject_id, topic_id, difficulty, source, correct_key, explanation
) VALUES
  (
    'd0000001-0001-0001-0001-000000000001',
    'É segurado obrigatório do RGPS na qualidade de contribuinte individual:',
    'Cebraspe', 2019, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111101',
    'facil', 'Prova Cebraspe 2019', 'B',
    'O síndico remunerado é contribuinte individual (art. 11, V, f, Lei 8.213/91).'
  ),
  (
    'd0000002-0002-0002-0002-000000000002',
    'A carência para concessão do auxílio por incapacidade temporária, em regra, é de:',
    'FGV', 2020, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111102',
    'media', 'Prova FGV 2020', 'D',
    'A regra geral exige 12 contribuições mensais (art. 25, I).'
  ),
  (
    'd0000003-0003-0003-0003-000000000003',
    'Assinale a frase em que o uso do acento grave está correto:',
    'Vunesp', 2021, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222203',
    'dificil', 'Prova Vunesp 2021', 'C',
    'Há crase antes de palavra feminina regida pela preposição ''a'' (chegar a + a cidade).'
  ),
  (
    'd0000004-0004-0004-0004-000000000004',
    'Está correta a concordância em:',
    'FCC', 2022, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222202',
    'facil', 'Prova FCC 2022', 'D',
    'O verbo ''fazer'' indicando tempo é impessoal e fica no singular.'
  ),
  (
    'd0000005-0005-0005-0005-000000000005',
    'O habeas data é a ação constitucional adequada para:',
    'Cebraspe', 2023, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333301',
    'media', 'Prova Cebraspe 2023', 'B',
    'Art. 5º, LXXII, CF: garante acesso e retificação de informações relativas ao impetrante.'
  ),
  (
    'd0000006-0006-0006-0006-000000000006',
    'A seguridade social compreende:',
    'FGV', 2024, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333302',
    'dificil', 'Prova FGV 2024', 'A',
    'Art. 194 da CF define o tripé: saúde, previdência e assistência social.'
  ),
  (
    'd0000007-0007-0007-0007-000000000007',
    'A negação de ''Todo servidor é pontual'' é:',
    'Vunesp', 2019, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444401',
    'facil', 'Prova Vunesp 2019', 'B',
    'A negação de ''todo A é B'' é ''algum A não é B''.'
  ),
  (
    'd0000008-0008-0008-0008-000000000008',
    'Ao lançar um dado honesto, a probabilidade de sair número par é:',
    'FCC', 2020, 'a1111111-1111-1111-1111-111111111111', 'INSS 2026',
    'b4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444402',
    'media', 'Prova FCC 2020', 'C',
    'Há 3 pares em 6 faces: 3/6 = 1/2.'
  ),
  (
    'd0000009-0009-0009-0009-000000000009',
    'Compete aos Municípios instituir imposto sobre:',
    'Cebraspe', 2021, 'a2222222-2222-2222-2222-222222222222', 'Receita Federal',
    'b5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555501',
    'dificil', 'Prova Cebraspe 2021', 'B',
    'O ISS é de competência municipal (art. 156, III, CF).'
  ),
  (
    'd0000010-0010-0010-0010-000000000010',
    'No balanço patrimonial, o grupo ''Patrimônio Líquido'' representa:',
    'FGV', 2022, 'a2222222-2222-2222-2222-222222222222', 'Receita Federal',
    'b6666666-6666-6666-6666-666666666666', 'c6666666-6666-6666-6666-666666666601',
    'facil', 'Prova FGV 2022', 'B',
    'PL = Ativo − Passivo, ou seja, recursos próprios.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO question_alternatives (question_id, key, text) VALUES
  ('d0000001-0001-0001-0001-000000000001', 'A', 'O empregado doméstico'),
  ('d0000001-0001-0001-0001-000000000001', 'B', 'O síndico de condomínio remunerado'),
  ('d0000001-0001-0001-0001-000000000001', 'C', 'O trabalhador avulso'),
  ('d0000001-0001-0001-0001-000000000001', 'D', 'O segurado especial'),
  ('d0000001-0001-0001-0001-000000000001', 'E', 'O estagiário'),
  ('d0000002-0002-0002-0002-000000000002', 'A', 'Nenhuma'),
  ('d0000002-0002-0002-0002-000000000002', 'B', '6 contribuições'),
  ('d0000002-0002-0002-0002-000000000002', 'C', '10 contribuições'),
  ('d0000002-0002-0002-0002-000000000002', 'D', '12 contribuições'),
  ('d0000002-0002-0002-0002-000000000002', 'E', '24 contribuições'),
  ('d0000003-0003-0003-0003-000000000003', 'A', 'Fui à pé ao trabalho.'),
  ('d0000003-0003-0003-0003-000000000003', 'B', 'Entreguei o relatório à ela.'),
  ('d0000003-0003-0003-0003-000000000003', 'C', 'Chegamos à cidade cedo.'),
  ('d0000003-0003-0003-0003-000000000003', 'D', 'Começou à chover.'),
  ('d0000003-0003-0003-0003-000000000003', 'E', 'Refiro-me à esse caso.'),
  ('d0000004-0004-0004-0004-000000000004', 'A', 'Fazem dois anos que estudo.'),
  ('d0000004-0004-0004-0004-000000000004', 'B', 'Houveram muitos candidatos.'),
  ('d0000004-0004-0004-0004-000000000004', 'C', 'Haviam provas difíceis.'),
  ('d0000004-0004-0004-0004-000000000004', 'D', 'Faz dois anos que estudo.'),
  ('d0000004-0004-0004-0004-000000000004', 'E', 'Existe muitas vagas.'),
  ('d0000005-0005-0005-0005-000000000005', 'A', 'Proteger a liberdade de locomoção'),
  ('d0000005-0005-0005-0005-000000000005', 'B', 'Assegurar o conhecimento de informações pessoais'),
  ('d0000005-0005-0005-0005-000000000005', 'C', 'Anular ato lesivo ao patrimônio público'),
  ('d0000005-0005-0005-0005-000000000005', 'D', 'Suprir omissão legislativa'),
  ('d0000005-0005-0005-0005-000000000005', 'E', 'Proteger direito líquido e certo genérico'),
  ('d0000006-0006-0006-0006-000000000006', 'A', 'Saúde, previdência e assistência social'),
  ('d0000006-0006-0006-0006-000000000006', 'B', 'Saúde, educação e previdência'),
  ('d0000006-0006-0006-0006-000000000006', 'C', 'Previdência e trabalho'),
  ('d0000006-0006-0006-0006-000000000006', 'D', 'Assistência, educação e lazer'),
  ('d0000006-0006-0006-0006-000000000006', 'E', 'Saúde e moradia'),
  ('d0000007-0007-0007-0007-000000000007', 'A', 'Nenhum servidor é pontual'),
  ('d0000007-0007-0007-0007-000000000007', 'B', 'Algum servidor não é pontual'),
  ('d0000007-0007-0007-0007-000000000007', 'C', 'Todo servidor não é pontual'),
  ('d0000007-0007-0007-0007-000000000007', 'D', 'Algum servidor é pontual'),
  ('d0000007-0007-0007-0007-000000000007', 'E', 'Nenhum servidor é impontual'),
  ('d0000008-0008-0008-0008-000000000008', 'A', '1/6'),
  ('d0000008-0008-0008-0008-000000000008', 'B', '1/3'),
  ('d0000008-0008-0008-0008-000000000008', 'C', '1/2'),
  ('d0000008-0008-0008-0008-000000000008', 'D', '2/3'),
  ('d0000008-0008-0008-0008-000000000008', 'E', '5/6'),
  ('d0000009-0009-0009-0009-000000000009', 'A', 'Propriedade de veículos'),
  ('d0000009-0009-0009-0009-000000000009', 'B', 'Serviços de qualquer natureza'),
  ('d0000009-0009-0009-0009-000000000009', 'C', 'Renda'),
  ('d0000009-0009-0009-0009-000000000009', 'D', 'Grandes fortunas'),
  ('d0000009-0009-0009-0009-000000000009', 'E', 'Transmissão causa mortis'),
  ('d0000010-0010-0010-0010-000000000010', 'A', 'Obrigações com terceiros'),
  ('d0000010-0010-0010-0010-000000000010', 'B', 'Recursos próprios da entidade'),
  ('d0000010-0010-0010-0010-000000000010', 'C', 'Bens de uso'),
  ('d0000010-0010-0010-0010-000000000010', 'D', 'Receitas do período'),
  ('d0000010-0010-0010-0010-000000000010', 'E', 'Despesas antecipadas')
ON CONFLICT (question_id, key) DO NOTHING;

COMMIT;
