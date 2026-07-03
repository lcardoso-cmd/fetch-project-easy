## Problemas atuais

1. **Dark mode "invertido"**: `--card` no dark hoje é branco → cards, popovers, inputs e o topbar (`bg-card`) aparecem como blocos brancos sobre o fundo navy. Borders `white/14%` somem em superfícies brancas, então inputs ficam "sem linha".
2. **Topbar destoa da sidebar** (branco vs navy).
3. **Nenhum menu de usuário** no topo — só um texto do e-mail e um `LogOut` avulso no mobile.

## O que vou fazer

### 1. Redesenhar tokens do modo escuro em `src/styles.css`

Substituir a paleta atual por uma hierarquia de superfícies coerente (padrão de SaaS profissional — Linear/Vercel style, mas na marca navy/cyan):

| Token | Valor | Uso |
|---|---|---|
| `--background` | navy quase preto (`oklch(0.18 0.05 275)`) | fundo geral |
| `--sidebar` | navy profundo (`#000038` / `oklch(0.143 0.13 278)`) | sidebar mantém a cor da marca |
| `--card` / `--popover` | navy elevado (`oklch(0.22 0.05 275)`) | cards, topbar, dropdowns |
| `--muted` | `oklch(0.26 0.04 275)` | superfícies secundárias dentro de cards |
| `--secondary` | `oklch(0.26 0.05 275)` | botões secundários |
| `--accent` | `oklch(0.30 0.06 275)` | hover |
| `--foreground` / `--card-foreground` | quase branco (`oklch(0.98 0.01 250)`) | texto |
| `--muted-foreground` | cinza-azulado (`oklch(0.72 0.02 260)`) | texto secundário |
| `--border` / `--input` | `oklch(1 0 0 / 12%)` — agora **visível** sobre superfícies escuras |
| `--primary` | cyan da marca (`oklch(0.91 0.155 195)`) | CTAs, foco, links ativos |
| `--ring` | mesmo cyan | foco acessível |

Resultado: topbar, cards e sidebar todos em tons de navy escuro, com borders sutis mas visíveis, texto branco e o cyan como único acento. Modo claro fica inalterado.

### 2. Alinhar o topbar

Nenhuma mudança de classe: como `bg-card` passa a ser navy escuro no dark, o topbar automaticamente combina com a sidebar e ganha borda inferior visível.

### 3. Menu de usuário no topo

Criar `src/components/layout/user-menu.tsx`:

- `DropdownMenu` do shadcn com trigger = `Avatar` (foto do `profiles.avatar_url` se existir; fallback com iniciais do e-mail sobre `bg-primary/10`).
- Header do menu: nome + e-mail.
- Itens: **Painel** (`/painel`), **Meu perfil** (`/configuracoes/perfil` — se a rota não existir, aponta para `/configuracoes`), **Configurações** (`/configuracoes`), separador, **Sair** (chama `signOut`).
- Buscar `full_name` e `avatar_url` do `profiles` via `useQuery` (já há client Supabase).

Substituir em `dashboard-shell.tsx`:
- **Topbar desktop** (linha 486-489): trocar `<div>{user?.email}</div>` por `<UserMenu />` (mantém `NotificationBell` ao lado).
- **Topbar mobile** (linha 455-460): remover o botão `LogOut` avulso e usar `<UserMenu />` compacto (só avatar), mantendo `NotificationBell`.

### 4. Verificação

- Alternar Claro/Escuro/Sistema e conferir: fundo, sidebar, topbar, cards, inputs, popovers, dropdowns e bordas.
- Conferir que o avatar aparece com foto (quando houver) ou iniciais, e que os itens do menu navegam corretamente.

## Fora de escopo

- Página de edição de perfil/upload de avatar (só consumo o que já existe em `profiles`).
- Refatorar componentes específicos que hardcodem cores — se algum quebrar visualmente no dark, corrijo pontualmente.
