## Diagnóstico

O código atual em `src/routes/_authenticated/agenda.tsx` já usa `Route.useSearch()` com `createFileRoute("/_authenticated/agenda")` (correto). Porém, o erro em runtime menciona `/_authenticated/calendar` — path que só existe como shim redirect em `src/routes/_authenticated/calendar.tsx`.

Isso indica cache obsoleto do plugin TanStack Router / Vite (chunk `agenda.tsx?tsr-split=component` gerado antes da correção anterior), não um bug lógico no código atual.

## Ações

1. **Limpar caches obsoletos**: remover `node_modules/.vite` e qualquer `.tanstack` residual para forçar regeneração do `routeTree.gen.ts` e dos chunks tsr-split.
2. **Reiniciar o dev server** para servir os novos chunks.
3. **Verificar /agenda** com Playwright headless em `http://localhost:8080/agenda` (autenticado via sessão Supabase injetada), capturar screenshot e confirmar ausência do erro `Could not find an active match from "/_authenticated/calendar"`.
4. **Validação extra**: navegar em `/integracoes` (que tem shim análogo em `integrations.tsx`) para confirmar que o mesmo padrão de shim redirect não quebra.
5. Se após limpar cache o erro persistir, investigar se `Route.useSearch()` em `agenda.tsx` está sendo tree-shaken e substituir por `useSearch({ from: "/_authenticated/agenda" })` explícito.

## Fora do escopo

- Não altero lógica de negócio de agenda, Google/Outlook sync, nem removo os shims `calendar.tsx`/`integrations.tsx` (mantêm URLs antigas funcionando).