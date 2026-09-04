# Destacar materiais gerados na homepage como cartões empilhados

## Resposta direta antes do plano

Sim. Hoje a seção "Materiais gerados" da homepage usa abas (Análise / Peça / Planilha / Apresentação), então o visitante só vê um material por vez e precisa ter curiosidade para clicar nas outras abas. Vamos trocar isso por uma pilha vertical de quatro cartões, um abaixo do outro, todos visíveis sem interação.

## O que muda

### 1. Layout da seção #materiais

- Remove o seletor de abas (`role="tablist"`) do `OutputShowcase`.
- Exibe os quatro materiais em sequência vertical: **Análise → Peça jurídica → Planilha → Apresentação**.
- Cada item vira um cartão próprio com:
  - título/ícone identificando o tipo de entrega;
  - prévia visual do material (texto com fontes, minuta A4, tabela, slides);
  - ações de download/edição em destaque;
  - breve legenda explicando o que aquele material faz.

### 2. Comportamento e conteúdo

- Mantém os dados fictícios determinísticos já usados hoje.
- Preserva a prévia fiel de cada formato (citações [F1]/[F2], planilha com total, peça com estrutura A4, apresentação 16:9 com miniaturas).
- Remove o painel lateral de "Comando do advogado / Documentos consultados / Passos" do `OutputShowcase` — ele fazia sentido com abas, mas com tudo visível torna a seção longa demais. Se necessário, essa explicação fica no texto introdutório da seção.

### 3. Identidade visual

- Reaproveita os tokens do projeto: navy `#000038`, ciano `#00FFFF`, branco, superfícies com bordas arredondadas e sombras leves.
- Tipografia mínima de 15px, conforme regra de legibilidade do JurisMind.
- Ciano continua como realce, nunca como texto sobre branco.

## Detalhes técnicos

- Arquivo alterado: `src/components/marketing/output-showcase.tsx`.
- Remove estado `active` e o `role="tablist"`; renderiza `AnalysisOutput`, `PetitionOutput`, `SheetOutput`, `PresentationOutput` diretamente em uma coluna.
- Cada `OutputFrame` ganha um cabeçalho mais descritivo, como um rótulo de entrega.
- `src/routes/index.tsx` continua importando e usando `<OutputShowcase />` na seção `#materiais`; nenhuma mudança de rota.
- Sem alteração em endpoints, schema, RLS, IA ou permissões.
- Verificação: typecheck, testes existentes e conferência visual desktop/mobile.

## Fora de escopo

- Não altera a geração real de materiais dentro do caso.
- Não muda os modelos de IA.
- Não altera cobrança, auth ou dados.
