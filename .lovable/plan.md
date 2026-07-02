## Objetivo

Três melhorias no fluxo de Propostas:

1. **Comparar duas versões quaisquer** do histórico lado a lado (não só versão × atual).
2. **Buscar/filtrar** o histórico por cliente/rótulo e por intervalo de datas.
3. **PDF com a mesma tipografia do DOCX**: mesma família (Calibri), tamanhos, negrito/itálico/sublinhado, alinhamentos e espaçamentos idênticos.

---

## 1. Comparação lado a lado (duas versões)

Arquivo: `src/components/proposal/proposal-versions-dialog.tsx`.

- Adicionar seleção múltipla na lista (checkbox em cada versão, máx. 2). Barra superior mostra "Comparando A × B" com botão "Limpar".
- Painel direito ganha uma terceira aba **"Comparar A × B"** (além de "Pré-visualizar" e "Comparar com atual"):
  - Layout `grid grid-cols-2` com dois `ScrollArea` sincronizados por scroll (listener em um propaga `scrollTop` no outro).
  - Cabeçalho de cada coluna: rótulo, data e origem da versão.
  - Corpo: HTML renderizado da versão (mesmo estilo do preview).
  - Abaixo, um "Diff textual A → B" reutilizando `diffHtml(a.output, b.output)` de `src/lib/proposal-diff.ts`, e "Campos alterados" com `diffForms(a.form, b.form)`.
- Botões de ação por coluna: **Restaurar esta**.

## 2. Busca e filtros no histórico

Mesmo dialog:

- Barra de filtros acima da lista:
  - `Input` de busca (filtra por `label`, `description`, e por cliente extraído de `form.cliente_nome`/`form.client_name` — normaliza acentos/caixa).
  - `Popover` de datas com dois `Calendar mode="single"` (De / Até) + preset rápido "Últimos 7/30/90 dias".
  - `Select` de origem: `todas / manual / gerada / auto`.
  - Toggle "Somente fixadas".
- Ordenar por: mais recentes (default), mais antigas, rótulo A→Z.
- Contador "X de Y versões" quando há filtro ativo.
- Filtro roda client-side sobre `versions` (já vem completo do server); não muda backend.

## 3. PDF com tipografia do DOCX

Meta: PDF e DOCX visualmente idênticos — mesma família, tamanhos, pesos, sublinhado e alinhamentos.

Como o Word usa **Calibri** (proprietária, não redistribuível), o PDF vai embutir **Carlito** — fonte livre criada pela Google **metricamente compatível com Calibri** (mesma largura de caractere e mesma altura de linha). Resultado visual idêntico ao Word em telas normais.

### Mudanças

- `bun add @pdf-lib/fontkit pdf-lib` para embutir TTF com subsetting.
- Adicionar fontes ao repo em `src/lib/documents/fonts/` (Carlito Regular/Bold/Italic/BoldItalic — SIL OFL, ~350KB total, servidas do bundle do server function).
- Reescrever `src/lib/documents/pdf-renderer.ts` para usar `pdf-lib`:
  - `PDFDocument.create()` → `registerFontkit(fontkit)` → `embedFont(bytes, { subset: true })` para as 4 variantes.
  - Substituir writer manual atual pelo pipeline `pdf-lib` (paginação, `drawText`, `drawLine` para underline/strike, retângulos para bordas de header/footer).
  - Manter o algoritmo de layout existente (quebra por token, justify, listas, headers), mas substituir métrica AFM (`textWidthPt` em `pdf-fonts.ts`) por `font.widthOfTextAtSize()` da fonte Carlito embutida — larguras reais e Unicode nativo (elimina `toWinAnsi` e o `?` para acentos).
- Atualizar `src/lib/documents/tokens.ts`:
  - `FONTS.pdfBody = "Carlito"` (etc.).
  - Tamanhos permanecem em `FONT_SIZES_PT` (11pt body igual DOCX).
- `src/lib/documents/pdf-fonts.ts`: remover tabela AFM Helvetica, exportar apenas o tipo `PdfFontFace = "body" | "bold" | "italic" | "boldItalic"` e helper `pickFace(bold, italic)`.
- Suporte a Unicode completo (acentos portugueses, aspas curvas "" '', travessão —, bullet •) sem substituição, já que Carlito TTF tem essas glifos.

### Consistência garantida com DOCX

| Elemento | DOCX (Word) | PDF (novo) |
|---|---|---|
| Fonte corpo | Calibri 11pt | Carlito 11pt (métrica Calibri) |
| H1 / H2 / H3 | Calibri Bold 16/13/11pt | Carlito Bold 16/13/11pt |
| Título | Calibri Bold 24pt | Carlito Bold 24pt |
| Negrito/Itálico/Sublinhado/Alinhamento | nativo | igual (via `pdf-lib` + linhas) |
| Line-height | 1.35 | 1.35 |
| Margens | 1" | 1" |
| Header/Footer | firma + label + página | igual |

---

## Detalhes técnicos

- **Sincronização de scroll (A×B)**: refs em cada `ScrollArea` viewport; handler `onScroll` com flag para evitar loop.
- **Filtro por cliente**: normalização `s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()`.
- **Presets de data**: gera `from`/`to` a partir de `Date.now() - N*86400000`.
- **pdf-lib no Worker**: `pdf-lib` + `@pdf-lib/fontkit` são JS puros, ok no runtime workerd. Fontes importadas como `?url` + `fetch` em dev, ou como `Uint8Array` via `import bytes from "./fonts/Carlito-Regular.ttf" with { type: "bytes" }` — usar o padrão que já funcione no Vite/TSS do projeto (fallback: `readFile` no server function).
- Nada no backend/DB muda para as tarefas 1 e 2.

## Fora de escopo

- Comparar A × B com merge de mudanças (só visualização).
- Compartilhar link de comparação.
- Suporte a fontes customizadas por escritório (fica com Carlito para todos).
