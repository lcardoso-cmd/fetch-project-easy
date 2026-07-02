## Objetivo
Permitir visualizar mais que as últimas 5 solicitações de Parecer Técnico em `/parecer-tecnico` com carregamento incremental, sem travar a página.

## Escopo
Apenas a listagem "Minhas solicitações recentes" em `src/routes/_authenticated/parecer-tecnico.tsx`. O painel geral `/contratar-b2b` já lista até 200 com filtros e não será alterado.

## Mudanças

### 1. Backend (`src/lib/b2b-services.functions.ts`)
Estender `listMyB2bRequests` para aceitar input opcional e retornar dados paginados:
- Input Zod: `{ service?: string, limit?: number (default 10, max 50), offset?: number (default 0) }`.
- Consulta usa `.eq("service", …)` quando informado, `.range(offset, offset+limit-1)` e `select("*", { count: "exact" })`.
- Retorna `{ items: B2bServiceRequest[], total: number }`.
- Manter compatibilidade: `contratar-b2b.index.tsx` passa a chamar sem filtro (recebe `items`); ajustar esse consumidor para ler `res.items` — nenhuma outra lógica muda.

### 2. Frontend `parecer-tecnico.tsx`
- Query passa a usar `{ service: "parecer-tecnico", limit: 5, offset: 0 }` como estado inicial.
- Adicionar `useState<number>` para `pageSize` (5 → cresce em +5 via botão).
- Refetch quando `pageSize` muda; `queryKey` inclui pageSize.
- Renderizar `items` diretamente (remover `.slice(0,5)` e filtro client-side, já feito no servidor).
- Abaixo da lista:
  - Botão **"Carregar mais"** quando `items.length < total`, mostra "(exibindo X de Y)".
  - Enquanto refetching, botão fica desabilitado com spinner e texto "Carregando…".
  - Quando `items.length === total > 5`, botão vira **"Mostrar menos"** que volta pageSize para 5 e faz scroll ao topo da seção.
- Manter o estado vazio (Inbox card) e o Skeleton atuais.

### 3. Acessibilidade
- Anunciar mudanças via `role="status"` no contador "Exibindo X de Y".
- Foco vai para o primeiro item novo após "Carregar mais" (via `ref` no início do bloco recém-adicionado) para leitores de tela.

## Detalhes técnicos
- Usar `keepPreviousData: true` no `useQuery` para evitar flicker durante o refetch incremental.
- Sem mudanças de banco/RLS; apenas paginação via `range` do PostgREST.
- Ordem `created_at desc` mantida.

## Fora do escopo
- Infinite scroll automático (mantemos botão explícito para não travar em listas grandes).
- Paginação server-side no painel `/contratar-b2b` (já filtra e limita a 200).
