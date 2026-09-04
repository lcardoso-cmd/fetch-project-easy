# Corrigir a leitura de documentos grandes (erro "Memory limit")

## O que está acontecendo (confirmado nos dados)

Os três arquivos do processo têm 156 MB, 91 MB e 52 MB. A leitura para busca por IA (indexação) baixa o arquivo **inteiro** para a memória do servidor antes de ler. Acima de ~100 MB o servidor é cortado no meio e devolve "Memory limit would be exceeded before EOF" — daí o erro interno e as 3 tentativas falhando.

Registros atuais:
- 156 MB: erro definitivo, 3 tentativas, mensagem de memória
- 91 MB: preso em "lendo" desde 20:16
- 52 MB: parado em "Na fila", porque a fila trava no anterior

A tela de "Novo caso" já usa leitura por partes do arquivo (não baixa tudo); a indexação ainda não. É essa diferença que causa a falha.

## O que vai mudar

1. **Ler o PDF por partes na indexação**, como já é feito no Novo caso: o servidor pede só os pedaços de que precisa, página a página, sem nunca carregar o arquivo todo. Isso resolve o erro dos 156 MB.
2. **Processar em blocos de páginas** (ex.: 50 páginas por vez): gerar trechos, calcular os índices de busca e gravar antes de seguir. Assim o consumo de memória fica constante mesmo em 4.000 páginas, o progresso é real e uma interrupção não perde o que já foi lido.
3. **Reconhecimento de imagem (OCR) sem estourar memória**: montar os recortes de página a partir dos pedaços já lidos, com limite por lote. Quando um arquivo for grande demais para OCR, o documento é indexado com o texto disponível e a tela avisa claramente quais páginas ficaram sem leitura de imagem, com a opção de dividir o arquivo em partes.
4. **Erro de memória deixa de ser repetido 3 vezes**: é tratado como falha permanente, com mensagem em português explicando o motivo e o que fazer, em vez de "Falhou após 3 tentativa(s)".
5. **Destravar o que está preso agora**: recuperar o trabalho parado (91 MB), recolocar o de 156 MB na fila com o novo método e liberar a fila para o de 52 MB.
6. **Fila não trava mais em um arquivo pesado**: um documento em leitura longa não impede os outros de andarem.

## Detalhes técnicos

- `src/lib/rag/index-document.server.ts`: substituir o `storage.download()` do passo `download` por URL assinada + `openRemotePdf` (`src/lib/rag/pdf-range.server.ts`) para PDFs; manter o download direto apenas para formatos leves (DOCX/XLSX/CSV/TXT/imagem) com limite de tamanho.
- Novo laço por janelas de páginas: `pageText` → `structuredChunk` → `embedTexts` → `insert` em `document_chunks` por janela, com `chunk_index` contínuo, `onProgress` por janela e cancelamento cooperativo preservado. Remoção de trechos obsoletos apenas no fim (idempotência atual mantida).
- `src/lib/rag/ocr.server.ts`: `slicePdf` passa a receber bytes de faixas (range) por lote em vez de `bytes` do arquivo completo; `ocrPdfPages` ganha limite de páginas por execução.
- `src/lib/rag/step-retry.ts`: classificar `Memory limit would be exceeded`, `file too large` e afins como permanentes.
- `src/lib/jobs/worker.server.ts`: recuperar jobs com `locked_at` vencido, e não deixar um job pesado consumir todo o orçamento de tempo do lote.
- `src/components/documents/document-list.tsx`: mensagens de status e aviso de "páginas sem OCR" com ação de dividir em partes (reaproveita `src/lib/documents/pdf-splitter.ts`).
- Sem migração de schema; apenas atualização de status/fila dos registros travados.

## Verificação

- Reprocessar os três arquivos reais (156/91/52 MB) e confirmar conclusão sem erro de memória.
- Conferir barra de progresso avançando por janelas e cancelamento individual funcionando.
- Confirmar que a busca da IA responde citando páginas desses documentos.
