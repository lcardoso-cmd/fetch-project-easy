# Fila que vai até o fim + catálogo das páginas em imagem

Duas entregas independentes, na ordem abaixo.

## 1. A leitura vai sozinha até o fim

Hoje a leitura de um documento avança em etapas com ponto de retomada salvo, mas quando a rodada termina e ainda falta trabalho ninguém acorda o processador de novo. Resultado: o documento fica parado depois da etapa de texto e você precisa apertar "Processar agora" para ele fechar.

O que muda para você:

1. Ao terminar cada etapa, a leitura continua automaticamente da próxima, sem nenhum clique.
2. Um documento por vez, do começo ao fim, e só depois o próximo da fila (mantido como está hoje).
3. Se algo parar de verdade (erro, arquivo grande, IA bloqueada), o documento mostra o motivo e o botão de tentar de novo — nunca fica "em silêncio".
4. Uma verificação periódica recolhe qualquer trabalho esquecido e o coloca de volta na fila.

## 2. Catálogo das páginas em imagem

Páginas que são só imagem (nota fiscal, cartão de ponto, carimbo, assinatura, foto) deixam de ser um beco sem saída.

1. Depois de terminar a leitura de texto, e em segundo plano, o sistema gera uma frase curta descrevendo cada página em imagem — sem transcrever tudo, então é rápido e barato.
2. O documento passa a mostrar um catálogo: "p. 42 — cartão de ponto assinado", "p. 87 — nota fiscal de serviço", com a página clicável para abrir o arquivo naquele ponto.
3. Nas respostas do JurisMind, quando a pergunta tem relação com esse conteúdo, ele avisa: "há 6 páginas em imagem que podem conter isso — p. 42, 87, 91" e oferece a leitura completa dessas páginas sob pedido.
4. A leitura completa (OCR) continua sendo só quando você pede, página a página, como já é hoje.
5. Se a descrição falhar, o documento continua pronto e pesquisável pelo texto.

## Detalhes técnicos

Fila:
- `src/lib/jobs/worker.server.ts`: ao final de `runDocumentQueues`, quando `remaining && !halted`, agendar continuação via `getWorkerExecutionContext().waitUntil` com cooldown curto e orçamento de profundidade, em vez de depender do hop HTTP de `/api/public/jobs/run` (que hoje exige `JOBS_WORKER_SECRET` e retorna 401 quando o segredo não está configurado). Manter limite de rodadas, single-flight por organização (`claim_index_jobs`) e parada em `halted`.
- `src/routes/api/public/jobs/run.ts`: manter como porta do cron; se o segredo não existir, o endpoint continua 401 mas a fila não depende mais dele.
- `nitro.config.ts` / `server/tasks/documents/process-queues.ts`: reduzir o intervalo do cron para recolher jobs `queued` sem lock (rede de segurança) e reenfileirar `running` com heartbeat velho.
- `src/lib/index-jobs.functions.ts`: no polling de status, quando houver job `queued` sem lock há mais de N segundos, chamar `kickDocumentWorker` (já existe padrão semelhante).

Catálogo de imagens:
- Migration: `public.document_image_pages` (`id`, `organization_id`, `case_id`, `document_id`, `page_number`, `page_local`, `label`, `description`, `created_at`), única em (`document_id`, `page_number`), com `GRANT` para `authenticated`/`service_role`, RLS espelhando as políticas de `document_chunks` (acesso pelo caso/organização) e escrita apenas por `service_role`.
- Novo passo no worker, depois de `indexDocumentCore` concluir com `pending_image_pages`: fase `describing_images`, lotes de ~6 páginas por chamada, miniaturas em baixa resolução, modelo multimodal barato do gateway, respeitando `deadlineAt` e o checkpoint (`resume_progress.image_pages_done`). `402/403` pausam; `429/5xx` com backoff, reaproveitando `src/lib/rag/step-retry.ts`.
- `src/lib/rag/index-document.server.ts`: expor `pending_image_pages` já existente como entrada dessa fase; inserir também um chunk leve por página descrita (`source_kind: "image_summary"`) para que a busca híbrida encontre a página pela descrição, marcado como não-transcrito.
- `src/lib/chat-db-tools.server.ts`: nova ferramenta `list_image_pages(case_id, document_id?)` e menção obrigatória no prompt quando a resposta depender de páginas em imagem, com sugestão de leitura sob pedido.
- `src/lib/chat-rag.server.ts` / `src/components/chat/sources-block.tsx`: citações de `image_summary` sinalizadas como descrição (não transcrição), abrindo o PDF na página.
- `src/components/documents/document-list.tsx`: no documento, seção expansível "Páginas em imagem (N)" listando página + descrição, cada linha abrindo o `DocumentPreviewDialog` na página, com o botão já existente de leitura completa.
- Validação: `bunx tsgo --noEmit`, testes focados de `pdf-text-quality`, `ocr` e retomada, mais uma execução real de fila confirmando que a parte 1 conclui e a parte 2 inicia sem clique manual.
