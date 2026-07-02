
## Sobre a "segurança" das URLs

Antes do plano, um esclarecimento importante: **URLs explícitas NÃO são um problema de segurança**. O que protege o sistema é:

- O gate `_authenticated` (usuário sem sessão nunca chega na página)
- As **policies de RLS no banco** (mesmo que alguém adivinhe a URL, não vê dado de outro escritório)
- A checagem de capabilities server-side (`super_admin`, `platform_admin`, etc.)

Esconder URLs ("security through obscurity") é considerado má prática — Google, Stripe, Linear e Notion todos usam `/dashboard`, `/settings`, `/inbox` públicos. O que é sensível são **IDs de recursos** (ex: `/assistencias/abc-123`), e esses já são UUIDs não-adivinháveis protegidos por RLS. Então o problema real aqui é **branding e profissionalismo**, não segurança — e é isso que o plano abaixo resolve.

## O plano: URLs em português, alinhadas ao produto

Renomear todas as rotas autenticadas para slugs PT-BR que batem com os labels da sidebar, mantendo redirects 301-like das URLs antigas para não quebrar links salvos.

### Mapeamento de rotas

| Rota atual              | Rota nova                | Label na sidebar     |
|-------------------------|--------------------------|----------------------|
| `/dashboard`            | `/painel`                | Painel               |
| `/cases`                | `/assistencias`          | Assistências         |
| `/cases/new`            | `/assistencias/nova`     | Nova assistência     |
| `/cases/bulk`           | `/assistencias/lote`     | Importação em lote   |
| `/cases/$id`            | `/assistencias/$id`      | (detalhe)            |
| `/cases/$id/chat`       | `/assistencias/$id/chat` | Chat da assistência  |
| `/my-tasks`             | `/tarefas`               | Minhas Tarefas       |
| `/inbox`                | `/conversas`             | Conversas            |
| `/calendar`             | `/agenda`                | Agenda               |
| `/my-files`             | `/documentos`            | Meus Documentos      |
| `/drafter`              | `/pecas`                 | Peças Jurídicas      |
| `/expert-opinion`       | `/parecer-tecnico`       | Parecer Técnico      |
| `/proposal`             | `/propostas`             | Proposta Comercial   |
| `/monitoring`           | `/publicacoes`           | Publicações          |
| `/marketing`            | `/marketing`             | Marketing            |
| `/integrations`         | `/integracoes`           | Integrações          |
| `/settings`             | `/configuracoes`         | Configurações        |
| `/settings/firm`        | `/configuracoes/escritorio` | Identidade       |
| `/settings/oauth`       | `/configuracoes/oauth`   | OAuth                |
| `/notifications`        | `/notificacoes`          | Notificações         |
| `/chat`                 | `/assistente`            | (assistente global)  |
| `/onboarding`           | `/boas-vindas`           | (fluxo inicial)      |
| `/platform`             | `/plataforma`            | Visão B2B            |
| `/platform/customers`   | `/plataforma/clientes`   | Clientes             |
| `/platform/users`       | `/plataforma/usuarios`   | Usuários             |
| `/platform/credentials` | `/plataforma/credenciais`| Credenciais          |
| `/platform/audit`       | `/plataforma/auditoria`  | Auditoria            |
| `/auth`                 | `/entrar`                | Login                |
| `/invite/$token`        | `/convite/$token`        | Convite              |

### O que muda no código

1. **Renomear os arquivos** em `src/routes/_authenticated/*` e `src/routes/*` para os novos nomes, e atualizar cada `createFileRoute("...")` com o novo path.
2. **Atualizar todos os `<Link to="...">`, `navigate({ to })` e `redirect({ to })`** — principalmente `dashboard-shell.tsx`, redirects de auth, botões de "voltar", OAuth callbacks.
3. **Redirects legados**: criar arquivos de rota "shim" para cada URL antiga (`/dashboard.tsx`, `/cases.tsx` etc.) que só chamam `throw redirect({ to: "/painel" })` no `beforeLoad`. Assim links antigos salvos (email, WhatsApp) continuam funcionando.
4. **OAuth `redirect_uri`**: revisar `integrations` e `settings/oauth` para garantir que a URL de callback registrada no Google/Microsoft continua válida (o callback fica em `/api/...`, não muda).
5. **Metadata (`head()`)**: aproveitar para revisar `<title>` de cada rota em PT-BR (já está mas conferir consistência: "Painel — B2B | JurisMind AI", etc.).
6. **Sidebar (`dashboard-shell.tsx`)**: atualizar o array `NAV` com as novas URLs.
7. **`routeTree.gen.ts`** regenera sozinho — não mexer.

### Fora de escopo

- Não renomear tabelas do banco (ex.: `cases` continua `cases`). O nome interno do recurso é irrelevante para o usuário; só as URLs mudam.
- Não mudar os IDs de recursos (continuam UUIDs).
- Não mudar nada em `/api/*` (endpoints internos e webhooks — nomes técnicos ficam em inglês por convenção).

### Riscos

- Muitos arquivos tocados (30+ rotas + todos os `<Link>`). Vou fazer em uma leva só para não deixar links quebrados entre commits.
- Bookmarks antigos e emails já enviados: cobertos pelos shims de redirect.
- Google/Microsoft OAuth: o `redirect_uri` registrado no console é `/api/...`, então não é afetado; só confirmar.
