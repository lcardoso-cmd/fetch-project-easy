## Objetivo

Tornar a tela de Proposta Comercial mais profissional: nenhum campo obrigatório, dados do cliente vindos do cadastro do caso (não digitados de novo), adição da contraparte, saída em editor rich-text editável dentro do app e exportação para Word (.docx) já formatado — sem markdown.

## Mudanças

### 1. `src/routes/_authenticated/proposal.tsx` — Formulário

- **Novo seletor "Caso" no topo** (opcional). Ao escolher um caso existente, autopreenche `client_name`, `matter` (a partir de `title`/`summary`) e, quando existir, `client_document` / cidade / endereço. Usa `listCases` já disponível em `cases.functions.ts`.
- **Autofill do escritório/advogado** a partir do `profile` do usuário logado (nome do advogado, OAB → Cargo/Título, telefone). Feito só na 1ª montagem — o usuário pode editar/apagar.
- **Remover a seção "Cliente" do formulário** (nome, CPF, endereço, cidade). Passa a ser apenas leitura, mostrada como resumo do caso escolhido (com opção "editar" para casos avulsos sem cadastro).
- **Nova seção "Contraparte"** com campos opcionais: nome/razão social, CPF/CNPJ, endereço, cidade/estado, advogado da contraparte (nome + OAB).
- **Remover validação obrigatória** do submit — nada é required; se tudo estiver vazio, ainda assim gera (a IA usa o que houver).
- Manter seções Objeto, Honorários e prazo, Escritório/Advogado, Tom.

### 2. `src/lib/generators.functions.ts` — `generateProposal`

- Ampliar `ProposalSchema` com campos da contraparte: `counterparty_name`, `counterparty_document`, `counterparty_address`, `counterparty_city_state`, `counterparty_lawyer`.
- Tornar `client_name` e `matter` **opcionais** (schema); ajustar o prompt para não exigir e omitir seções sem dados.
- Instruir o modelo a produzir **HTML semântico** limpo (h1/h2/h3, p, ul/ol/li, strong, em, com `style="text-align:..."` quando aplicável) em vez de Markdown. Sem ``` cercas, sem `#`, sem `**`. Isso alimenta o editor rich-text e o exportador .docx já existente.

### 3. Resultado — editor + exportação .docx

- Substituir a área `<ReactMarkdown>` por `RichTextEditor` (`src/components/chat/rich-text-editor.tsx`) já usado no chat. O HTML retornado pela IA é carregado nele; o usuário pode **expandir, editar, formatar**.
- Botão "Baixar Word (.docx)" faz `POST /api/tools/petition` (endpoint que já converte HTML → docx com títulos, listas, alinhamento) com `{ titulo, html }` e dispara download.
- Botão "Copiar" agora copia o HTML como rich text (via `ClipboardItem` `text/html`) para colar formatado no Word/Google Docs; fallback para texto puro.
- Remover import/uso de `react-markdown` neste arquivo e a exportação `.md`.

## Detalhes técnicos

- Seletor de caso: `useQuery(["cases","list"], () => listCases({}))`, `<Select>` com placeholder "Sem caso vinculado".
- Autofill de profile: `useProfile()` no primeiro render preenche `lawyer_name`, `lawyer_title` (`OAB ${oab_number}`), `firm_phone` se ainda vazios.
- Prompt: adicionar seção **CONTRAPARTE** ao `user` message via helper `line()`; regra de sistema atualizada para "Formato de saída: HTML puro (h1/h2/h3/p/ul/ol/li/strong/em, opcional style=text-align). Não use Markdown, não use crases, não use `#` nem `**`."
- Exportação: reutiliza `Route` `/api/tools/petition` — já aceita `{ titulo, html }` e devolve `.docx` com heading/bullet/alinhamento.
- Nenhum campo required no Zod nem no submit (tudo `.optional().default("")`).

## Fora de escopo

- Não criar tabela de "clientes" separada — o cadastro do cliente já mora em `cases.client_name` etc.
- Não alterar rotas de casos.
