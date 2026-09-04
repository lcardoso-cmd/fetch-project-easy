# Carrossel automático no topo da homepage

Trocar o painel estático que aparece hoje ao lado do texto principal por um carrossel que passa sozinho pelos destaques do JurisMind, com o mesmo azul-marinho e ciano da marca.

## O que o visitante vai ver

No topo da página, à direita do título, um cartão grande que troca de conteúdo sozinho a cada 6 segundos, mostrando em sequência:

1. Console do caso (o painel que já existe hoje)
2. Fluxo único: localizar, organizar, produzir, apresentar, conduzir
3. Entregas reais: análise, peça, planilha, apresentação
4. Inteligência sobre os documentos do caso (com citação do trecho)
5. Jurisprudência de fontes oficiais
6. Governança e rastreabilidade

Cada slide tem título curto, uma frase e uma miniatura visual coerente com a seção correspondente mais abaixo na página. Clicar no slide leva à seção completa.

## Controles

- Botão de pausar/retomar sempre visível (o "toggle" pedido)
- Pontos de navegação numerados para pular direto para um destaque
- Setas discretas para avançar/voltar
- Pausa automática ao passar o mouse, ao focar pelo teclado e para quem prefere menos animação
- Barra fina de progresso mostrando quanto falta para o próximo slide

## Identidade visual

- Fundo azul-marinho da marca com brilho ciano suave, como já está no topo
- Ícone/logo do JurisMind como selo do carrossel
- Títulos em Sora, textos em Inter
- Ciano usado só em detalhes e realces, nunca como texto sobre branco
- Transição suave de opacidade e leve deslize, sem saltos de altura entre slides

## Acessibilidade

- Região do carrossel anunciada corretamente para leitores de tela, com aviso de "slide 3 de 6"
- Navegação por teclado (setas, Tab, Enter) e foco visível
- Contraste conforme WCAG AA
- Respeita a preferência do sistema por movimento reduzido (inicia pausado)

## Detalhes técnicos

- Novo componente `src/components/marketing/hero-carousel.tsx`, usando o `carousel` (Embla) já presente em `src/components/ui/carousel.tsx` com autoplay controlado por estado próprio (sem plugin novo)
- `CaseConsole` atual vira o primeiro slide, reaproveitado sem duplicar código
- Integração apenas no bloco do topo em `src/routes/index.tsx`; nenhuma outra seção é alterada
- Altura fixa por breakpoint para evitar deslocamento de layout
- Validação: typecheck, testes existentes e capturas no desktop e no celular

## Fora do escopo

Demais seções da homepage, área autenticada, textos comerciais e SEO permanecem como estão.
