## Objetivo

Na página `/parecer-tecnico`, mostrar um estado vazio informativo quando o usuário ainda não tiver nenhuma solicitação B2B do serviço `parecer-tecnico`, com sugestão de ação clara.

## Onde

`src/routes/_authenticated/parecer-tecnico.tsx` — seção "Minhas solicitações de Parecer Técnico" (hoje só renderiza quando `parecerRequests.length > 0`).

## Mudanças

1. Remover o gate `parecerRequests.length > 0 && …` e sempre renderizar o Card "Minhas solicitações de Parecer Técnico" (após a query terminar).

2. Enquanto a query estiver carregando, exibir um skeleton discreto (2-3 linhas) para evitar flash do empty state.

3. Quando `parecerRequests.length === 0` e a query já resolveu:
   - Renderizar bloco central com ícone `Inbox` (lucide) esmaecido.
   - Título: "Nenhuma solicitação encontrada".
   - Texto: "Você ainda não abriu solicitações de Parecer Técnico com a B2B Consulting. Crie uma agora para receber orçamento e acompanhar o andamento por aqui."
   - CTA primário `Button` → mesmo `Link` do card "Não tem perito no escritório?" (`/contratar-b2b/solicitar` com `service`, `title` e `description` pré-preenchidos — extrair o objeto de search para uma constante `PARECER_PREFILL` no topo do arquivo para reutilizar nos dois pontos e evitar drift).
   - CTA secundário `Button variant="ghost"` → `/contratar-b2b` ("Ver catálogo B2B").
   - `role="status"` no wrapper para leitores de tela.

4. Quando houver solicitações, comportamento atual mantido (accordion + botão "Ver catálogo B2B").

## Fora de escopo

- Alterações no painel `/contratar-b2b`.
- Filtro por serviço no painel geral.
- Backend / server functions.
