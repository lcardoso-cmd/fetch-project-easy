## Objetivo

Hoje o DOCX já é centralizado em `src/lib/docx/template.ts` (usado por proposta, petição e resumo de caso). Mas o **PDF está fragmentado em 2 implementações inconsistentes** e o PPTX repete tokens manualmente. Vou unificar tudo em um único conjunto de templates de documento, para que qualquer export (proposta, petição do chat, resumo de caso, futuros artefatos) siga a mesma identidade visual — margens, fontes, cores, cabeçalho com logo e rodapé com paginação.

## Estado atual (por que precisa)

| Superfície | DOCX | PDF |
|---|---|---|
| Proposta (`proposal.tsx`) | `/api/tools/petition` → template compartilhado ✅ | `html2pdf.js` client-side, A4 mm, **sem branding/header/footer** ❌ |
| Chat → artefato (`artifact-cards.tsx`) | `/api/tools/petition` ✅ | `/api/tools/pdf` — **PDF hand-rolled, Helvetica, 2 cm, sem branding, wrap ingênuo** ❌ |
| Resumo do caso | `exportSummaryDocx` ✅ | (não tem PDF hoje) |

Resultado: o mesmo conteúdo baixado como DOCX sai com Calibri 11pt, capa institucional, header "Proposta comercial", rodapé com nome do escritório e paginação; baixado como PDF sai como texto Helvetica sem nada disso.

## Solução

### 1. Tokens de documento compartilhados

Extrair de `src/lib/docx/template.ts` para `src/lib/documents/tokens.ts`:
- Página US Letter, margens 1" (2,54 cm) — mesmas do DOCX
- Fontes Calibri (body) / Calibri (heading), tamanhos H1/H2/H3/body/small
- Paleta (`ink`, `accent`, `muted`, `border`, `headerBand`)
- Espaçamentos entre parágrafos, listas, títulos

`template.ts` passa a importar desses tokens (não muda comportamento do DOCX).

### 2. Parser HTML/Markdown compartilhado

Extrair `htmlToBlocks` / `markdownToBlocks` / `contentToBlocks` de `pdf.ts` para `src/lib/documents/blocks.ts`, retornando uma AST comum (`DocBlock[]`) com: heading 1-3, parágrafo, lista, alinhamento, negrito/itálico/sublinhado inline. O parser HTML do DOCX (`htmlToDocxChildren`) também passa a usar essa AST — assim proposta editada no rich-text sai idêntica em PDF e DOCX.

### 3. Novo renderer PDF unificado (server, workerd-safe)

Criar `src/lib/documents/pdf-renderer.ts` que consome `DocBlock[]` + branding e produz um `Uint8Array` PDF com:
- Mesma página/margens do DOCX (US Letter 1")
- Header com logo do escritório + nome do escritório (à esquerda) e label do documento (à direita) — igual ao DOCX
- Rodapé com nome do escritório + "Página X de Y"
- Fontes Type1 padrão (Helvetica/Times) mapeadas para a família Calibri via metric-compatible fallback, mantendo os tamanhos dos tokens
- Wrap por largura real (métrica AFM embutida), não por contagem de caracteres
- Suporte a negrito/itálico inline, listas com bullet real, alinhamento por parágrafo

Continua sem dependências nativas (workerd-compat), sem `sharp`/`pdfkit-node`. Logo do escritório é lida do bucket `firm-logos` (já existe via `loadBrandingForUser`) e embutida como imagem JPEG/PNG no PDF.

### 4. Substituir os call-sites

- `/api/tools/pdf` passa a chamar `renderPdf({ title, blocks, branding, headerLabel })` — mesma assinatura da irmã DOCX.
- `proposal.tsx` **remove `html2pdf.js`** e passa a baixar via `/api/tools/pdf` (mesmo backend do chat, mesmo visual do DOCX). Simplifica o bundle e garante paridade.
- Adicionar `exportSummaryPdf` em `src/lib/export.functions.ts` reutilizando o mesmo renderer (para consistência futura no card de resumo).

### 5. PPTX (menor escopo)

`exportSummaryPptx` passa a importar cores/fontes de `documents/tokens.ts` em vez de literais duplicados. Sem mudança visual significativa, mas evita drift futuro.

## Arquivos

Novos:
- `src/lib/documents/tokens.ts` — cores, fontes, tamanhos, margens
- `src/lib/documents/blocks.ts` — AST + parser HTML/Markdown
- `src/lib/documents/pdf-renderer.ts` — renderer PDF unificado
- (opcional) `src/lib/documents/README.md` — regra "qualquer novo export usa esses módulos"

Alterados:
- `src/lib/docx/template.ts` — importa tokens/blocks compartilhados
- `src/routes/api/tools/pdf.ts` — vira wrapper fino do novo renderer
- `src/routes/_authenticated/proposal.tsx` — remove `html2pdf.js`, usa `/api/tools/pdf`
- `src/lib/export.functions.ts` — adiciona `exportSummaryPdf`; PPTX usa tokens compartilhados
- `src/components/cases/case-summary-card.tsx` — botão "Baixar PDF" ligado a `exportSummaryPdf`
- `package.json` — remover `html2pdf.js` se não houver mais uso

## Fora do escopo

- Não altero conteúdo/prompts do chat nem lógica de RAG.
- Não altero UI do editor da proposta.
- Não mudo o tema visual do app; só padroniza documentos exportados.

## Validação

1. Build passa (`tsgo`), sem imports quebrados.
2. Baixar a mesma proposta como DOCX e PDF → header/footer/margens/fontes idênticos.
3. Chat: gerar um artefato, baixar PDF e DOCX pelo `artifact-cards` → mesmo visual da proposta.
4. Card de resumo do caso: DOCX e PDF novos consistentes.
