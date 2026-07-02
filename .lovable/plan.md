## Objetivo

Facilitar a localização de solicitações no painel `/contratar-b2b` adicionando filtro por status e busca por título.

## Onde

`src/routes/_authenticated/contratar-b2b.index.tsx` — seção "Minhas solicitações".

## Mudanças

1. **Persistir filtros na URL** via `validateSearch` (Zod + `fallback`) da rota:
   - `q?: string` (busca)
   - `status?: B2bRequestStatus | "todos"` (default `todos`)
   Assim o estado sobrevive à navegação para o detalhe e volta.

2. **UI de filtros** logo abaixo do título "Minhas solicitações":
   - `Input` com ícone de busca (placeholder "Buscar por título…") — debounce leve (150 ms) para não redigitar a URL a cada tecla.
   - `Select` com opções: Todos, Novo, Em análise, Proposta enviada, Aceita, Recusada, Cancelada, Concluído (usando `B2B_REQUEST_STATUS_LABEL`).
   - Botão "Limpar" aparece quando há filtro ativo.
   - Layout responsivo: linha única em desktop, empilhado em mobile.

3. **Filtragem client-side** (a lista já vem completa de `listMyB2bRequests`, então nada de servidor):
   - Match por `status` exato quando ≠ "todos".
   - Match por título via `includes` case/acento-insensível (`String.prototype.normalize("NFD").replace(/\p{Diacritic}/gu,"")`).

4. **Feedback**:
   - Contador "X de Y solicitações" acima da lista.
   - Empty state distinto quando há solicitações mas nenhuma bate com o filtro ("Nenhuma solicitação corresponde aos filtros" + botão limpar), diferente do empty state atual (nenhuma criada).

## Detalhes técnicos

- `validateSearch` com `zodValidator(z.object({ q: fallback(z.string(),"").default(""), status: fallback(z.enum([...,"todos"]),"todos").default("todos") }))`.
- Atualização dos filtros via `useNavigate({ from: Route.fullPath })` com `search: (prev) => ({ ...prev, q: novo })` para preservar params.
- Nada muda em backend/server functions nem no schema.

## Fora de escopo

- Filtro por serviço/data (pode virar iteração futura).
- Filtros no painel administrativo `plataforma.solicitacoes.index.tsx`.
