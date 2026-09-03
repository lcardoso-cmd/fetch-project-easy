# Revisão técnica incremental do RAG do JurisMind

## Diagnóstico do fluxo atual (verificado no código)

Fluxo hoje: upload (`upload-dialog.tsx`) → registro em `documents` → `indexDocument` (`src/lib/rag.functions.ts`) baixa do storage, extrai (unpdf para PDF, mammoth para DOCX, `blob.text()` para todo o resto), detecta PDF escaneado e chama `visionExtractPdf` com o PDF inteiro em uma única requisição → `chunkText` → `embedTexts` (`openai/text-embedding-3-small`) → apaga e regrava `document_chunks` → `processing_status = ready`. Consulta: `prepareRagRun` (`src/lib/chat-rag.server.ts`) → `rewriteQuery` nos tiers `balanced`/`max` → `hybrid_search_chunks` (vetorial + FTS português + RRF) → `rerankChunks` → contexto numerado → resposta (bloqueante em `chat.functions.ts` ou SSE em `api/chat/stream.ts`) → citações → persistência em `ai_chat_messages`.

Problemas confirmados por leitura do código:

- Tipos aceitos no upload incluem XLSX, CSV, PNG e JPG, mas o indexador só tem parser real para PDF e DOCX; os demais caem em `blob.text()`. `xlsx` já está no `package.json` e não é usado na indexação.
- `chunkText` faz `text.replace(/\s+/g, " ")` e corta em 1.800 caracteres: destrói parágrafos, páginas, títulos, cláusulas e tabelas.
- OCR envia o PDF completo de uma vez (limite defensivo de 18MB), sem página/lote nem retentativa parcial; risco de duplicar texto normal + texto de visão.
- `chunks` não guardam página, seção, planilha, linhas, versão de parser/chunking nem modelo de embedding.
- `rewriteQuery` devolve `keywords`, mas o fluxo usa apenas `queries`.
- `rerankChunks` avalia só os 400 primeiros caracteres e não recebe documento/página.
- Citações são os trechos recuperados, não os efetivamente citados; a UI (`chat-panel.tsx` e `jurismind-chat.tsx`) exibe `Math.round(similarity * 100)` como se fosse confiança.
- Sem camada de suficiência documental: sempre entrega os melhores trechos, mesmo com relação fraca.
- Resumo do caso (`chat.functions.ts`) usa `.limit(40)` chunks e corta o agregado em 30.000 caracteres.
- Acesso: filtros `.eq("user_id", userId)` em casos, documentos e nas RPCs impedem membros com acesso compartilhado (`user_can_access_case` já existe e não é usada no RAG).
- Indexação é síncrona dentro do fluxo de upload, sem estados por etapa, retomada ou idempotência.

## Ordem de execução (checkpoint ao fim de cada fase)

### Fase 1 — Base de avaliação (nenhuma mudança de comportamento)
- Fixtures jurídicas sintéticas (contrato com cláusulas numeradas, petição com páginas, planilha de valores, imagem com texto, dois documentos contraditórios, informação ausente de propósito) e perguntas com resposta conhecida.
- Harness de benchmark em Vitest medindo Recall@K, MRR, precisão de fontes, cobertura de citações, referências inexistentes, detecção de ausência de evidência, latência, tokens e custo.
- Log técnico de recuperação (`rag_retrieval_events`) e medição da implementação atual como linha de base registrada.

### Fase 2 — Ingestão e metadados
- Parsers explícitos: PDF por página (sem `mergePages`), OCR por página/lote com retentativa apenas das páginas falhas, DOCX com estrutura (títulos, listas, tabelas), XLSX/XLS via `xlsx` preservando planilha/cabeçalhos/intervalo de linhas, CSV/TXT com detecção de codificação e cabeçalhos, PNG/JPG por visão. Formatos que não puderem ser processados passam a ser bloqueados no upload com mensagem clara.
- Migration incremental em `document_chunks`: `page_start`, `page_end`, `section_title`, `sheet_name`, `row_start`, `row_end`, `parser_version`, `embedding_model`, `chunking_version`, `token_count`, `metadata` jsonb, `content_hash` — todos nuláveis, sem preencher valor inventado.
- Chunking estrutural versionado (documento → página/seção → título → parágrafo → sentença → tamanho), sem cortar palavras, com sobreposição configurável e dedupe; três perfis comparáveis (atual, estrutural menor, estrutural maior).
- Indexação resiliente: estados `uploaded`/`extracting`/`ocr_processing`/`chunking`/`embedding`/`ready`/`partial`/`error`, retentativas limitadas, retomada, idempotência e escrita dos novos chunks antes de remover os antigos.

### Fase 3 — Recuperação
- Usar `keywords` como sinal lexical adicional (nomes, datas, CNJ, valores, artigos), mantendo sempre a pergunta original e deduplicando consultas.
- Busca híbrida aprimorada com filtro obrigatório por caso e documentos selecionados, diversidade entre documentos, expansão de vizinhos (anterior/seguinte marcados como contexto, não evidência) e dedupe de sobreposições.
- Reranker recebendo id estável, nome do arquivo, página/seção, trecho suficiente e marcação principal/contexto, com saída validada e ordenação determinística de fallback registrada em log.
- Camada de suficiência documental com três estados (suficiente, parcial, sem evidência) e limites configuráveis/versionados, calibrados pelos scores observados no benchmark — sem limite arbitrário fixado agora.

### Fase 4 — Rastreabilidade
- Separar `retrieved_sources`, `cited_sources` e `supporting_sources`, com identificadores estáveis `[F1]`, `[F2]`… exigidos pelo prompt e validados após a geração (referências inexistentes rejeitadas).
- Cada fonte carrega `document_id`, `filename`, `chunk_id`, `snippet`, página/seção, `source_kind` e scores; UI passa a abrir o trecho com contexto e link para o documento.
- Remover o percentual: nada de `similarity * 100` como confiança; score bruto só em modo diagnóstico para administradores.
- Prompt de resposta reforçado (fato vs. análise, citação junto da afirmação, contradições, limitações do acervo) sem impor estrutura rígida em respostas simples.
- Persistir citações completas no histórico, com versão de indexador/recuperação, sinalizando quando o documento foi reindexado depois da conversa.

### Fase 5 — Segurança e resumo
- Trocar `.eq("user_id", …)` por validação de acesso efetivo ao caso via `user_can_access_case`/RLS, sempre derivando o usuário do token, sem ampliar acesso; testes para proprietário, membro autorizado, membro sem acesso e usuário externo.
- Resumo hierárquico do caso: resumo por documento → consolidação, com fontes registradas, documentos não processados declarados, limite de custo e cancelamento preservados.

### Fase 6 — Comparação
- Rodar o benchmark antes/depois, publicar ganhos, perdas, latência, tokens e custo, e só então promover a nova pipeline a padrão (flag de versão de recuperação permite rollback).

## Detalhes técnicos

- Modelo e dimensão de embedding permanecem `openai/text-embedding-3-small`; a coluna `embedding_model` cria a abstração de versão para comparações futuras sem misturar vetores.
- Migrations aditivas e reversíveis; nenhuma coluna existente é removida. `hybrid_search_chunks` ganha uma nova versão (parâmetros de vizinhos/diversidade) mantendo a assinatura atual até a promoção.
- Build, testes e verificação de tipos ao fim de cada fase.
- Logs técnicos guardam métricas e identificadores, nunca o conteúdo integral dos documentos.
- Entregáveis finais: diagnóstico, arquivos alterados, migrations, arquitetura, testes, benchmark antes/depois, impacto de latência e custo, limitações remanescentes, plano de reindexação e mecanismo de rollback. Nenhuma afirmação de ganho de precisão sem número medido.
