# Modo escuro na identidade da marca + botões em linha única

## O que muda para você

1. **Modo escuro fiel à marca.** Hoje o tema escuro usa cinza-grafite, que não pertence à identidade. Ele passa a ser construído sobre o azul da marca: fundo azul quase preto, cartões em azul mais claro, textos em branco e ciano reservado apenas para o botão principal, foco, item ativo e destaques de gráfico.
2. **Botões da página inicial sempre em uma única linha.** Nos três blocos de chamada (topo do site, hero e fechamento) os botões deixam de quebrar em duas linhas: em telas estreitas eles empilham em coluna com largura total; a partir de tablet ficam lado a lado, em linha única, sem quebrar o texto.

## Paleta do escuro (escolhida)

| Uso | Cor |
| --- | --- |
| Fundo da tela | #06061F |
| Seções, colunas, cabeçalho | #0C0C33 |
| Cartões, campos, tabelas | #151548 |
| Hover, popovers, aba ativa | um degrau acima de #151548 |
| Barra lateral | #000038 (navy da marca) |
| Ação principal, foco, ativo | #00FFFF (ciano), uso restrito |
| Texto | branco / branco levemente azulado |

Ciano nunca como texto longo sobre claro; sempre como preenchimento com texto navy, ou como marcador/contorno.

## Escopo

Todo o sistema: painel, cadastros, chat, Kanban, tabelas, formulários, homepage pública e a apresentação em PDF (que herda a paleta da marca).

## Detalhes técnicos

- `src/styles.css`, bloco `.dark`: substituir os tokens grafite (`oklch(... 0.0xx 262)`) por tokens derivados do navy — `--surface-1/2/3`, `--background`, `--header`, `--card`, `--popover`, `--muted`, `--accent`, `--border`, `--input`, `--secondary`. Manter `--primary: var(--brand-cyan)` com `--primary-foreground: var(--brand-navy)` e `--ring: var(--brand-cyan)`.
- Ajustar `--border`/`--input` para azuis claros o suficiente para permanecerem visíveis sobre superfícies navy (contraste mínimo 3:1 em elementos de interface).
- `--chart-2..5`: trocar os cinzas por variações de azul/ciano da marca, mantendo distinção entre séries.
- `--destructive` e estados de status (âmbar de documento parcial, verde de sucesso) revalidados para AA sobre as novas superfícies navy.
- Varrer com `rg` classes de cor cinza hardcoded em modo escuro (`dark:bg-zinc`, `dark:bg-neutral`, `dark:bg-slate`, `#16191D` e derivados) em `src/components` e `src/routes` e trocá-las pelos tokens semânticos.
- `src/routes/index.tsx`: nos grupos de CTA das linhas ~230, ~266, ~559 e ~572, substituir `flex flex-wrap` por `flex flex-col sm:flex-row` com `w-full sm:w-auto` nos botões e `whitespace-nowrap` nos rótulos, garantindo linha única a partir de `sm`.
- Verificação: `tsgo`, `bunx vitest run`, e captura em navegador headless da homepage e do painel nos temas claro e escuro em 390px, 768px e 1280px.
