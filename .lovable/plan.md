
## Contexto

A tela de Proposta já tem autosave e histórico locais (localStorage). Vamos evoluir para persistência no backend por caso/usuário, diff textual real e versões nomeadas/fixadas — sincronizadas entre dispositivos.

## O que muda

1. **Rascunho por caso, no backend** — 1 rascunho ativo por (usuário, caso). Autosave debounced continua no cliente, mas grava no banco. Fallback pra localStorage quando offline; ao reconectar, sincroniza.
2. **Histórico de versões no backend** — cada "Gerar proposta" e cada "Salvar versão" cria uma linha imutável vinculada ao caso, com snapshot completo do formulário + HTML gerado.
3. **Rótulos e versões fixadas** — usuário pode renomear, adicionar descrição e fixar (pin) versões importantes; fixadas nunca são descartadas pelo limite.
4. **Diff aprimorado** — comparação lado a lado passa a mostrar diff textual real (adições em verde, remoções em vermelho, palavra a palavra) no HTML gerado, e um resumo campo a campo das diferenças no formulário.

## Estrutura de dados

Duas tabelas novas no schema `public`:

```text
proposal_drafts
  id, user_id, case_id (nullable — rascunho "sem caso"), form (jsonb),
  output (text), updated_at
  unique (user_id, case_id)

proposal_versions
  id, user_id, case_id (nullable), label, description, origin
  ('manual' | 'auto-generate' | 'auto-restore'), pinned (bool),
  form (jsonb), output (text), created_at
```

RLS: cada usuário vê/edita apenas as próprias linhas (`auth.uid() = user_id`). GRANTs padrão para `authenticated` + `service_role`. Índice em `(user_id, case_id, created_at desc)` para listagem rápida.

Limite: manter até 50 versões não-fixadas por (user_id, case_id); ao exceder, a mais antiga não-fixada é removida via trigger `AFTER INSERT`.

## Server functions (`src/lib/proposal-drafts.functions.ts`)

Todas com `requireSupabaseAuth`:

- `getProposalDraft({ caseId? })` → `{ form, output, updatedAt } | null`
- `upsertProposalDraft({ caseId?, form, output })` → grava rascunho ativo
- `listProposalVersions({ caseId? })` → lista ordenada desc, com `pinned` primeiro
- `createProposalVersion({ caseId?, label, description?, origin, form, output, pinned? })`
- `updateProposalVersion({ id, label?, description?, pinned? })`
- `deleteProposalVersion({ id })`

## UI

`src/routes/_authenticated/proposal.tsx`:

- Substituir helpers de `localStorage` por chamadas às server fns via TanStack Query (`useQuery` para carregar rascunho e histórico, `useMutation` para salvar/atualizar/excluir/upsert).
- Autosave debounced (800ms) chama `upsertProposalDraft`; badge no cabeçalho mostra "Salvando…", "Salvo há Xs" e um estado "offline — salvo localmente" (fallback pra localStorage caso a mutation falhe; reenvia ao voltar).
- Novo botão **"Salvar versão"** abre um pequeno popover para digitar rótulo e descrição opcional antes de gravar.
- Ao **gerar proposta**, criar versão automática com rótulo padrão editável.

`src/components/proposal/proposal-versions-dialog.tsx` (evolução):

- Lista de versões vinda do backend, com seção "Fixadas" no topo.
- Cada item: ícone de pin (toggle), botão de editar rótulo/descrição inline, excluir, restaurar.
- Aba **Comparar com atual** passa a mostrar:
  - **Diff do texto gerado**: HTML normalizado (converte para texto preservando blocos), diff palavra a palavra com `diff` (biblioteca `diff` do npm), renderizado com `<ins>` verde e `<del>` vermelho.
  - **Diff do formulário**: tabela com colunas "Campo | Versão | Atual" mostrando apenas os campos que mudaram.

## Migração e dependências

- 1 migration criando as duas tabelas, GRANTs, RLS, policies (`auth.uid() = user_id` para SELECT/INSERT/UPDATE/DELETE), trigger de `updated_at` e trigger de limite de 50 não-fixadas.
- `bun add diff` e `@types/diff` para o diff textual.

## Migração dos dados locais existentes

No mount, se existir `jurismind:proposal-draft:v1` ou `jurismind:proposal-versions:v1` no `localStorage` e o backend estiver vazio para o caso atual (ou "sem caso"), importar automaticamente uma única vez, marcar como migrado (`jurismind:proposal-migrated:v1`) e limpar as chaves antigas. Toast confirmando "Rascunho e X versão(ões) migrados para a nuvem".

## Fora de escopo

- Compartilhamento entre membros do time (fica só do dono do caso por ora).
- Diff visual dentro do RichTextEditor (apenas no diálogo de histórico).
- Exportar histórico como .zip.
