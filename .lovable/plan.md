# Destaque do guia "Automatizar petições jurídicas com IA" na homepage

## Objetivo
Transformar o guia `/guia/automatizar-peticoes-juridicas-ia` de um link discreto no rodapé em um ponto de entrada visível na homepage, explicando como o JurisMind faz a automação de petições.

## O que será feito

1. **Nova seção de destaque na homepage** (`src/routes/index.tsx`)
   - Inserir uma seção entre "Fluxo do caso" e "Entregas" (ou imediatamente após "Entregas") com:
     - eyebrow "Guia prático" ou "Como funciona"
     - título focado no keyword "como automatizar petições jurídicas"
     - subtítulo curto sobre produtividade + revisão final do advogado
     - 4 passos resumidos do guia (subir documentos → pedir minuta → revisar fontes → exportar)
     - CTA primário: "Ver o guia completo" → `/guia/automatizar-peticoes-juridicas-ia`
     - CTA secundário: "Testar grátis por 30 dias" → `/entrar?modo=cadastro&origem=guia_home`
   - Usar os tokens de cor e tipografia do design system (navy/ciano, sem cinza-grafite, fontes Sora/Inter).
   - Garantir que os CTAs não quebrem em duas linhas a partir de `lg` e fiquem em coluna no mobile.

2. **Link no menu superior** (`src/routes/index.tsx`)
   - Adicionar item "Guia" no `<nav>` do header, apontando para a rota do guia, para reforçar a descoberta.

3. **Reaproveitamento de conteúdo** (`src/lib/marketing/pitch-content.ts`)
   - Adicionar um novo bloco `guideHighlight` em `PITCH` com título, subtítulo e passos, mantendo a homepage e eventuais futuras apresentações sincronizadas.

4. **Validação**
   - Rodar `bunx tsgo --noEmit` para garantir que não haja erros de tipo.
   - Verificar visualmente no preview desktop/tablet/mobile se a seção aparece, os CTAs estão alinhados e o link funciona.

## Fora de escopo
- Não alterar o conteúdo do guia em si.
- Não criar novas migrations ou backend.
- Não modificar o sitemap (já inclui a rota).
