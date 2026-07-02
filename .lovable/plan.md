# Template DOCX profissional e consistente

Hoje temos três geradores de `.docx` (proposta, petição, resumo) e cada um redefine fontes, títulos e margens à mão. O resultado varia — títulos com tamanhos diferentes, sem estilos nomeados, sem cabeçalho/rodapé, tabelas sem borda padronizada. A ideia é centralizar tudo em **um único template** e fazer os três exports consumirem-no.

## O que será criado

**`src/lib/docx/template.ts`** — módulo único (server-safe) exportando:

- `createStyledDocument({ title, subtitle?, children, meta? })` — devolve um `Document` do `docx` já configurado com estilos, cabeçalho, rodapé e margens.
- `htmlToDocxChildren(html)` — converte HTML do editor (h1/h2/h3, p, ul/ol, li, strong/em/u, alinhamento inline) em `Paragraph[]` respeitando os estilos nomeados do template. Substitui os parsers duplicados de `petition.ts` e `export.functions.ts`.
- `plainTextToDocxChildren(text)` — mantém o comportamento atual do "resumo" (seções TÍTULO:) usando os mesmos estilos.
- Helpers de tabela (`styledTable(rows)`) com bordas cinza `#CCCCCC`, cabeçalho com fundo `#0F172A`/texto branco, padding e `WidthType.DXA`.
- `TEMPLATE_COLORS`, `TEMPLATE_FONTS` para reuso.

### Especificação do template

- **Página**: US Letter (12240 × 15840 DXA), margens 1" (1440 DXA).
- **Fonte padrão**: Calibri 11pt (size 22) — universal e legível.
- **Estilos nomeados** (sobrescrevendo built-ins para funcionar no Word/Google Docs):
  - `Title` — Calibri 24pt bold, cor `#0F172A`, espaçamento 240 antes / 120 depois, alinhado à esquerda.
  - `Subtitle` — Calibri 13pt, cor `#475569`, itálico opcional.
  - `Heading1` — Calibri 16pt bold, cor `#0F172A`, `outlineLevel: 0`, borda inferior fina `#0F172A`, espaço 320/160.
  - `Heading2` — Calibri 13pt bold, cor `#1E3A8A`, `outlineLevel: 1`, 240/120.
  - `Heading3` — Calibri 11pt bold uppercase, cor `#334155`, `outlineLevel: 2`.
  - `Normal` — Calibri 11pt, line spacing 1.35, espaço depois 120.
  - `Quote` — itálico, indent esquerdo 360, cor `#475569`, borda esquerda 4pt `#0F172A`.
- **Listas**: numbering config com `bullets` (LevelFormat.BULLET, "•", indent 720/hanging 360) e `numbers` (DECIMAL) — nunca `•` manual.
- **Cabeçalho** (opcional via `meta.header`): logo textual "B2B | JurisMind AI" à esquerda, `meta.header` à direita usando tab stop RIGHT/MAX.
- **Rodapé**: "Documento gerado por B2B | JurisMind AI" à esquerda, "Página X de Y" à direita (`PageNumber.CURRENT` / `TOTAL_PAGES`), fonte 9pt cor `#64748B`, borda superior fina.
- **Meta do arquivo**: `creator`, `title`, `description` preenchidos a partir de `meta`.

## Migração dos exports existentes

1. **`src/routes/api/tools/petition.ts`** — trocar montagem manual por:
   ```ts
   const doc = createStyledDocument({
     title: titulo,
     children: html ? htmlToDocxChildren(html) : plainTextToDocxChildren(conteudo),
     meta: { header: "Petição", creator: "B2B | JurisMind AI" },
   });
   ```
   Mantém a rota, o content-type e o filename atuais.

2. **`src/lib/export.functions.ts`** → `exportSummaryDocx` passa a usar `plainTextToDocxChildren` + `createStyledDocument` com `meta.header: "Resumo do caso"`. Comportamento de seções TÍTULO: preservado, agora com estilos nomeados.

3. **`src/routes/_authenticated/proposal.tsx`** — o botão "Baixar .docx" continua chamando `/api/tools/petition` (nenhuma mudança no cliente); passa `titulo: "Proposta - <cliente>"` para virar cabeçalho.

## O que **não** muda

- Nenhuma mudança de UI, rotas, RLS ou schema.
- `html2pdf` (exportação PDF do proposal) continua igual — está fora do escopo do template `.docx`.
- Assinaturas dos server functions/rotas inalteradas — só o conteúdo do arquivo final fica mais bonito e consistente.

## Detalhes técnicos

- Módulo fica em `src/lib/docx/` (client-safe path) e é importado dinamicamente dentro dos handlers para não pesar bundle SSR.
- Usa apenas APIs que rodam no Cloudflare Worker (nada de `fs`/`sharp`). `docx` já é compatível.
- Segue as regras do skill de DOCX: `WidthType.DXA` em tabelas, `ShadingType.CLEAR`, `LevelFormat.BULLET`, `PageBreak` dentro de `Paragraph`, IDs de estilo exatos (`Heading1`, etc.), `outlineLevel` para TOC futura.
- Sem dependência nova (`docx` já instalado).

Se quiser, depois desse template posso adicionar: logo em imagem no cabeçalho, marca d'água "RASCUNHO" para versões não finalizadas, e uma variação "carta" com bloco de destinatário — mas fora do escopo desta entrega.
