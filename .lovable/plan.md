## Objetivo

Melhorar o fluxo de documentos em **Novo caso** e **Caso existente** com:
1. Barra de progresso visual (upload + indexação) com status por arquivo.
2. Remover a listagem/upload direto de "Meus Documentos" dentro do novo caso — substituir por um botão **"Importar de Meus Documentos"** que puxa arquivos já existentes.
3. Impedir duplicatas (mesmo arquivo/nome no mesmo caso).

---

## 1. Barra de progresso e status por arquivo

Hoje o upload mostra só um `Loader2` + toasts, sem visibilidade real de "subindo → registrando → indexando → pronto".

Criar um componente único `UploadProgressList` usado em `UploadDialog` (caso existente) e no card "Importar documento" de `assistencias.nova.tsx`, exibindo, por arquivo:

- Nome + tamanho
- Barra de % (0–100) — usando `XMLHttpRequest.upload.onprogress` para o upload real ao Storage (Supabase JS não expõe progresso via `fetch`; trocar por URL assinada + XHR `PUT`)
- Etapa atual: `Enviando…` → `Registrando…` → `Extraindo texto…` → `Indexando (n trechos)…` → `Pronto ✓` / `Falhou ✗ [Tentar novamente]`
- Ícone de status (spinner/check/alerta) + cor semântica

Estados armazenados em `useState<UploadItem[]>`; cada arquivo com `{ id, file, pct, phase, error }`.

## 2. Substituir listagem direta por "Importar de Meus Documentos"

**Em `assistencias.nova.tsx`** (novo caso):
- Manter o dropzone atual para **subir um documento novo** (usado para extração automática de campos).
- Adicionar botão secundário **"Importar de Meus Documentos"** que abre um dialog listando `listAllDocuments()` (documentos do usuário em outros casos, ou órfãos), com busca por nome e filtro por caso de origem.
- Ao selecionar um documento existente, ele é anexado ao novo caso via nova server fn `attachExistingDocument({ document_id, case_id })` — reaproveita o `storage_path` (sem re-upload), cria nova linha em `documents` referenciando o mesmo arquivo, e reusa/re-indexa os chunks.

**Em `assistencias.$caseId.tsx`** (caso existente):
- Manter o `DocumentList` do caso (essa lista é dos documentos DESTE caso — permanece).
- No `UploadDialog`, adicionar aba/botão **"Importar de Meus Documentos"** com o mesmo picker.

## 3. Prevenção de duplicatas

Regras aplicadas server-side em `registerDocument` e `attachExistingDocument`:

- Duplicata = mesmo `case_id` + mesmo `filename` **ou** mesmo `case_id` + mesmo `file_size` + mesmo hash SHA-256 dos primeiros 64 KB (calculado no cliente antes do upload, enviado como coluna nova `content_hash`).
- Adicionar coluna `content_hash text` em `public.documents` + índice único parcial `(case_id, content_hash) WHERE content_hash IS NOT NULL`.
- Se duplicata detectada: retornar erro tipado `{ code: 'DUPLICATE', existing_id }`. Cliente mostra o diálogo atual "Substituir?" (já existe) — mantém.

## Detalhes técnicos

- **Migration**: `ALTER TABLE public.documents ADD COLUMN content_hash text;` + índice único parcial.
- **Server functions novas** (em `src/lib/documents.functions.ts`):
  - `attachExistingDocument({ source_document_id, case_id })` — copia metadados, aponta para o mesmo `storage_path`, verifica duplicata.
  - `listImportableDocuments({ exclude_case_id })` — lista `Meus Documentos` já processados, agrupados por caso, para o picker.
- **Cliente**:
  - Novo `src/components/documents/upload-progress-list.tsx` (visual).
  - Novo `src/components/documents/import-from-library-dialog.tsx` (picker).
  - Refatorar `UploadDialog` e o card de importação em `assistencias.nova.tsx` para consumirem o novo componente de progresso.
  - Substituir `supabase.storage.upload()` por upload via URL assinada + XHR para poder reportar `%` real.

## Fora do escopo

- Alterar o layout do `DocumentList` do caso (continua igual).
- Mudar o pipeline de indexação/RAG.
- Reprocessar documentos antigos para calcular `content_hash` retroativo (apenas novos uploads).
