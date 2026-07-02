## 1. Rótulos com letra maiúscula (Partes / Parte representada)

Aplicar `capitalize` em todos os lugares onde `party.role` / `represented_party.role` é renderizado como badge ou entre parênteses:

- `src/components/chat/jurismind-chat.tsx`
  - linha 511-512: `caseInfo.represented_party.role` → capitalizar
  - linha 543: `{p.role}` (badge da lista de partes no painel do caso) → capitalizar
- Confirmar que `src/routes/_authenticated/cases.$caseId.tsx` já usa `capitalize` (ok) e reforçar o mesmo padrão em qualquer novo render.
- Padronizar utilitário `capitalize` em `src/lib/formatters.ts` (ou reutilizar) para ambos os arquivos importarem, evitando divergência futura.

## 2. Substituir o ícone genérico (Sparkles) pela logo B2B | JurisMind AI

- Registrar a logo enviada (`user-uploads://LOGO_JURISMIND.png`) como asset via `lovable-assets` em `src/assets/jurismind-logo.png.asset.json`.
- Criar componente `src/components/brand/jurismind-mark.tsx` que renderiza a logo como `<img>` com tamanho controlável (`size`, `className`) — variação escura/clara conforme fundo (a arte tem fundo azul; usamos como-está em superfícies claras e invertemos com `dark:invert` só se necessário).
- Substituir todos os usos de `Sparkles` de `lucide-react` como marca do agente pelos seguintes arquivos:
  - `src/routes/index.tsx` (hero / header / seção)
  - `src/routes/_authenticated/dashboard.tsx`
  - `src/components/chat/chat-panel.tsx`
  - `src/components/chat/jurismind-chat.tsx` (avatar do assistente, empty state)
  - `src/components/cases/case-summary-card.tsx`
  - `src/routes/_authenticated/cases.new.tsx`
- Manter Sparkles apenas se ainda for útil como ícone decorativo de "ação de IA" em botões (não como identidade do agente); caso contrário, remover import.

## 3. Reorganizar os botões de ações rápidas do chat (imagem 4)

Em `src/components/chat/jurismind-chat.tsx` a barra tem ~16 botões em duas linhas — poluído.

Nova organização:
- Manter 4-5 atalhos "estrela" sempre visíveis como chips: **Resumo do caso**, **Linha do tempo**, **Pontos críticos**, **Análise de risco**, **Extrair prazos**.
- Agrupar o resto em um `DropdownMenu` (`shadcn/ui`) com botão **"Mais ações ▾"** contendo submenus:
  - **Peças** → Petição inicial, Contestação, Contrarrazões, Alegações finais, Notificação extrajudicial
  - **Perícia / Técnica** → Quesitos periciais, Manifestação técnica, Parecer técnico, Planilha de cálculo, Apresentação
  - **Utilidades** → Extrair partes, Extrair prazos
- Preservar os mesmos `prompt`s já definidos no array `QUICK_ACTIONS`, apenas categorizando.
- Layout compacto, alinhado à esquerda logo acima do composer, com rolagem horizontal em mobile.

## 4. Homepage: linguagem para advogados, peritos e assistentes técnicos

Em `src/routes/index.tsx`:
- Substituir textos que dão tom exclusivo de advocacia:
  - "B2B | JurisMind AI aplicado à advocacia" → "B2B | JurisMind AI para o jurídico técnico"
  - "Sua mente jurídica, potencializada…" → título neutro, ex.: **"Inteligência para advogados, peritos e assistentes técnicos"**
  - "Feito para advogados" no footer → "Feito para advogados, peritos e assistentes técnicos."
- Ajustar copy do hero, features e CTA para citar as três personas de forma equilibrada (petições / laudos / pareceres técnicos, prazos processuais / quesitos periciais / manifestações).
- Meta `title` / `description` já cita as três — manter e alinhar restante da página com essa promessa.
- Ícones das features: substituir Sparkles pela marca JurisMind onde representa o "agente"; manter ícones lucide temáticos (Scale, Microscope, FileSearch etc.) para as três personas.

### Detalhes técnicos

- Nenhuma mudança de schema/banco.
- Sem novas dependências (usa `DropdownMenu` já do shadcn).
- Asset da logo entra via `lovable-assets create --file /mnt/user-uploads/LOGO_JURISMIND.png`.
- Alterações puramente de frontend/presentational.