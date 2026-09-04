# Chat estilo Bitrix24: barra de círculos à direita + conversa em slide-in

## O que muda para você

Hoje o chat interno abre num painel pelo ícone do cabeçalho e existe um componente flutuante que nunca foi ligado às telas. Vamos trocar por uma barra fixa na lateral direita, presente em todas as telas internas:

- Coluna estreita, encostada na direita, com círculos (foto/iniciais) das pessoas da sua organização e das conversas recentes.
- Ponto verde de presença e balãozinho com o número de mensagens não lidas em cada círculo.
- Ao clicar num círculo, a conversa entra deslizando da direita, ocupando um painel de largura fixa, sem cobrir a barra de círculos.
- Vários chats podem ficar abertos lado a lado; cada um pode ser minimizado (volta a ser só o círculo) ou fechado.
- Um círculo no topo abre a busca de pessoas, e outro abre o canal geral / a conversa da equipe do caso quando você está dentro de um caso.
- No celular e no tablet a barra vira uma faixa horizontal recolhível e a conversa abre em tela cheia deslizando, com áreas de toque de 44px.

Observação: hoje o cadastro de perfil não guarda foto, então os círculos mostram iniciais sobre navy com o ciano apenas no estado ativo/não lido. Se você quiser fotos de verdade, isso entra como passo separado (upload de avatar).

## Escopo

- Aproveitar integralmente `ConversationView`, `ConversationCenter` e as funções de conversa já existentes.
- Não alterar banco de mensagens, permissões, RAG, CRM, cobrança, homepage nem sidebar esquerda.
- Remover o acesso duplicado: o painel lateral atual do cabeçalho passa a ser apenas um atalho para "todas as conversas" dentro da nova barra.

## Detalhes técnicos

Arquivos:
- Novo `src/components/chat/team-chat-rail.tsx`: barra fixa à direita (56px desktop), lista de círculos, presença, badge de não lidas, tooltips, navegação por teclado.
- Novo `src/components/chat/team-chat-dock.tsx`: gerencia janelas abertas/minimizadas em estado único, animação slide-in (`animate-in slide-in-from-right`), 360x520 no desktop, tela cheia no mobile.
- Reescrever `src/components/chat/floating-team-chat.tsx` como wrapper opcional de caso (passa `caseId` para destacar a conversa da equipe) ou removê-lo se ficar redundante.
- `src/components/layout/dashboard-shell.tsx`: montar o dock/rail uma única vez no shell autenticado, reservar padding à direita no conteúdo, manter `ConversationsDrawer` apenas como "ver todas".
- `src/lib/conversations.functions.ts`: nova `listChatContacts` (middleware `requireOrg`, sem exigir `members.view`) retornando membros ativos da organização com nome, iniciais, id de DM existente e contagem de não lidas; reaproveita a lógica de `listMyConversations`.

Comportamento:
- Estado das janelas abertas/minimizadas em memória; apenas a preferência de barra expandida/recolhida em `localStorage`.
- Não lidas atualizadas por realtime já existente + `refetchInterval` de 60s como reserva.
- Cores: navy #000038, superfícies em branco translúcido, ciano só em ativo/foco/badge; WCAG AA nos dois temas.

## Validação

- Typecheck e a suíte de testes existente.
- Playwright autenticado em 1920x1080, 1366x768 e 390x844: círculos visíveis, slide-in ao clicar, minimizar/fechar, sem overflow horizontal, sem sobrepor a sidebar esquerda.
