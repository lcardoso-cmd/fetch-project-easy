## Problema

Hoje o editor de proposta tem dois pontos que quebram a edição livre e a fidelidade do `.docx`:

1. **`RichTextEditor` só sincroniza o HTML no mount** (`useEffect(..., [])`). Quando o `output` muda por fora — geração pela IA, restauração de versão, migração do rascunho do servidor, "limpar campos" — o `contenteditable` continua exibindo o conteúdo antigo (ou vazio). O usuário digita "por cima" de um estado defasado, e ao salvar/exportar o que vai é o HTML antigo. Também não dá para editar depois de restaurar uma versão.
2. **O conversor `htmlToDocxChildren`** cobre `<h1-3>`, `<p>`, `<li>`, `<div>`, `<blockquote>` e inline `<b/strong>`, `<i/em>`, `<u>`, mas ignora dois artefatos comuns do `document.execCommand` que costumam surgir com edição livre e colagens:
   - `<span style="font-weight:bold|font-style:italic|text-decoration:underline">` (Chrome/Safari emitem isso ao aplicar bold em seleções parciais).
   - Alinhamento aplicado via `<div align="...">` ou `style="text-align:..."` em `<div>` sem `<p>` interno — hoje já pega, mas parágrafo com múltiplos `<div>` filhos vira 1 parágrafo por `<div>` sem preservar quebra.

## Correções

### 1. Sincronizar o editor com props (sem quebrar o cursor)

`src/components/chat/rich-text-editor.tsx`:

- Guardar o último HTML emitido pelo próprio editor num `useRef` (`lastEmittedRef`).
- No `useEffect` **sem** array vazio: quando `html` prop muda **e** difere tanto de `ref.current.innerHTML` quanto de `lastEmittedRef.current`, atualizar `innerHTML` e restaurar o foco no final. Isso trata carga inicial, restauração de versão e regeneração pela IA, sem provocar reset de cursor a cada tecla.
- No `onInput`, atualizar `lastEmittedRef.current` antes de chamar `onChange`.
- Adicionar `onPaste` que faz `e.preventDefault()` e injeta `text/html` sanitizado (remover `<script>`, `<style>`, atributos `on*` e `class`/`id`) via `document.execCommand("insertHTML", ...)`. Fallback para `text/plain` como parágrafos.
- Expor `aria-label` e `role="textbox"` no div editável.

### 2. Robustecer `htmlToDocxChildren`

`src/lib/docx/template.ts`:

- Ampliar `parseInline` para reconhecer `<span>` com `style="font-weight:bold|700"`, `font-style:italic`, `text-decoration:underline` — empilhando o run com o atributo correspondente e desempilhando no `</span>`.
- Reconhecer `<s>` / `<strike>` / `<del>` como `strike: true` no `TextRun`.
- Tratar `<br>` dentro de um bloco como quebra de linha real, usando `TextRun({ break: 1 })` ao invés de `\n` (evita perder a quebra ao normalizar).
- Manter `<div>` como bloco (já funciona), mas se um `<p>`/`<div>` contiver `<div>`s aninhados (Chrome faz isso), achatar em parágrafos separados.
- Preservar `text-align` também quando aparece em `<p style="text-align:justify">` (adicionar `justify` ao `alignMap`).

### 3. Ajuste no fluxo do `proposal.tsx`

Nenhuma mudança de lógica de negócio. Apenas garantir que, ao restaurar uma versão (`restoreVersion`) ou receber saída da IA (`generate`), `setOutput(newHtml)` continua sendo a única fonte da verdade — a correção do editor (#1) faz o resto.

### 4. Verificação

- Rodar Playwright em `/proposal`: gerar proposta, editar (digitar, negrito, lista, alinhar centro), restaurar versão anterior, editar de novo, exportar `.docx`. Descompactar o arquivo resultante e conferir que negrito/itálico/listas/alinhamento aplicados aparecem no `document.xml`.
- Conferir também que o log do console não solta warning de "cursor jumped" nem re-render infinito.

## Fora do escopo

- Trocar `contentEditable + execCommand` por Tiptap/ProseMirror (mudança grande; fica para depois).
- Suporte a tabelas / imagens dentro do editor (o template DOCX já tem `styledTable`, mas nem a UI nem o conversor tratam `<table>` do editor hoje).
