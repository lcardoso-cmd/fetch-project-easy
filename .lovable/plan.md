# Chat interno de equipe

Adiciona um sistema completo de comunicação entre membros da equipe, separado do assistente de IA atual (que continua em `/assistant`).

## O que será entregue

**Dois tipos de conversa:**
- **Conversa por caso** — cada processo/perícia/AT tem sua thread fixa, visível dentro da página do caso e também na lista geral.
- **DM (mensagem direta)** — conversa 1-a-1 entre dois membros da equipe, fora do contexto de um caso.

**Recursos em cada mensagem:**
- Texto formatado simples (quebras de linha, links auto-detectados).
- **Anexar documentos** — upload direto pro bucket `documents`; se a conversa for de um caso, o arquivo também fica vinculado ao caso.
- **Menções `@membro`** — autocomplete; gera notificação no sino do app pra pessoa mencionada.
- **Virar tarefa** — botão em cada mensagem que abre um modal já preenchido (descrição = texto da mensagem, atribuído a, prazo) e cria a task ligada à mensagem original e ao caso (se houver).
- **Tempo real** — mensagens, edições e reações aparecem na hora via Realtime do backend.

## Onde fica na UI

- Novo item no menu lateral: **Equipe → Conversas** (`/inbox`)
  - Lista lateral com duas abas: "Casos" (threads dos casos onde participo) e "Diretas" (DMs)
  - Botão "Nova mensagem" abre seletor de membro pra iniciar DM
  - Painel à direita: thread ativa
- Página do caso (`/cases/$caseId`): nova aba **"Conversa"** ao lado de Documentos/Quesitos, com a mesma thread embutida
- Sino de notificações no header com badge de não-lidas + menções

## Modelo de dados

Tabelas novas (com RLS escopada por participante):

- `conversations` — id, kind (`case` | `dm`), case_id?, created_by, created_at
- `conversation_participants` — conversation_id, user_id, last_read_at — controla acesso e contador de não-lidas
- `messages` — id, conversation_id, author_id, body, attachments (jsonb com refs do storage), reply_to_id?, created_at, edited_at
- `message_mentions` — message_id, mentioned_user_id, read_at — alimenta o sino
- `message_tasks` — message_id, task_id — liga mensagem ↔ task criada

Tasks usa a tabela `tasks` que já existe; só adicionamos `source_message_id` opcional.

Realtime habilitado em `messages`, `message_mentions`, `conversation_participants`.

## Server functions

- `listConversations` — lista por aba (case/dm), ordenadas por última mensagem
- `getOrCreateCaseConversation(case_id)` — idempotente; auto-adiciona team_members do caso
- `getOrCreateDM(other_user_id)`
- `listMessages(conversation_id, before?)` — paginado
- `sendMessage(conversation_id, body, attachments?, mentions?, reply_to?)`
- `markRead(conversation_id)`
- `createTaskFromMessage(message_id, payload)`
- `listMyMentions()` — pro sino

Todas com `requireSupabaseAuth` + checagem de participação.

## Detalhes técnicos

- Autocomplete de menção lê de `team_members` (já existe) + `profiles` da equipe.
- Anexos seguem o mesmo padrão do caso: upload pro bucket `documents` em `${user_id}/conversations/${conversation_id}/...`, signed URLs no display, preview reaproveita o modal de PDF que acabamos de fazer.
- Componente `<ConversationView />` reutilizado entre `/inbox` e a aba do caso.

## Fora de escopo (deixar pra depois se você quiser)

- Reações com emoji
- Edição/exclusão de mensagem (1ª versão só envia)
- E-mail pra menções (só notificação in-app)
- Chamada de voz/vídeo

Confirma e eu começo pela migração + servidor, depois UI.