## Objetivo

Transformar o JurisMind em um SaaS de 3 camadas com estrutura clara:

```text
B2B (dono do SaaS)  ──►  Clientes (escritórios/profissionais)  ──►  Usuários do escritório
      super_admin              office_admin do tenant                  operadores
      platform_admin
```

Além disso: conceder super_admin a `lcardoso@b2bconsulting.com.br`, remover a legenda de "menus ocultos" do sidebar, e adicionar um seletor "Ver como…" que deixa você pré-visualizar o sistema com os acessos de qualquer perfil.

---

## 1. Modelo de dados (migração)

Nova capacidade e tabelas — nada é deletado, apenas somado.

**`app_capability` recebe `super_admin`.** Fica acima de `platform_admin` e habilita tudo (nova função `is_super_admin(uid)` + reuso de `has_capability`).

**`customer_accounts`** — 1 linha por cliente da B2B (tenant). O "dono" é o profile que fez signup do escritório.

- `id`, `owner_user_id` (FK `profiles.id`, único), `name`, `status` (`trial|active|suspended|canceled`), `plan` (`free|pro|enterprise`), `billing_email`, `mrr_cents`, `notes`, `created_at`, `updated_at`.
- RLS: SELECT/UPDATE só para `super_admin`/`platform_admin`; o próprio dono lê a sua linha.
- Trigger `AFTER INSERT ON auth.users` cria automaticamente um `customer_accounts` (status `trial`) para todo novo signup — assim todo escritório vira automaticamente um "cliente B2B".

**`platform_audit_log`** (opcional nesta fase, deixo pronto) — registra quando um super_admin altera plano/status/capacidade de outro usuário.

**Backfill + grant do super admin**

- `INSERT` em `customer_accounts` para todos os profiles existentes.
- `INSERT` em `user_capabilities` das capacidades `super_admin` + `platform_admin` para o `user_id` correspondente a `lcardoso@b2bconsulting.com.br` (lookup em `auth.users` dentro da migração via SECURITY DEFINER — é a única forma segura).

---

## 2. Backend (server functions em `src/lib/platform.functions.ts`)

Todas protegidas por `requireSupabaseAuth` + checagem de `super_admin` ou `platform_admin`:

- `getPlatformKpis()` → clientes totais, novos (30d), usuários ativos (30d por `ai_chat_messages` + `messages`), MRR somado, breakdown por plano/status.
- `listCustomerAccounts({ search, status, plan, limit, offset })` → join com profile do dono e contagem de usuários.
- `getCustomerAccount(id)` → detalhes + lista de usuários do tenant (via `team_members` daquele `owner_user_id`) + capacidades de cada um.
- `updateCustomerAccount(id, { plan, status, mrr_cents, billing_email, notes })`.
- `listPlatformUsers({ search, capability, limit, offset })` → todos os usuários do sistema, com tenant + capacidades.
- `grantCapability(user_id, capability)` / `revokeCapability(user_id, capability)` — só super_admin pode conceder `super_admin`/`platform_admin`.

---

## 3. Frontend — área Plataforma (super_admin/platform_admin)

Novas rotas dentro de `src/routes/_authenticated/`:

- `platform.index.tsx` — dashboard com KPIs reais (clientes, novos, usuários ativos, MRR, gráfico simples de signups por semana).
- `platform.customers.tsx` — tabela de clientes (escritórios) com busca, filtro de status/plano, coluna "usuários", ações Ativar/Suspender.
- `platform.customers.$id.tsx` — detalhe do cliente: dados do escritório, plano/status editáveis, usuários do tenant, faturamento (placeholder pronto para conectar Stripe/Chargebee depois).
- `platform.users.tsx` — todos os usuários; filtrar por capacidade; conceder/revogar capacidades (super_admin/platform_admin só editável por super_admin).
- `platform.team.tsx` — "Time B2B" — atalho para listar/adicionar quem é super_admin ou platform_admin (rosto humano da lista de usuários acima, para a operação B2B).
- `platform.credentials.tsx` — recebe a tela hoje em `/settings/oauth` (credenciais Google/Outlook são do SaaS, não do tenant). O arquivo `settings.oauth.tsx` vira um redirect para `platform.credentials` e some do menu do escritório.

O sidebar ganha uma seção **Plataforma JurisMind** já existente, expandida com esses 5 itens (só aparecem para quem tem `platform_admin` ou `super_admin`).

---

## 4. Seletor "Ver como…" (view switcher para super_admin)

Novo item no sidebar (topo da seção Plataforma), disponível **só para super_admin**: um dropdown "Ver como…" com presets:

- Super admin (padrão, tudo liberado)
- Platform admin
- Office admin (dono de escritório)
- Advogado operador (só `cases`)
- Perito (só `expert_opinion`)
- Comercial (só `commercial`)
- Marketing (só `marketing`)
- Sem permissões (usuário recém convidado)

Implementação: `useCapabilities()` passa a ler primeiro um override de `sessionStorage` (`viewAsCapabilities`). O override é puramente visual — só filtra o sidebar e telas condicionais no cliente; **não afeta RLS nem chamadas ao servidor** (que continuam autorizadas pelas capacidades reais do super_admin). Um badge fixo aparece no topo ("Visualizando como: Advogado — sair da simulação") para deixar claro que é um preview.

---

## 5. Ajustes no sidebar (`dashboard-shell.tsx`)

- **Remover** o popover "N menus ocultos" e a lista de itens escondidos.
- **Remover** os tooltips que expõem "Requer a permissão «X»" para o usuário final — mantemos apenas a descrição funcional do item. Os labels e permissões continuam centralizados em `src/lib/nav-registry.ts` e `capabilities.functions.ts`, só param de ser mostrados no UI para usuários comuns.
- Super_admin continua vendo as descrições de permissão nos tooltips (útil para o dono do SaaS entender o que cada perfil vê) — mostrado apenas quando `is_super_admin` for verdadeiro.
- Move `Configurações › Credenciais OAuth` para dentro de Plataforma.

---

## 6. Ordem de execução

1. Migração (schema + backfill + grant do super_admin).
2. `platform.functions.ts` + hook `useIsSuperAdmin`.
3. `nav-registry` recebe as novas entradas; `dashboard-shell` limpa popover/tooltips e adiciona o seletor "Ver como…".
4. Rotas `/platform/*` novas + redirect de `/settings/oauth`.
5. Ajuste do hook `useCapabilities` para respeitar o override de simulação.

---

## Detalhes técnicos

- **Tenant model**: por ora, tenant = `profiles` do usuário que criou a conta. Todos os `team_members` daquele `user_id` são "usuários do tenant". Não precisamos criar coluna `tenant_id` em cada tabela agora — o join por `owner_user_id` já funciona porque as RLS existentes já escopam por `user_id` do dono.
- **Grant do super_admin na migração**: usar CTE `WITH u AS (SELECT id FROM auth.users WHERE email = 'lcardoso@b2bconsulting.com.br')` e `INSERT ... SELECT id, 'super_admin' FROM u ON CONFLICT DO NOTHING`. Mesmo bloco para `platform_admin`.
- **Auto-provisionamento de customer_account**: trigger `AFTER INSERT ON auth.users` chamando `SECURITY DEFINER` que insere em `customer_accounts` com `owner_user_id = NEW.id`, `status='trial'`, `plan='free'`. Backfill idempotente para os profiles atuais.
- **View switcher**: `useCapabilities` retorna `{ real, effective, simulating, setSimulation, clearSimulation }`. Componentes usam `effective` para UI; server functions ignoram e re-checam com `has_capability` real.
- **Sem impersonation real**: não trocamos a sessão Supabase — evita risco de RLS e auditoria. Preview é só filtro de UI.
- **Faturamento**: `mrr_cents` fica manual agora; deixo a coluna e a UI prontas para plugar Stripe/Chargebee depois via connector.
