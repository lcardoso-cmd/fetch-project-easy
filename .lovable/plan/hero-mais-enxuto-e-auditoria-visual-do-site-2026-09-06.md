# Hero mais enxuto e auditoria visual do site

## O que muda no carrossel (hero)

1. **Altura**: deixa de ocupar a tela inteira. Passa a ter altura contida (cerca de 78% da tela no desktop, com mínimo e máximo definidos) e altura automática confortável no celular, sem cortes.
2. **Fundo por imagem**: cada banner ganha uma imagem de fundo inspirada na apresentação em PDF (azul-marinho profundo, formas geométricas do ícone, traços finos em ciano). Sobre a imagem entra uma "névoa" (véu azul com desfoque suave) que garante leitura confortável do texto em qualquer tamanho de tela.
3. **Logo presente**: o logotipo JurisMind AI volta a aparecer no banner, no topo do bloco de texto, em versão clara sobre o azul.
4. **Texto bem dimensionado**: título, apoio e selo com tamanhos maiores e escala responsiva; nada abaixo de 15px; apoio limitado a duas ou três linhas por banner.
5. **Botões**: sempre em uma linha (sem quebra), empilhados no celular e lado a lado a partir do tablet, com alvo de toque de 44px.
6. **Prévia do produto**: a maquete de cada banner sai do fundo e passa a ser um cartão discreto ao lado do texto no desktop; no celular ela é ocultada em favor da leitura (o conteúdo continua acessível nas seções abaixo).
7. **Controles**: setas, pausa e pontos mantidos, com contraste maior e foco visível; respeito a "movimento reduzido".

## Auditoria e correção do site (mesmo padrão em todas as seções)

Passo padrão aplicado seção por seção da página inicial e nas páginas públicas (guia, planos, login, políticas):

- **Nada quebra em duas linhas**: todos os botões e chips com texto em linha única.
- **Sem textos comprimidos**: colunas com largura mínima real, títulos com corte por reticências quando necessário, sem empilhamento acidental de palavras.
- **Grade consistente**: mesma largura máxima de conteúdo, mesmo espaçamento vertical entre seções, mesmos raios e sombras de cartão.
- **Escala tipográfica única**: um só conjunto de tamanhos para título de seção, subtítulo, corpo e legenda, aplicado em toda a página.
- **Três larguras verificadas**: 390px (celular), 768px (tablet) e 1280px (desktop), em tema claro e escuro, com captura de tela como prova.
- **Acessibilidade**: contraste AA, foco visível, ciano nunca como texto sobre branco, hierarquia de títulos correta.

Nenhuma funcionalidade é removida: as mudanças são de layout, tamanho e cor.

## Detalhes técnicos

- `src/components/marketing/hero-carousel.tsx`: reescrita da camada de apresentação — altura contida, imagem de fundo por slide, camada de névoa (gradiente + `backdrop-blur`), logo via `JurisMindMark` com `JURISMIND_CONTEXT.inlineDark`, grade `grid-cols-[minmax(0,1fr)_auto]` no mobile promovendo para flex/2 colunas no desktop.
- Seis imagens de fundo geradas em 1920x1080 (uma por banner), salvas em `src/assets/hero/` e importadas como asset ES6; estilo derivado da apresentação (navy #000038, ciano #00FFFF, geometria do ícone), sem texto embutido.
- `src/routes/index.tsx`: normalização das seções (`max-w-6xl`, `py-20 sm:py-24`), tokens semânticos apenas, `whitespace-nowrap` nos CTAs e `min-w-0`/`truncate` nos blocos de texto em linha.
- Ajustes de tokens/escala em `src/styles.css` somente se necessário para unificar tamanhos; sem novas dependências.
- Validação: `bunx tsgo --noEmit`, `bunx vitest run` e capturas Playwright em 390/768/1280 nos dois temas.

## Fora de escopo

- Banco de dados, indexação de documentos, permissões e telas autenticadas.
- Troca de fontes da marca (Cassannet/Kelson continuam pendentes de licença).
