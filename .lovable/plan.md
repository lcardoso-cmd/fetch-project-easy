## Diagnóstico rápido

- **Layout cortado**: o chat é aberto num `Sheet` (`sm:max-w-4xl lg:max-w-6xl`) sobre `cases/$caseId`. Dentro dele, `JurisMindChat` usa `grid h-full lg:grid-cols-3` mas a lista de documentos tem `ScrollArea h-[40vh]` (altura fixa em viewport), e vários cards não usam `min-h-0 flex-1`. Resultado: em telas ~1145px, a coluna de conversa fica espremida e o conteúdo transborda verticalmente.
- **Contexto do caso não vai no prompt**: `askWithRag` filtra chunks por `case_id` **no cliente** depois de trazer só os 8 top matches globais (perde recall). O prompt do sistema não recebe título/partes/parte representada/tipo/jurisdição, então o modelo às vezes pergunta "qual caso?".
- **Seleção começa vazia**: usuário quer "todos marcados por padrão".
- **Formatos**: hoje só Word (`/api/tools/petition`), Excel (`/api/tools/table`), PPTX (`/api/tools/presentation`). Falta PDF.
- **Visão**: hoje aceita imagem colada no chat; **não** lê imagens/páginas escaneadas dentro dos PDFs indexados.
- **Poucas ações**: só 8 quick actions; tools do modelo limitadas.

## Fase 1 — Layout: modal sem corte + tela cheia dedicada

**Modal (Sheet)**

- `JurisMindChat`: substituir `ScrollArea h-[40vh]` por `flex-1 min-h-0` na lista de documentos; encadear `min-h-0 flex-1` em todos os ancestrais (sidebar, main, conversa).
- Sheet: `sm:max-w-5xl lg:max-w-[min(96vw,1280px)] w-full` + `h-svh` para usar altura da tela em mobile também.
- Adicionar um botão "Abrir em tela cheia" no header do Sheet que navega para a rota dedicada e fecha o modal.

**Tela cheia dedicada**

- Nova rota `src/routes/_authenticated/cases.$caseId.chat.tsx` que renderiza o mesmo `JurisMindChat` ocupando `h-[calc(100svh-navbar)]`, com sidebar de documentos à esquerda e a conversa à direita, sem `Sheet`.
- Link/breadcrumb "← Voltar ao caso" no topo. `Ctrl+K` foca o input.

## Fase 2 — RAG por caso, muito mais forte

**Escopo estrito**

- Todo pedido ao chat só existe no contexto do caso atual — a UI passa `case_id` obrigatoriamente e o server rejeita mensagem sem ele. Remover a tool `list_cases`. Nunca perguntar "qual caso/cliente" no prompt.
- Prepend fixo de "SOBRE O CASO" no system prompt: título, cliente, parte representada, número, tipo, jurisdição, `matter_kind`, resumo, contraparte e advogados, prazos ativos.
- `selectedDocIds` inicializa com **todos** os `readyDocs` quando o chat abre; usuário desmarca à vontade.

**Retrieval de altíssimo nível**

- Nova RPC Postgres `match_chunks_scoped(query_embedding, case_id, doc_ids[], match_count)` que filtra por `user_id + case_id + doc_ids` já no banco (índice HNSW existente) e devolve mais chunks (24–40).
- **Busca híbrida** (semântica + full-text): adicionar `tsvector` gerado em `document_chunks.content` (índice GIN em português) e RPC `hybrid_search_chunks` que combina scores por RRF. Ganho enorme para nomes, números CNJ, datas, valores.
- **Query rewrite**: pré-processo chama Gemini 3 flash preview para expandir a pergunta em 2–3 reformulações + extração de entidades; embed cada uma e agrega candidatos (multi-query RAG).
- **Re-rank leve**: após buscar 40 candidatos, pedir ao modelo rápido para ordenar top 12 pela pergunta.
- Aumentar contexto: subir p/ `google/gemini-2.5-pro` quando pedido complexo (drafting), manter `google/gemini-3-flash-preview` como padrão.

**Chunking + visão nos PDFs indexados**

- No `indexDocument`, quando `text.length / pageCount` for baixo (PDF escaneado) OU quando o PDF tiver imagens grandes:
  - Renderiza páginas como imagem (`unpdf` → `pdfjs` canvas) em ~130 DPI.
  - Envia lote de páginas para `google/gemini-3-flash-preview` com prompt "extraia todo o texto legível, transcreva tabelas em Markdown e descreva figuras, assinaturas, carimbos".
  - Concatena a saída como chunks adicionais marcados `source_kind: "vision"` na coluna nova `document_chunks.source_kind`.
- Botão "Reprocessar com visão" no card de cada documento força esse pipeline sob demanda.

**Anexos no chat (imagem + arquivo)**

- Aceitar drag-and-drop e paste (Ctrl+V) de imagens direto na área da conversa (já há botão de anexar; falta drop/paste).
- Aceitar anexo de **PDF/imagem** que **não é indexado** — é enviado inline na mensagem (image_url para PNG/JPG, `type:"file"` base64 para PDF pequeno) para análise pontual sem virar documento do caso.

## Fase 3 — Ações do agente (tools) e formatos

**Novas tools no `askWithRag**`

- `create_pdf({ titulo, html })` — devolve `kind:"pdf"` e um `PDFCard` no chat com botão "Baixar PDF".
- `create_task({ title, due_at, priority })` — cria em `tasks` já ligado ao caso.
- `list_case_tasks()`, `list_case_events()` — só do caso atual.
- `search_documents({ query, limit })` — busca híbrida explícita sobre os docs selecionados; devolve trechos.
- `read_document_page({ document_id, page })` — envia a imagem daquela página ao modelo para pergunta pontual.
- `extract_parties()`, `extract_dates()`, `extract_values()` — utilitários que devolvem JSON estruturado para popular cards.
- Manter e reforçar `create_petition`, `create_table`, `create_presentation`, `create_event`.

**Novo endpoint `/api/tools/pdf**`

- Server route TanStack. Recebe `{ titulo, html }` e devolve `.pdf`. Usa `pdfmake` (pure-JS, roda em Cloudflare workerd) com stylesheet jurídica (Times, margens 3/2/2/2 cm, cabeçalho com título, numeração, primeira linha "PROCESSO / VARA / COMARCA" quando disponível).
- `PDFCard` no chat (mesmo padrão de `PetitionCard`) com botões "Editar → Baixar Word", "Baixar PDF".

**Quick actions ampliadas**
Além das 8 atuais, adicionar: Extrair partes e qualificação, Extrair jurisprudência citada, Calcular liquidação, Contrarrazões, Alegações finais, Rascunho de acordo, Notificação extrajudicial, Parecer técnico, Análise de risco.

**Seletor de modelo**

- Dropdown compacto "Rápido / Balanceado / Máximo" no header do chat → mapeia para `gemini-3-flash-preview` / `gemini-2.5-flash` / `gemini-2.5-pro`. Persiste no localStorage por usuário.

## Fase 4 — UX e polimento

- Streaming da resposta (SSE via server route `/api/chat/rag/stream`) com indicador "pensando…" e visualização de tool calls em execução.
- Render Markdown com `react-markdown` (parar de usar `stripMarkdown` no chat; manter apenas em resumo salvo).
- Citações clicáveis: `[1]` no texto abre popover com trecho e link para o documento.
- Contador de tokens/consumo visível para o power-user (opcional).
- Foco automático no textarea ao abrir modal e ao terminar cada resposta.

## Escopo técnico (arquivos afetados)

- `src/components/chat/jurismind-chat.tsx` — layout, defaults, drag/drop/paste, seletor de modelo, `PDFCard`, quick actions.
- `src/routes/_authenticated/cases.$caseId.tsx` — Sheet mais largo + botão "tela cheia".
- `src/routes/_authenticated/cases.$caseId.chat.tsx` (novo) — rota dedicada.
- `src/routes/api/tools/pdf.ts` (novo) — endpoint PDF com `pdfmake`.
- `src/components/chat/artifact-cards.tsx` — `PDFCard`.
- `src/lib/chat.functions.ts` — prompt com metadados do caso, novas tools, remoção de `list_cases`.
- `src/lib/rag.functions.ts` — pipeline de visão em PDFs escaneados, `source_kind`.
- `src/lib/ai.server.ts` — helper `visionExtractPages`, `rewriteQuery`, `rerankChunks`.
- Migração Supabase: coluna `source_kind` em `document_chunks`, `tsvector` gerado + índice GIN, RPCs `match_chunks_scoped` e `hybrid_search_chunks`.
- `bun add pdfmake` (server-side PDF).

## FASE 5 (quero essa tb)

- Voz/áudio no chat.
- Persistência de histórico multi-thread (mantém histórico em memória do lado cliente por sessão; se quiser threads persistentes por caso, é próxima rodada).
- Refatoração completa para AI SDK `useChat` — só migro para SSE onde há ganho claro (Fase 4); a base continua no `createServerFn` atual.

## Ordem de execução

1. Fase 1 (layout) — resolve o corte imediato.
2. Fase 2 (RAG + case metadata + defaults) — resolve "ele pergunta o caso".
3. Fase 3 (tools + PDF + quick actions).
4. Fase 4 (streaming, markdown, citações clicáveis).
5. fase 5

Cada fase é entregável isoladamente; posso parar após a Fase 5 se quiser priorizar outra coisa.