# Redesign — Minimal Editorial

Direção escolhida: **minimal editorial**, muito espaço em branco, tipografia leve, cinza sutil, navy `#000038` só como âncora de marca e CTAs. Referência de densidade: Linear / Notion / Stripe Dashboard.

## Princípios

- Uma coisa de cada vez. Menos cards competindo, mais fluxo linear.
- Tipografia como estrutura, não bordas. Peso e escala definem hierarquia; bordas somente quando indispensáveis.
- Espaço em branco generoso: seções respiram, `space-y` maior, padding vertical dobrado.
- Cor: 90% neutro (`#ffffff` / `#f7f7f5` / `#0a0a0a`), navy só em marca, links e CTA primário.
- Sem "toolbars flutuantes" empilhadas. Ações contextuais, não sempre visíveis.

## Fase 1 — Fundação (tokens + shell)

**Objetivo:** trocar a base visual sem quebrar nada.

- Ajustar `src/styles.css`:
  - Fundo do app: `#ffffff` (light) e `#0a0a0a` (dark), removendo o cinza-azulado atual.
  - Superfície de cards: `#f7f7f5` (light), sem borda por padrão — usar `ring-1 ring-black/5` só quando precisar destacar.
  - Tipografia: reduzir `text-base` padrão dos títulos de página de `text-2xl font-black` para `text-xl font-medium tracking-tight`. Corpo em `text-[13px]` para densidade editorial.
  - Espaçamento base entre seções: subir de `gap-4` para `gap-8`/`gap-10`.
  - Radius: padronizar em `rounded-lg` (10px) — remover `rounded-2xl` largos.
- Sidebar (`src/components/app-sidebar.tsx` e correlatos):
  - Remover fundo forte; usar `bg-transparent` com `border-r border-black/5`.
  - Itens: `text-[13px]`, ícone 16px, altura 32px, hover `bg-black/[.04]`, ativo com barra vertical navy de 2px + peso medium (sem pill colorida).
  - Grupos: label em `text-[11px] uppercase tracking-wider text-muted-foreground`, sem ícone e sem `(i)` decorativos.
  - Rodapé compacto: avatar 24px + email truncado + menu, uma linha.
  - Remover a barra vertical extra que aparece hoje ao lado da sidebar (colapso duplicado).
- Header interno padrão: linha única com título + breadcrumb sutil + ações à direita, sem card envolvendo.

## Fase 2 — Proposta Comercial como wizard

Substituir o layout "tudo empilhado + duas colunas" por um wizard linear de 4 etapas em coluna única, largura máxima `max-w-2xl` centralizada; a prévia vira etapa final e/ou drawer.

Etapas:

1. **Documentos do cliente** — dropzone só, sem card externo. Chips de anexos abaixo.
2. **Dados do caso** — Caso vinculado, Cliente, Contraparte. Campos agrupados por rótulo à esquerda / input à direita (grid `[minmax(0,180px)_1fr]`), sem títulos de seção redundantes.
3. **Escopo & honorários** — Matéria, Escopo, Honorários, Prazo, Tom.
4. **Prévia & exportação** — editor central em largura de página A4 real (816px), ações (Copiar, PDF, .docx, Compartilhar, A4/Retrato) em uma única barra discreta acima. Sem tabs "Editor / Prévia Word" — o editor já é WYSIWYG A4.

Navegação:

- Barra de progresso fina no topo (4 pontos + label da etapa).
- Botões `Voltar` / `Continuar` fixos no rodapé da etapa; `Gerar proposta` só aparece na etapa 3.
- Rascunho auto-salvo continua, mas o toast "Rascunho restaurado" vira badge sutil no topo (`text-xs text-muted-foreground`), não notificação flutuante.
- Ações globais (`Descartar`, `Salvar versão`, `Histórico`, `Limpar tudo`, `Converter em caso`) saem do topo e vão para um menu `···` no header — só `Salvar versão` e `Histórico` ficam visíveis quando na etapa 4.

Editor:

- Toolbar reduzida a Bold, Italic, H1, H2, Lista, Desfazer. Nada de alinhamento — o template já cuida.
- Fundo branco puro, sombra `shadow-[0_1px_0_rgba(0,0,0,0.04)]`, sem borda pesada.

## Fase 3 — Aplicar padrão às outras telas internas

Aplicar o mesmo shell + tipografia + densidade em, nesta ordem:

1. Painel / Meu Espaço
2. Assistências (lista + detalhe)
3. Parecer Técnico
4. Meus Documentos
5. Configurações e telas de admin (Usuários, Clientes SaaS, etc.)

Regras comuns:

- Página começa com título `text-xl font-medium`, subtítulo `text-sm text-muted-foreground`, sem card ao redor.
- Listas: linhas com `divide-y divide-black/5`, sem cards individuais.
- Filtros: input único de busca + 1–2 selects inline, sem `Card` envolvendo.
- Estados vazios: ilustração fina + 1 frase + 1 CTA. Sem "dicas" empilhadas.

## Fase 4 — Passada final

- Revisar dark mode em todas as telas tocadas (contraste do navy sobre `#0a0a0a`).
- Checar mobile/tablet: sidebar vira off-canvas, wizard mantém coluna única.
- Playwright screenshot das telas principais em light/dark/mobile para validação visual.

## Fora de escopo

- Não mexer em lógica de negócio, geração de IA, RLS, endpoints ou schema.
- Não trocar a paleta de marca (navy `#000038` fica).
- Sem novas dependências de UI.

## Detalhes técnicos

- Arquivos principais afetados: `src/styles.css`, `src/components/app-sidebar.tsx`, `src/components/ui/sidebar.tsx` (só se necessário para remover barra dupla), `src/routes/_authenticated/propostas.tsx`, `src/components/chat/rich-text-editor.tsx`, `src/components/proposal-*`, e headers/páginas listadas na Fase 3.
- Wizard implementado com estado local (`useState<Step>`) + `useBlocker` já existente para unsaved changes; sem router aninhado para não invalidar rascunhos.
- Toolbar de exportação reaproveita handlers atuais (`downloadDocx`, `downloadPdf`, `sharePropostaLink`) — só muda o container visual.
- Tokens novos entram em `@theme` no `styles.css`; nada de classe hardcoded (`bg-white`, `text-black`) fora dos tokens.

## Entregas por fase

- Fase 1 → PR visual: shell + sidebar + tokens. App inteiro parece novo, sem mudança de fluxo.
- Fase 2 → Proposta Comercial vira wizard.
- Fase 3 → Demais telas internas alinhadas.
- Fase 4 → QA visual e ajustes.

Posso executar as fases uma a uma (recomendado) ou tudo de uma vez. Diga qual prefere ao aprovar.
