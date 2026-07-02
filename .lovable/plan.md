## Objetivo
Adicionar (1) uma **capa** com dados do cliente e (2) uma **marca d'água** ("Rascunho" ou "Versão X") no PDF exportado a partir de `/propostas`.

## Mudanças

### 1. `src/lib/documents/pdf-renderer.ts`
Estender `RenderPdfInput`:
```ts
cover?: {
  clientName?: string;
  clientDocument?: string;
  clientAddress?: string;
  matter?: string;      // objeto/assunto
  reference?: string;   // ex: "Proposta Comercial nº 001/2026"
  date?: string;        // "02 de julho de 2026" (default: hoje pt-BR)
} | null;
watermark?: { text: string; opacity?: number } | null;
```
- Nova função `drawCoverPage(page, cover, branding, fonts, layout)`:
  - Firma no topo (usa `branding.firmName` em caixa alta, cor accent, centralizado).
  - Título grande centralizado (`FONT_SIZES_PT.title` * 1.6).
  - Bloco "Preparado para" com os campos do cliente (label muted + valor ink), alinhado à esquerda, com espaçamento generoso.
  - Bloco "Assunto/Referência/Data" no rodapé da capa.
  - Sem header/footer numerado nessa página; a numeração começa em 1 na página de conteúdo (ajustar `paginate`/loop para offset).
- Nova função `drawWatermark(page, text, fonts, layout, opacity)`:
  - Texto rotacionado ~45° (via `degrees(45)` já importado), grande (~90pt), cor cinza claro com `opacity` ~0.12.
  - Centralizado geometricamente na página. Aplicado a **todas as páginas incluindo a capa**.
- No entry point, quando `cover` truthy, adicionar a capa como primeira página, e ajustar `Página X de Y` para começar a partir da segunda página (capa fica sem paginação; total exclui a capa).

### 2. `src/routes/api/tools/pdf.ts`
Adicionar ao body:
- `cover?: { clientName?, clientDocument?, clientAddress?, matter?, reference?, date? }`
- `watermark?: { text: string; opacity?: number }`

Repassar para `renderPdf(...)`. Validação simples (strings ≤ 300 chars).

### 3. `src/routes/_authenticated/propostas.tsx`
No Popover de PDF (após margens), adicionar seção **"Capa e marca d'água"**:
- Switch **"Incluir capa com dados do cliente"** (default ligado). Estado: `pdfCoverEnabled`.
- Switch **"Marca d'água"** (default desligado). Estado: `pdfWatermarkEnabled`.
- Select para tipo: `"draft"` → "Rascunho" · `"version"` → usa `versionLabel` atual · `"custom"` → mostra Input.
- Persistir preferências em `localStorage` (`propostas.pdfOptions`).

No `downloadPdf()`:
- Se `pdfCoverEnabled`, montar `cover` com `form.client_name`, `form.client_document`, `[form.client_address, form.client_city_state].filter(Boolean).join(" — ")`, `form.matter`, `titulo`, data atual formatada em pt-BR.
- Se `pdfWatermarkEnabled`, montar `watermark: { text: resolvedText }` — usar "Rascunho" ou o `versionLabel` truncado ou o custom.
- Enviar ambos no body.

### 4. QA
Fazer download de um PDF de teste com capa + watermark "Rascunho" e outro com "Versão — Cliente X". Converter páginas em imagem com `pdftoppm` e inspecionar:
- Capa renderiza título, firma, bloco cliente, referência, data — sem sobreposições nem clipping.
- Watermark aparece diagonal em todas as páginas com opacidade correta.
- Numeração "Página X de Y" começa em 1 na primeira página de conteúdo e Y não conta a capa.
- Layout mantém margens configuradas pelo usuário.

## Fora do escopo
- Aplicar capa/watermark a outros exports (peças/DOCX): esta iteração é só o PDF de propostas. O endpoint suporta os campos, então outras telas podem adotar depois sem mudanças de infra.
