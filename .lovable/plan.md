## Objetivo

Trazer para este projeto (TanStack Start + Supabase) a experiência completa que existe no repositório original `lcardoso-cmd/jurismind` (Next.js + Firebase) para as duas telas-chave: **Detalhe do Caso** e **Chat JurisMind AI**. O original não pode ser copiado linha-a-linha (stack diferente, Firebase vs Supabase), então vou **portar a UX e as funcionalidades** reaproveitando o backend já existente (server functions, RAG, conversations, tasks, events).

## O que já existe aqui (reaproveitar)
- `getCase / updateCase`, `listDocuments / registerDocument / deleteDocument`, `indexDocument` (RAG), `askWithRag` (chat com citations + tool steps), `summarizeCase`, `listEvents`, `listTasks / toggleTask`, `getOrCreateCaseConversation`, `QuesitosCard`, `UploadZone` simples, `ChatPanel` básico.
- Bucket `documents`, tabela `document_chunks` + `match_chunks`, conversations/messages.

## O que falta (vou criar/portar)

### 1. Tela de Detalhe do Caso (`src/routes/_authenticated/cases.$caseId.tsx`) — reorganizar
Layout igual ao original:
- Header: voltar, título do caso, cliente, e **botão grande "JurisMind AI"** (BrainCircuit) abrindo Sheet/Dialog maximizável com o chat completo.
- Card **Resumo do Caso (IA)** com:
  - Botão "Gerar/Atualizar Resumo", data da última atualização.
  - Menu "Exportar" → **Word (.docx)** e **Apresentação (.pptx)**.
- Card **Detalhes do Caso** (edição inline com o form atual, incluindo título).
- Card **Equipe do caso** (a partir de `team_members` quando aplicável; placeholder se vazio).
- `QuesitosCard` (já existe).
- **Lista de Documentos** rica (componente novo, ver abaixo).
- Botão **"Gerenciar Tarefas do Caso"** abrindo dialog com Kanban/lista simples baseada em `tasks.functions`.
- **Agenda/Eventos** do caso (lista compacta) — já temos `listEvents`.

### 2. Novo `DocumentList` (`src/components/documents/document-list.tsx`)
Porta de `case-view`/`document-list.tsx` original:
- Tabela com nome, tamanho, data de upload, **status do embedding** (Na fila / Baixando / Analisando / Gerando busca / Pronto / Erro) com ícones e cores.
- Botão **Carregar** abrindo Dialog com drag-and-drop, multi-arquivo, lista de selecionados removíveis, limite 15 MB, tipos aceitos (PDF, DOCX, XLS/XLSX, CSV, PNG, JPG).
- Detecção de **arquivo duplicado** → AlertDialog "Substituir?".
- Botão **Reprocessar / Tentar novamente** em documentos com erro → chama `indexDocument` novamente.
- Checkbox por linha alimentando o **doc-selection store** (Zustand) para escopar o chat.
- Botão excluir com confirmação.
- Reaproveita `UploadZone` atual como base, mas substitui pelo novo componente (o `UploadZone` pode virar interno do dialog).

### 3. Doc-selection store (`src/lib/document-selection-store.ts`)
Zustand: `{ selectedDocIds: Set<string>, toggle, selectAll, deselect, setDocuments }`. Igual ao do original. `askWithRag` ganha parâmetro opcional `selected_doc_ids: string[]` → quando enviado, `match_chunks` é filtrado por esses ids (ajusto a server fn e, se preciso, crio variante `match_chunks_by_docs`).

### 4. Chat completo (`src/components/chat/jurismind-chat.tsx`)
Substitui o `ChatPanel` quando aberto a partir do caso. Porta de `case-chat-view.tsx`:
- Layout 1/3 + 2/3 dentro do Sheet (maximizável).
- **Sidebar**:
  - Card "Detalhes do Caso" (cliente, status, nº processo, tipo).
  - Card "Equipe".
  - Card "Documentos do Caso" com **busca** por nome, **filtro por intervalo de data** (Popover + Calendar range), botões "Marcar todos / Desmarcar todos", checkboxes ligados ao store.
  - Botão "Gerenciar Tarefas" (mesmo dialog do caso).
- **Coluna principal**: chat (askWithRag) com mensagens, citações (file + snippet + score), tool steps recolhíveis, indicador de "Pensando…", input com Enter para enviar, botão Stop quando ocupado.
- Mensagens sem Markdown (já temos `stripMarkdown`).

### 5. Export DOCX/PPTX (`src/lib/export.functions.ts`)
Server functions novas:
- `exportSummaryDocx({ case_id, title, content })` → usa `docx` (npm) para gerar e retornar `{ base64, fileName }`.
- `exportSummaryPptx({ case_id, title, content })` → usa `pptxgenjs` para gerar slides simples (capa + tópicos quebrando o resumo por parágrafo).
- Cliente baixa via `saveAs` (Blob a partir de base64). Adicionar deps: `docx`, `pptxgenjs`, `file-saver`.

### 6. Tarefas do caso (dialog reutilizável)
`src/components/tasks/case-tasks-dialog.tsx`: lista as `tasks` do caso, permite marcar concluído (`toggleTask`), adicionar nova (form simples chamando uma nova `createTask` se ainda não existir; verifico antes de implementar).

### 7. Ajustes pontuais
- `askWithRag` aceita `selected_doc_ids` e repassa ao filtro de chunks.
- `indexDocument` exposto também via botão "Reprocessar" (já existe; só conectar UI).
- Mantém `getOrCreateCaseConversation` para persistir histórico do chat (cada caso = 1 conversa).
- Sem alterações destrutivas em schema; uso `team_member_ids` já presente em `cases` se necessário para o painel de equipe.

## Arquivos (resumo)

Criar:
- `src/components/documents/document-list.tsx`
- `src/components/documents/upload-dialog.tsx`
- `src/components/chat/jurismind-chat.tsx`
- `src/components/chat/document-picker.tsx`
- `src/components/cases/case-summary-card.tsx`
- `src/components/cases/case-team-panel.tsx`
- `src/components/tasks/case-tasks-dialog.tsx`
- `src/lib/document-selection-store.ts`
- `src/lib/export.functions.ts`

Editar:
- `src/routes/_authenticated/cases.$caseId.tsx` (reorganiza layout)
- `src/lib/chat.functions.ts` (`askWithRag` aceita `selected_doc_ids`)
- `package.json` (`docx`, `pptxgenjs`, `file-saver`, `zustand` se ainda não tiver, `react-day-picker` se faltar)

## Fora de escopo
- Não vou trazer Genkit/Firebase, gamma.app, marketing chat, admin de tenants, geração de petição, OCR — não foram pedidos.
- Não vou alterar policies/migrations além do necessário (nenhuma alteração prevista).

## Validação
Após implementar: `bun x tsgo --noEmit`, abrir o caso atual no preview, testar upload + indexação + chat com filtro de docs + exportar DOCX.