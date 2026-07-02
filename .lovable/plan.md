## Objetivo

Criar dentro do JurisMind uma área onde qualquer escritório pode **contratar a B2B Consulting** para serviços técnicos (parecer técnico, assistência técnica pericial, auditoria de cálculo, administração contratual, forense, etc.) diretamente do sistema — sem sair para e-mail/WhatsApp.

O fluxo escolhido combina **catálogo + solicitação + acompanhamento no sistema + notificação por e-mail** (não é marketplace com pagamento online — pricing continua sob proposta, como no seu modelo atual).

---

## Experiência do usuário (escritório)

Novo item de sidebar em **Meu Espaço**: **"Contratar B2B"** (ícone Briefcase, visível a todos os perfis).

### 1. Catálogo (`/contratar-b2b`)
Landing interna com:
- Hero curto: "Reforço técnico especializado — direto no seu caso."
- Grid de **categorias de serviço** (cards com ícone + descrição curta + "Solicitar"):
  1. **Assistência Técnica em Processos** — perícia econômico-contábil-financeira e de engenharia, quesitos, laudos e contra-laudos.
  2. **Auditoria e Revisão de Cálculos Judiciais** — refazimento de execuções, liquidações, atualização monetária.
  3. **Parecer Técnico** — pareceres econômicos, contábeis, financeiros ou de engenharia.
  4. **Administração Contratual & Claims** — pleitos, disruption, litigation support, dispute boards.
  5. **Finanças Corporativas & Forense** — valuation, apuração de haveres, contabilidade forense, due diligence.
  6. **Estratégia & Investigações** — investigações corporativas, compliance, FCPA, governança.
- Rodapé com credenciais B2B (USD 5B em disputas, 60+ arbitragens, CAM-CCBC/ICC) — reforço institucional.

### 2. Formulário de solicitação (`/contratar-b2b/solicitar?service=...`)
Sheet/página com campos:
- Serviço (pré-selecionado da categoria clicada, editável)
- Vincular caso existente (opcional — dropdown de casos do usuário)
- Título curto da demanda
- Descrição detalhada (rich text)
- Urgência (Normal / Alta / Crítica)
- Prazo desejado (data)
- Anexos (reaproveita bucket `documents` — múltiplos arquivos)
- Contato preferencial (e-mail preenchido do perfil, telefone editável)

Envia → cria registro em `b2b_service_requests` com `status = 'novo'` e dispara e-mail para B2B.

### 3. "Minhas solicitações" (aba na mesma tela)
Lista das solicitações do próprio usuário com badge de status (Novo / Em análise / Proposta enviada / Aceita / Recusada / Cancelada), última atualização e link para detalhes. Na tela de detalhes: timeline de status, notas visíveis ao cliente da B2B, anexos da proposta enviada, botão "Aceitar proposta" / "Recusar".

---

## Experiência B2B (Plataforma JurisMind — super_admin)

Nova aba em `/plataforma` → **"Solicitações B2B"** (`/plataforma/solicitacoes`):
- Lista global de todas as solicitações (filtros por status, serviço, urgência, escritório).
- Detalhe da solicitação: dados do escritório/usuário solicitante, descrição, anexos, timeline.
- Ações: mudar status, adicionar **nota interna** (invisível ao cliente), adicionar **nota pública** (visível ao cliente), anexar proposta comercial (arquivo), marcar "Proposta enviada" (dispara e-mail ao solicitante).
- Métrica no KPI dashboard: solicitações abertas, taxa de conversão.

---

## Notificações por e-mail

Usar infraestrutura de app emails do Lovable (`scaffold_transactional_email`):
- **Nova solicitação** → `lcardoso@b2bconsulting.com.br` (destino configurável em `app_settings`), com resumo + link para o painel.
- **Confirmação** para o solicitante ("Recebemos sua solicitação").
- **Mudança de status para 'Proposta enviada' / 'Aceita' / 'Recusada'** → notifica solicitante.

Pré-requisitos: domínio de e-mail configurado + `setup_email_infra`. Se ainda não houver, mostro o diálogo de setup antes de scaffoldar templates.

---

## Modelagem (Supabase)

Migração criando:

**`b2b_service_catalog`** (seed com as 6 categorias acima; permite ligar/desligar itens no futuro)
- `slug` (pk), `title`, `description`, `icon`, `sort_order`, `active`

**`b2b_service_requests`**
- `id`, `requester_user_id` (fk auth.users), `case_id` (nullable fk cases), `service_slug` (fk catalog), `title`, `description`, `urgency` (enum), `desired_deadline`, `contact_email`, `contact_phone`, `status` (enum: novo | em_analise | proposta_enviada | aceita | recusada | cancelada), `created_at`, `updated_at`

**`b2b_service_request_attachments`**
- `id`, `request_id`, `uploaded_by_user_id`, `visibility` (`client` | `internal`), `file_name`, `storage_path`, `mime_type`, `size_bytes`, `created_at`

**`b2b_service_request_events`** (timeline + notas)
- `id`, `request_id`, `author_user_id`, `kind` (`status_change` | `note_public` | `note_internal` | `attachment`), `payload` (jsonb), `created_at`

**`app_settings`** (chave/valor genérico, single-row-per-key) — para armazenar o e-mail destino do time B2B sem hardcode.

### RLS + GRANTs
- `b2b_service_catalog`: leitura pública (`TO authenticated` SELECT); escrita só `is_platform_staff()`.
- `b2b_service_requests`: solicitante lê/edita as suas; `is_platform_staff()` lê/edita todas.
- Anexos e eventos: mesma regra do request pai; `note_internal` só visível a staff via policy que filtra por `visibility`/`kind`.
- Todas com bloco padrão `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role`.

---

## Servidor (TanStack `createServerFn`)

`src/lib/b2b-services.functions.ts`:
- `listCatalog()` — público autenticado.
- `listMyRequests()` — usa `requireSupabaseAuth`.
- `createRequest({ ... })` — insere request, faz upload de anexos, cria evento inicial, dispara e-mails.
- `getRequest({ id })` — retorna request + eventos filtrados por visibilidade.
- `updateRequestStatus({ id, status, note? })` — staff-only (check `is_platform_staff`).
- `addRequestNote({ id, kind, body })` — staff-only para `note_internal`, ambos para `note_public`.
- `listAllRequests({ filters })` — staff-only.

E-mails enviados via helper `src/lib/email/send.ts` chamando `/lovable/email/transactional/send` com `idempotencyKey` baseado em `request_id + evento`.

---

## Capacidades e sidebar

Nova capacidade **`b2b_marketplace`** (default: on para todos os perfis — como o próprio card indica que "todos veem"). Adicionada ao `NAV_ENTRIES` como `contract-b2b` na seção **Meu Espaço**.

Painel B2B fica sob capacidade existente `platform_admin` (já usada pela seção Plataforma).

---

## Rotas (arquivos novos)

- `src/routes/_authenticated/contratar-b2b.index.tsx` — catálogo + tabs "Solicitar" / "Minhas solicitações".
- `src/routes/_authenticated/contratar-b2b.solicitar.tsx` — formulário (aceita `?service=slug`).
- `src/routes/_authenticated/contratar-b2b.$requestId.tsx` — detalhe/timeline da solicitação (cliente).
- `src/routes/_authenticated/plataforma.solicitacoes.tsx` — painel global (staff).
- `src/routes/_authenticated/plataforma.solicitacoes.$requestId.tsx` — detalhe staff.

Cada rota com `head()`, `errorComponent`, `notFoundComponent`.

---

## Fora de escopo (para próximas iterações)

- Pagamento online / checkout. Continua sob proposta manual.
- Chat em tempo real dentro da solicitação (a timeline com notas já cobre o essencial).
- Assinatura digital da proposta (pode entrar depois usando o gerador de proposta já existente).

---

## Ordem de implementação

1. Migração das 5 tabelas + enums + policies + grants + seed do catálogo.
2. `b2b-services.functions.ts` + rotas do cliente (catálogo, solicitar, minhas solicitações, detalhe).
3. Item na sidebar + capacidade nova.
4. Painel B2B em `/plataforma/solicitacoes` (lista + detalhe + ações staff).
5. Setup de e-mail (domínio se necessário → `setup_email_infra` → `scaffold_transactional_email`) + templates: nova solicitação (B2B), confirmação (cliente), status atualizado (cliente).
6. Tabela `app_settings` seed com `b2b_inbox_email = 'lcardoso@b2bconsulting.com.br'`.
