
## Objetivo

Permitir gerar propostas para clientes que **ainda não têm caso cadastrado**:
1. Subir documentos direto na tela de Proposta (sem exigir caso vinculado).
2. Extrair dados dos documentos para pré-preencher o formulário.
3. Depois, com um clique, **converter a proposta em caso**, migrando os anexos e criando o caso vinculado.

## Fluxo de uso

```text
Proposta (sem caso)
   ├─ Arrastar/soltar PDFs/imagens/DOCX
   ├─ Extração automática → sugere cliente, matéria, contraparte
   ├─ Editar formulário + gerar proposta (funciona igual hoje)
   └─ Botão "Converter em caso"
         ├─ Cria case novo com dados da proposta
         ├─ Move/anexa documentos ao case (attachDocumentToCase)
         ├─ Vincula a proposta ao case criado (form.case_id + draft)
         └─ Toast com link "Abrir caso"
```

## Mudanças

### 1. Backend — anexos de proposta sem caso

Nova tabela `proposal_attachments` (RLS por `user_id`, escopo por `case_id` nullable ou draft “sem caso”):

- `id uuid pk`, `user_id uuid`, `case_id uuid null`, `filename`, `file_type`, `file_size`, `storage_path`, `extracted_text text null`, `extraction_status ('pending'|'done'|'error')`, `extracted_fields jsonb null`, `created_at`.
- Storage: bucket `documents` já existente, prefixo `proposals/{user_id}/{uuid}-{filename}`.
- Grants + policies (user vê/edita só o próprio).

Novas server functions em `src/lib/proposal-attachments.functions.ts`:

- `listProposalAttachments({ case_id | null })` — lista anexos do rascunho corrente.
- `registerProposalAttachment({ ... })` — insere linha após upload no storage.
- `extractProposalAttachment({ id })` — baixa do storage, roda `extractTextFromBlob` + LLM (mesmo extrator do `extractCaseDataFromDocument`) e devolve `{ text, extracted }` (cliente, matéria, contraparte, jurisdição).
- `deleteProposalAttachment({ id })` — remove do storage + linha.
- `convertProposalToCase({ case: {...}, attachment_ids: [...] })`:
  1. Cria o `case` (reusa `createCase` server-side).
  2. Para cada anexo, chama `attachDocumentToCase` reaproveitando `storage_path`.
  3. Atualiza `proposal_drafts` do usuário para apontar ao novo `case_id`.
  4. Retorna `{ case_id }`.

### 2. Frontend — Proposta

Em `src/routes/_authenticated/proposal.tsx`:

- Novo card **"Documentos do cliente"** (só aparece quando `case_id === __none__`; se já há caso vinculado, mostra os documentos do caso em modo leitura).
- Componente `ProposalAttachmentsPanel`:
  - Upload zone (reusa `supabase.storage.from('documents').upload` como em `cases.new.tsx`).
  - Lista com nome, tamanho, status de extração, ações (visualizar, remover, "usar sugestões").
  - Botão **"Extrair dados"** por arquivo (ou automático ao subir) → popula `form` com merge respeitando o que o usuário já digitou.
- Botão **"Converter em caso"** na barra superior (ao lado de "Salvar versão"):
  - Habilita quando o form tem `client_name` e `matter` mínimos.
  - Abre popover: título do caso (default = `Proposta — {cliente}`), tipo, jurisdição.
  - Ao confirmar chama `convertProposalToCase`, seta `form.case_id` no retorno, invalida queries de casos, mostra toast com `<Link to="/cases/$caseId">Abrir caso</Link>`.

### 3. Validação e limites

- Tipos permitidos: PDF, DOCX, TXT, imagens (jpg/png). Máx 20 MB/arquivo, 10 arquivos por proposta.
- Extração best-effort: nunca sobrescreve campo já preenchido pelo usuário; apenas sugere.

## Detalhes técnicos

- Extração reusa `extractTextFromBlob` (usado por `attachDocumentToCase`) + prompt do `extractCaseDataFromDocument` adaptado para retornar `{ client_name, client_document, counterparty_name, matter, jurisdiction, scope_summary }`.
- `convertProposalToCase` roda dentro de uma única server fn (não transacional no PostgREST, mas cria case primeiro e só depois anexa; se algum anexo falhar, retorna a lista de falhas para o UI mostrar).
- Migration nova para `proposal_attachments` (tabela + índices em `(user_id, case_id)`, `(user_id, created_at)` + trigger `update_updated_at_column`).
- Anexos de rascunho “sem caso” não são apagados automaticamente ao converter — passam a apontar ao `case_id` do caso novo via update.

## Arquivos afetados

- **Migration**: nova tabela `proposal_attachments` + policies + grants.
- **Novos**: `src/lib/proposal-attachments.functions.ts`, `src/components/proposal/proposal-attachments-panel.tsx`, `src/components/proposal/convert-to-case-popover.tsx`.
- **Editados**: `src/routes/_authenticated/proposal.tsx` (integra painel + botão converter), `src/lib/cases.functions.ts` (expor helper reutilizável de extração se necessário).

## Fora de escopo (para depois)

- Indexar anexos de proposta no RAG antes da conversão em caso.
- Suportar múltiplos rascunhos “sem caso” simultâneos por usuário (hoje é 1 draft por `(user, case_id null)`).
