# Texto primeiro, leitura de imagens sob pedido

Hoje a leitura de um processo grande pode parar para "ler imagens" (OCR), que é a etapa mais lenta e caramente a que mais trava a fila. O objetivo: todo documento fica pronto e pesquisável rapidamente com o texto real que ele já tem, e a leitura de imagens passa a ser um pedido seu, página a página, nunca um bloqueio automático.

## O que muda para você

1. Todo documento termina primeiro a leitura de texto, do começo ao fim, sem interrupção.
2. Páginas com muito texto e um carimbo, selo ou logo continuam sendo tratadas como texto — nunca vão para leitura de imagem.
3. Quando sobrarem páginas que são realmente só imagem, o documento fica marcado como **Pronto (texto)** e mostra um resumo, por exemplo: "185 páginas lidas como texto · 6 páginas são imagem".
4. Ao lado do resumo aparece o botão **Ler as 6 páginas em imagem**, com confirmação. Só então a leitura de imagem roda — e só naquelas páginas, sem parar os outros documentos da fila.
5. Se a leitura de imagem falhar ou for cancelada, o texto já lido permanece intacto e pesquisável.

## Critério para classificar uma página

Uma página só entra na lista de "imagem" quando não tem praticamente nenhum texto próprio: menos de um punhado de caracteres reais na camada de texto. Presença de imagem grande deixa de ser motivo suficiente por si só — muita peça judicial tem digitalização de fundo por cima de texto perfeitamente legível. Páginas em branco continuam sendo ignoradas, sem gastar processamento.

## Detalhes técnicos

- `src/lib/rag/pdf-text-quality.ts`: reescrever `decidePdfPageReadMode` para que "ocr" exija ausência efetiva de camada textual (limiar baixo de caracteres alfanuméricos), removendo a regra de cobertura raster como gatilho isolado; manter "blank" para página sem texto e sem raster. Atualizar `pdf-text-quality.test.ts` com casos de texto + carimbo, texto + digitalização de fundo, e página escaneada real.
- `src/lib/rag/index-document.server.ts`: na etapa final, deixar de disparar OCR automaticamente. As páginas fracas remanescentes vão para `ocr_skipped_pages`/`pending_image_pages` no progresso do job, e o documento é finalizado com status parcial "pronto (texto)". OCR continua executando apenas quando `params.forceVision` (ou uma nova lista `visionPages`) chegar pelo pedido explícito do usuário — reaproveitando o checkpoint já existente.
- `src/lib/index-jobs.functions.ts`: expor no retorno as contagens `text_pages`, `image_pages` e a lista de páginas pendentes; adicionar/ajustar a função de reprocessamento para aceitar "ler apenas as páginas em imagem".
- `src/components/documents/document-list.tsx`: exibir o resumo por documento e o botão de leitura de imagens usando o `ConfirmActionButton` já existente, desabilitado enquanto o documento estiver processando.
- Fila: nenhuma mudança na serialização por organização já aplicada; sem OCR automático, cada parte termina bem antes do orçamento de tempo e a fila avança sozinha.
- Validação: `tsgo --noEmit`, testes focados de `pdf-text-quality`, `pdf-range`, `ocr` e retomada, e consulta ao banco para confirmar que a parte 1 do processo em fila conclui e a parte 2 inicia.
