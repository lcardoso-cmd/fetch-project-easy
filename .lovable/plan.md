# Conversas permanentes no JurisMind do caso

Objetivo: o chat do caso passa a funcionar como o ChatGPT dentro de um projeto — todas as conversas daquele caso ficam salvas e listadas, com botão de nova conversa, e os arquivos produzidos em cada conversa ficam guardados e podem ser reaproveitados em um novo pedido.

## O que está errado hoje (verificado no código)

1. **A conversa some.** O texto só é gravado quando a tela envia o identificador de uma conversa já existente. No painel lateral do caso, quando ainda não existe nenhuma conversa, esse identificador vai vazio e nada é salvo — ao fechar a tela, tudo desaparece.
2. **"Abrir em tela inteira" volta para o caso.** A tela cheia é uma página filha da página do caso, e a página do caso não abre espaço para páginas filhas. O clique navega, mas continua aparecendo o painel do caso.
3. **Não há lista de conversas no painel lateral.** A lista só existe na tela cheia (que hoje não abre). O painel tem "Nova conversa", mas nenhuma forma de voltar a uma conversa anterior.
4. **Os materiais gerados** (petição, tabela, PDF, apresentação) só existem enquanto a conversa está aberta na tela e não podem ser usados como base de um novo pedido.

## O que será feito

**1. Conversa sempre salva**
- Ao abrir o chat do caso, se não houver conversa ativa, o sistema continua a última conversa; se não existir nenhuma, cria uma automaticamente antes do primeiro envio.
- O envio nunca acontece sem conversa associada, então todo o histórico (perguntas, respostas, fontes, áudios, materiais) fica guardado.
- O título da conversa continua sendo gerado a partir da primeira pergunta.

**2. Tela cheia funcionando**
- A página do caso passa a abrir espaço para a página filha, e a tela cheia do chat volta a aparecer.
- A conversa aberta no painel continua a mesma na tela cheia, e vice-versa (o endereço leva a conversa ativa).

**3. Histórico de conversas visível nos dois lugares**
- Painel lateral do caso: lista das conversas do caso (título + quando foi a última mensagem), com "Nova conversa", renomear e excluir. Em telas pequenas a lista abre num painel deslizante.
- Tela cheia: mesma lista, já existente, com o mesmo comportamento e a mesma aparência.
- A conversa ativa fica registrada no endereço da página, então recarregar ou voltar mantém a mesma conversa.

**4. Arquivos produzidos em cada conversa**
- O bloco "Materiais" passa a ser por conversa e é reconstruído do histórico salvo, então continua lá depois de fechar e reabrir.
- Cada material ganha a ação **"Usar neste pedido"**: ao clicar, ele entra como anexo do próximo pedido (por exemplo, "faça uma petição usando esta tabela"), e o assistente recebe o conteúdo daquele material junto com a pergunta.
- Continuam disponíveis as ações atuais de editar e baixar (.docx/.pdf/.xlsx/.pptx).

## Detalhes técnicos

- `src/routes/_authenticated/assistencias.$caseId.tsx`: renderizar `<Outlet />` (e não renderizar o conteúdo do caso quando uma rota filha está ativa), corrigindo `/assistencias/$caseId/chat`.
- Nova função de servidor `ensureThread({ case_id })` em `src/lib/threads.functions.ts` (reaproveita `requireOrgPermission("ai.use")`): devolve a conversa mais recente ou cria uma. Chamada em `case-jurismind-panel.tsx` e na rota de tela cheia antes do primeiro envio; `jurismind-chat.tsx` bloqueia envio sem `threadId` resolvido.
- Alternativa complementar em `src/routes/api/chat/stream.ts` e `src/lib/chat.functions.ts`: quando `thread_id` vier vazio, criar a thread no servidor e devolvê-la no evento final (`onThreadCreated` já existe no cliente) — garante persistência mesmo em chamadas antigas.
- Extrair a sidebar de conversas de `assistencias.$caseId.chat.tsx` para `src/components/chat/thread-list.tsx`, usada pela rota de tela cheia e pelo painel lateral (via `Sheet` no mobile). Inclui `renameThread`/`deleteThread` já existentes.
- Thread ativa passa a ficar no search param (`?thread=`) nas duas superfícies; `MaterialsSection` continua derivando de `tool_steps` das mensagens carregadas por `getThreadMessages`, o que já persiste.
- "Usar neste pedido": novo estado de anexos de contexto em `jurismind-chat.tsx`, enviado ao backend como bloco de contexto do usuário (texto/HTML/linhas da tabela, com limite de tamanho), exibido como chip removível acima do campo de texto.
- Sem migração de banco: `ai_chat_threads` e `ai_chat_messages` já existem com RLS por organização/caso.
