# Divisão automática de documentos gigantes em partes

## Resposta direta antes do plano

Sim, dá para fazer — e sem o usuário mexer em nada. Mas preciso ser honesto sobre **onde** a divisão pode acontecer, porque isso decide se a coisa é 100% confiável ou não:

- **No navegador, no momento do envio: 100% garantido.** O navegador tem memória de sobra para abrir um PDF de 4.000 páginas, cortá-lo em partes e enviar cada parte. O usuário continua arrastando **um** arquivo; o sistema faz o corte sozinho, sem pedir nada.
- **No servidor, para arquivos gigantes já enviados: não é garantido.** O servidor que processa documentos tem um teto rígido de memória e de tempo por execução. Abrir um arquivo de 156 MB inteiro ali é exatamente a causa dos documentos que hoje ficam presos em "Lendo imagens (OCR)". Nesse caso não vou prometer corte real do arquivo: vou entregar **leitura por faixas de páginas** (parte 1 = páginas 1–40, parte 2 = 41–80…), que já é possível hoje sem abrir o arquivo todo, e que resolve o travamento para PDFs com texto.

Ou seja: o corte de verdade acontece na entrada (todo arquivo novo), e o que já está na biblioteca passa a ser processado em partes por faixa de páginas.

## O que o usuário vai ver

1. Arrasta um PDF de 4.000 páginas como sempre.
2. A janela de envio mostra: "Documento grande — dividindo em 100 partes de 40 páginas" e uma barra única de progresso.
3. Na lista de documentos aparece **um** documento ("Petição inicial — 4.000 páginas"), com um indicador "12 de 100 partes prontas". Quem quiser abre e vê cada parte com seu próprio estado e botão "Processar agora"/"Tentar de novo".
4. A IA responde citando a página original (página 3.812), não "parte 96, página 12".
5. Uma parte que falha não derruba o documento: as outras 99 continuam pesquisáveis.

## Como fica tecnicamente

**Divisão no envio (caminho principal)**
- Nova rotina de divisão executada em um Web Worker do navegador, usando `pdf-lib` (já instalado), acionada automaticamente pelo gerenciador de envios (`src/components/documents/upload-manager.tsx`) quando o PDF passa de um limite de páginas/tamanho (padrão: acima de 60 páginas ou 25 MB).
- Cada parte é salva como um documento real no Storage, com `parent_document_id`, `part_index`, `part_count`, `page_offset` e o nome original preservado.
- Falha na divisão (PDF cifrado, corrompido, sem camada de páginas legível) cai automaticamente no envio inteiro atual — nada regride.

**Documento-pai e partes**
- Migração: colunas `parent_document_id`, `part_index`, `part_count`, `page_offset`, `page_count` em `documents`, com índice por pai, GRANTs e políticas RLS por organização iguais às atuais.
- Listagem e busca passam a agrupar partes sob o pai; contagens e permissões continuam por organização.

**Processamento**
- Cada parte entra na fila existente (`document_index_jobs`) como um trabalho independente, então cabe folgado no orçamento de tempo do processador.
- Ao gravar trechos no índice, a página é somada ao `page_offset` da parte, para as citações apontarem a página do documento original.
- O painel de estados (`document-list.tsx` + `index-jobs.functions.ts`) ganha a visão por partes: posição na fila, estágio, tentativas e reprocessamento por parte ou do documento inteiro.

**Arquivos já enviados**
- Para PDFs já na biblioteca, o indexador passa a planejar faixas de páginas por leitura remota (`src/lib/rag/pdf-range.server.ts`) em vez de baixar tudo (`indexDocumentCore` hoje faz `storage.download` do arquivo inteiro — origem do travamento). Cada faixa é um trabalho da fila.
- Limite honesto: para essas faixas, páginas **sem texto** (digitalizadas) só podem ir para OCR se o arquivo couber em memória no servidor (teto seguro ~60 MB). Acima disso o documento é marcado como "precisa ser reenviado para divisão", com um botão que reaproveita o caminho de envio do navegador. Não vou fingir que o OCR de um PDF digitalizado de 156 MB já enviado funciona sem isso.

## Fora de escopo

Sidebar, permissões, cobrança, CRM, criação de casos e comunicação interna não são tocados.

## Verificação antes de eu dizer "pronto"

- Teste real de ponta a ponta com um PDF grande: divisão, envio das partes, fila, índice e citação com número de página original conferido.
- Testes automatizados da divisão (limites, offset de páginas, PDF de 1 página, PDF cifrado) e do planejamento de faixas.
- Verificação de tipos e a suíte completa de testes.
- Capturas de tela do envio dividido e da lista com partes, no desktop e no celular.
