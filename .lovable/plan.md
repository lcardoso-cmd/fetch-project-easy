# Pré-visualização Word no editor de proposta

Hoje o card **Resultado** só mostra o `RichTextEditor`. A ideia é adicionar um **toggle** no topo do card com dois modos: **Editor** (como hoje) e **Prévia Word** — uma página no formato do `.docx` exportado, com os mesmos estilos do template, para você conferir o resultado antes de baixar.

## Escopo

- Mudança 100% presentacional em `src/routes/_authenticated/proposal.tsx` + 1 componente novo.
- Nenhuma alteração no template `.docx`, na rota `/api/tools/petition`, no schema ou nos server functions.
- Vale só para o card de resultado da proposta (que é onde há edição rica). Petição/resumo ficam de fora.

## O que aparece na prévia

Um "papel" no formato **US Letter (8,5" × 11")**, escala responsiva ao container, com:

- Sombra e borda sutis simulando página.
- Margens brancas de **1 polegada** (idêntico ao template).
- **Cabeçalho**: "B2B | JurisMind AI" à esquerda, "Proposta comercial" à direita, linha inferior cinza claro — igual ao header do docx.
- **Corpo** renderizando o HTML do editor, mas com CSS espelhando os estilos nomeados:
  - Fonte Calibri (fallback: Carlito/Arial), 11pt, line-height 1.35, cor `#0F172A`.
  - `h1` → 16pt bold com borda inferior fina (Heading1).
  - `h2` → 13pt bold cor `#1E3A8A` (Heading2).
  - `h3` → 11pt bold uppercase cor `#334155` (Heading3).
  - `ul`/`ol`/`li`, `blockquote` e alinhamento inline com os mesmos deslocamentos.
- **Título** no topo: "Proposta - {cliente}" no estilo Title (24pt bold).
- **Rodapé**: "Documento gerado por B2B | JurisMind AI" à esquerda, "Página 1" à direita (rótulo estático — o número real vem do Word).
- Aviso pequeno abaixo: "Prévia aproximada. A paginação real é gerada pelo Word."

Zoom automático: a página tem largura fixa 816px (8,5" × 96dpi) e é reduzida por `transform: scale(...)` conforme o container, sem quebrar o layout do formulário ao lado.

## UI

Dentro do `CardHeader` do "Resultado":

```
[ Editor | Prévia Word ]     [ Copiar ] [ Baixar PDF ] [ Baixar .docx ]
```

Um `Tabs` do shadcn (ou `ToggleGroup`) controla o modo. Em **Editor**, o `RichTextEditor` atual. Em **Prévia Word**, o novo componente `WordPreview` recebendo `html={output}` e `title={"Proposta - " + form.client_name}`. Trocar de aba não altera o HTML.

## Arquivos

- **Novo:** `src/components/proposal/word-preview.tsx` — componente puramente visual (page, header, footer, área de conteúdo com classe `.word-doc`).
- **Novo:** `src/styles/word-preview.css` (ou bloco `<style>` local) — CSS espelhando os tokens de `src/lib/docx/template.ts` (`TEMPLATE_COLORS`, tamanhos de heading, indent das listas).
- **Editado:** `src/routes/_authenticated/proposal.tsx` — importar Tabs + `WordPreview`, envolver o bloco `output ? <RichTextEditor.../>` num `Tabs`.

## Fora de escopo (posso adicionar depois se quiser)

- Paginação real (quebras em 11" com cálculo de altura por página). Requer medição via ResizeObserver + iteração — mais frágil e caro.
- Numeração dinâmica "Página X de Y".
- Marca d'água "RASCUNHO" para versões não salvas.
