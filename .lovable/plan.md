# Concluir a divisão automática de documentos gigantes

A divisão já funciona no envio: PDFs longos são partidos em partes reais no navegador (padrão 200 páginas, com opção 100/500/não dividir), cada parte é registrada com sua faixa de páginas e a lista do caso já mostra "Parte 2 de 5 · páginas 201–400". Faltam quatro acabamentos para a funcionalidade ficar confiável de ponta a ponta.

## O que falta fazer

1. **Citações com a página certa do documento original**
   Hoje uma citação de uma parte aponta para a página dentro daquela parte (ex.: página 12), não para a página real do processo (ex.: página 412). Vou somar o deslocamento da parte ao gravar cada trecho, para que toda referência mostrada no chat e nos materiais aponte à página verdadeira do documento completo.

2. **Substituição de arquivo respeitando a escolha de divisão**
   Ao substituir um documento existente, hoje o envio nunca divide. Vou fazer a substituição usar a mesma preferência escolhida no envio.

3. **Falha na divisão deixa de ser silenciosa**
   Se o navegador não conseguir dividir (arquivo protegido, memória insuficiente), hoje ele tenta enviar o arquivo inteiro sem avisar — que é justamente o caso que costuma travar. Vou avisar em tela, explicar o motivo e deixar o envio inteiro como escolha explícita do usuário.

4. **Validação real no navegador**
   Vou executar o envio de verdade num navegador de teste com um PDF longo, acompanhar a divisão, o envio das partes, o processamento de cada uma e as citações resultantes, com capturas de tela. Só depois disso eu afirmo que está garantido.

## Fora do escopo

Sidebar, permissões, cobrança, CRM, criação de casos e comunicação interna não são tocados.

## Detalhes técnicos

- `src/lib/rag/index-document.server.ts`: aplicar `page_offset` do documento em `page_start`/`page_end` ao inserir chunks; ler o offset junto do registro do documento.
- `src/components/documents/upload-manager.tsx`: propagar `maxPartPages` no fluxo de `confirmReplace`; substituir o fallback silencioso de `expandEntry` por estado de erro no item com ação "Enviar mesmo assim".
- `src/components/documents/upload-progress-list.tsx`: exibir o novo estado de falha de divisão e a ação de confirmação.
- Verificação: `tsgo --noEmit`, `vitest run` (109 testes atuais + casos novos de offset de página) e um roteiro Playwright autenticado com PDF longo sintético, salvando capturas em `/tmp/browser/`.
