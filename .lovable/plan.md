
## Objetivo

Reorganizar o sidebar de forma profissional, refletindo os três níveis de visão do produto e mostrando cada ferramenta apenas para quem realmente a usa.

## Modelo de acesso (três visões)

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. PLATAFORMA B2B (JurisMind)                               │
│    Você vendendo. Vê todos os escritórios/clientes,         │
│    assinaturas, métricas. Role: platform_admin              │
├─────────────────────────────────────────────────────────────┤
│ 2. ESCRITÓRIO / EMPRESA / PROFISSIONAL AUTÔNOMO             │
│    Cliente que comprou. Admin do escritório: equipe,        │
│    faturamento, assinatura, integrações.                    │
│    Role: office_admin (ou owner solo)                       │
├─────────────────────────────────────────────────────────────┤
│ 3. USUÁRIO OPERACIONAL                                      │
│    Advogado, perito, comercial, marketing. Só vê as         │
│    ferramentas do seu perfil. Role: member + capabilities   │
└─────────────────────────────────────────────────────────────┘
```

Um profissional autônomo é `office_admin` **e** `member` com todas as capabilities — vê tudo, exceto a visão de Plataforma B2B.

## Perfis profissionais e capabilities

Cada membro do escritório recebe um conjunto de capabilities que controla a visibilidade das ferramentas. Um mesmo usuário pode ter mais de uma:

| Capability            | Habilita                          |
| --------------------- | --------------------------------- |
| `cases`               | Painel, Assistências, Tarefas, Conversas, Agenda, Meus Documentos, Peças Jurídicas (todos têm por padrão) |
| `expert_opinion`      | Parecer Técnico (peritos)         |
| `commercial`          | Proposta Comercial                |
| `marketing`           | Marketing, Publicações            |
| `office_admin`        | Equipe, Faturamento, Integrações, Configurações do escritório |
| `platform_admin`      | Painel B2B (clientes, assinaturas, métricas) |

## Nova estrutura do sidebar

```text
PRINCIPAL                          (todos)
  Painel
  Assistências / Casos
  Minhas Tarefas
  Conversas
  Agenda
  Meus Documentos
  Peças Jurídicas
  Parecer Técnico                  (só expert_opinion) ← sobe para Principal

PRODUÇÃO                           (aparece só se tiver alguma)
  Proposta Comercial               (só commercial)
  Publicações                      (só marketing)
  Marketing                        (só marketing)

ESCRITÓRIO                         (só office_admin)
  Equipe & Permissões
  Faturamento & Assinatura
  Integrações
  Configurações

PLATAFORMA B2B                     (só platform_admin — visão JurisMind)
  Clientes
  Assinaturas
  Métricas
```

Seções inteiras somem quando o usuário não tem nenhum item — sem headers vazios.

## O que muda no backend

1. **Novo enum `app_capability`** com os valores da tabela acima.
2. **Nova tabela `user_capabilities`** (`user_id`, `capability`), com RLS + GRANTs padrão; leitura via função `security definer` `has_capability(_user_id, _capability)`, análoga ao `has_role` já existente.
3. **`app_role` ganha `platform_admin`** (mantém `admin`/`user` para compat). `admin` do escritório vira `office_admin` semanticamente via capability — o enum não precisa quebrar.
4. **Server function `getMyCapabilities()`** (`requireSupabaseAuth`) retorna as capabilities do usuário logado + flags derivadas (`isPlatformAdmin`, `isOfficeAdmin`). Cache no `QueryClient` por sessão.
5. **Tela de Equipe** ganha edição das capabilities por membro (checkboxes), visível só para `office_admin`.
6. **Migration seed**: usuários com `app_role = 'admin'` recebem `office_admin` + todas as capabilities operacionais, para não perderem acesso.

## O que muda no frontend

1. **`dashboard-shell.tsx`**: converter `navItems` em função pura `buildNav(capabilities)` que retorna as seções filtradas. Remover seções sem itens. Renderizar labels de seção só quando houver conteúdo.
2. **Hook `useCapabilities()`** que consome `getMyCapabilities()` via `useSuspenseQuery`. `DashboardShell` já é `_authenticated`, então é seguro chamar no loader.
3. **Guardas de rota** em `/proposal`, `/marketing`, `/monitoring`, `/drafter` (quando parecer técnico), `/integrations`, `/settings`: se faltar capability, redirect para `/dashboard` com toast "Sem permissão".
4. **Novas rotas de Plataforma B2B** (esqueleto, só para `platform_admin`): `/platform/customers`, `/platform/subscriptions`, `/platform/metrics`. Conteúdo real fica para depois — nesta entrega, páginas placeholder com layout consistente.
5. **Rota `/office/team`**: já existe tela de equipe; adicionar coluna/editor de capabilities.

## Detalhes técnicos

- **Enum novo (SQL)**:
  ```sql
  create type public.app_capability as enum
    ('cases','expert_opinion','commercial','marketing','office_admin','platform_admin');
  ```
- **Tabela**:
  ```sql
  create table public.user_capabilities (
    user_id uuid references auth.users(id) on delete cascade not null,
    capability public.app_capability not null,
    granted_at timestamptz not null default now(),
    primary key (user_id, capability)
  );
  grant select on public.user_capabilities to authenticated;
  grant all on public.user_capabilities to service_role;
  alter table public.user_capabilities enable row level security;
  create policy "self read" on public.user_capabilities
    for select to authenticated using (user_id = auth.uid());
  create policy "office admin manage" on public.user_capabilities
    for all to authenticated
    using (public.has_capability(auth.uid(),'office_admin'))
    with check (public.has_capability(auth.uid(),'office_admin'));
  ```
- **`has_capability`**: security definer idêntico ao `has_role`.
- **`buildNav`** recebe `{ capabilities: Set<Capability>, labels, isLawyer }` e devolve `NavItem[]` já filtrado. Testável isoladamente.
- Zero mudança em rotas existentes além das guardas; nenhum item é removido, só condicionado.

## Fora do escopo desta entrega

- UI real das telas de Plataforma B2B (clientes/assinaturas/métricas) — só esqueleto e roteamento.
- Cobrança/Stripe do escritório — só o item de menu apontando para uma página de "em breve" se ainda não existir.
- Multi-tenant real (isolamento por escritório em todas as tabelas) — mantém o modelo atual; capabilities já resolvem a visibilidade pedida agora.
