# Logo e escritório no cabeçalho de todo `.docx` exportado

Hoje o template `src/lib/docx/template.ts` monta um header genérico só com "B2B | JurisMind AI" à esquerda e o título à direita. Vou (1) enriquecer o cadastro do usuário com a identidade do escritório/PF, (2) criar bucket público para logos, (3) permitir editar isso numa tela de configurações, e (4) puxar esses dados em cada export `.docx` (proposta, petição, resumo do caso) para desenhar o cabeçalho.

Time/convites por e-mail ou link já existem (`team_members`, `team_invitations` com token, `src/routes/invite.$token.tsx`, `src/routes/_authenticated/settings.tsx`) — só o "topo" dessa hierarquia (o dono da conta, PF ou PJ) ganha campos novos.

## Backend

Migração `alter table public.profiles`:
- `entity_type text not null default 'pessoa_fisica'` — check `('pessoa_fisica','pessoa_juridica')`.
- `firm_name text` (razão social ou nome fantasia; para PF, opcional — cai para `full_name`).
- `tax_id text` (CPF quando PF, CNPJ quando PJ; formatação livre).
- `firm_address text`, `firm_website text` (opcionais, também usados no rodapé).
- `logo_path text` (chave dentro do bucket).

Bucket de storage `firm-logos` (público, criado via `supabase--storage_create_bucket`) + policies em `storage.objects`:
- SELECT liberado (bucket público).
- INSERT/UPDATE/DELETE apenas em objetos cujo primeiro segmento do path seja `auth.uid()::text` (padrão `{user_id}/logo.png`).
- Limite prático 2 MB, tipos aceitos `image/png|jpeg|webp|svg+xml` (validado no cliente antes do upload).

## Server functions (novo arquivo `src/lib/firm-profile.functions.ts`)

- `getFirmProfile()` — devolve `{ entity_type, firm_name, tax_id, firm_address, firm_website, logo_url }` (assina URL pública do bucket).
- `updateFirmProfile(data)` — Zod: nomes trim, `tax_id` opcional, valida enum.
- `setFirmLogo({ path })` / `removeFirmLogo()` — grava/limpa `logo_path` e apaga objeto antigo do bucket via `supabaseAdmin` (import dinâmico no handler).

Todas com `.middleware([requireSupabaseAuth])`.

## UI — nova tela `Identidade do escritório`

Rota: `src/routes/_authenticated/settings.firm.tsx`, com link no menu de settings existente. Componentes shadcn (Card, Tabs "Pessoa física / Pessoa jurídica", Input, Button).

- Toggle PF/PJ (define label do documento e placeholder do `tax_id`).
- Campos: nome do escritório / nome, CPF ou CNPJ, endereço, site.
- Upload de logo: `<input type="file">` → sobe direto pelo `supabase` client browser para `firm-logos/{user_id}/logo.{ext}` (substitui) → chama `setFirmLogo`. Preview 96px, botão remover.
- Toast de sucesso, autosave manual (botão "Salvar"), sem migração de dados.

## Header do DOCX (mudança central)

Em `src/lib/docx/template.ts`:
- `createStyledDocument` passa a aceitar `branding?: { firmName?, logoBytes?, logoContentType? }`.
- Se `logoBytes`, insere `ImageRun` (48px altura, largura proporcional; type derivado do content-type) à esquerda no `Header`, seguido do `firmName` em negrito 11pt e do subtítulo (`documentType`) 9pt cinza. Sem logo, cai no header atual.
- Rodapé ganha `firmName · site · CPF/CNPJ` (o que existir) à esquerda; "Página X de Y" à direita permanece.
- Novo helper `loadBrandingForUser(userId)` em `src/lib/docx/branding.server.ts`:
  - Lê `profiles` (server publishable) + baixa o objeto do bucket com `supabaseAdmin` (`.download()`) → Buffer.
  - Cache em memória por request para evitar redownload em exports múltiplos.
- Cada export chama `loadBrandingForUser` no server function antes de montar o documento:
  - `src/routes/api/tools/petition.ts` (proposta + petição).
  - `src/lib/export.functions.ts` (`exportSummaryDocx`).
- Como esses handlers já são autenticados, `userId` vem do middleware — nenhum input novo do cliente.

Fallback: sem `firm_name` cai no branding padrão ("B2B | JurisMind AI") já em uso — nada quebra para usuários que ainda não configuraram.

## Prévia Word

`src/components/proposal/word-preview.tsx` passa a receber `branding` via prop opcional (buscado com `useQuery(getFirmProfile)`), renderizando o logo (via `<img src={logo_url}>`) e o nome do escritório no `.word-header`, para bater com o `.docx`.

## Fora de escopo

- Convite/time (já existe; sem mudanças).
- Múltiplas marcas por conta.
- Assinatura digital / marca d'água.
- Preencher automaticamente `firm_address` nos textos gerados pela IA (só no header/footer por enquanto).
