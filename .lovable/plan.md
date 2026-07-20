
# Monitoramento de Publicações Judiciais

Transformar `/publicacoes` (hoje "Em breve") num radar de publicações oficiais por OAB, nome do advogado, nome da parte ou número CNJ. Fontes escalonadas: começa gratuita e só cai para paga se necessário.

## Visão do usuário

1. **Termos monitorados** — tela nova em `/publicacoes/termos` para cadastrar o que rastrear:
   - OAB (número + UF)
   - Nome do advogado
   - Nome da parte/cliente
   - Número CNJ do processo
   Cada termo tem: rótulo, tipo, ativo/pausado, advogado responsável, prioridade e ligação opcional a um caso.

2. **Feed em `/publicacoes`** — lista cronológica com filtros por termo, tribunal, período, status (nova / lida / arquivada), busca textual e "vinculada a caso X". Cada card mostra data da publicação, tribunal/órgão, trecho destacado, termo que casou e ações (marcar lida, criar tarefa, vincular a caso, arquivar, abrir original).

3. **Detalhe da publicação** — modal/side-panel com texto completo, metadados, histórico de vinculações e botão "Gerar minuta de resposta" (usa o editor de propostas existente com o texto como contexto).

4. **Vinculação automática ao caso** — quando o CNJ da publicação bate com `cases.processo_numero` do mesmo tenant, vincula sozinho e cria uma tarefa no Kanban com prazo sugerido (padrão 5 dias corridos, configurável por termo).

5. **Notificação** — resumo diário por e-mail (07h America/Sao_Paulo) para cada advogado responsável, listando publicações novas do dia anterior. Toast + badge no menu lateral quando houver não-lidas.

6. **Sob demanda** — botão "Buscar agora" no topo do feed dispara o mesmo pipeline para os termos ativos do usuário (com throttle de 5 min por termo para não estourar cotas).

## Fonte de dados escalonada

Cada busca por termo tenta as fontes na ordem, parando na primeira que retornar sucesso com resultados:

```text
1. DJEN (CNJ)   → API pública /api/v1/comunicacao — grátis, cobre a maioria
                  dos tribunais estaduais/federais integrados ao DJEN.
2. Firecrawl    → scrape/search direcionado aos DJEs dos tribunais que
                  faltam (ex.: TJSP e-SAJ), usando conector já ligado.
3. Codilo/Judit → chamada paga, ativada só quando o termo tem flag
                  `use_paid_fallback = true` e as duas anteriores vieram
                  vazias há N dias (padrão 2).
```

Cada tentativa vira uma linha em `publication_fetch_log` com fonte, status HTTP, latência, resultados e custo estimado — assim dá pra ver na tela de consumo qual fonte está pesando.

## Modelo de dados

Migração nova (com GRANTs + RLS por `auth.uid()`, seguindo o padrão do projeto):

- `monitoring_terms(id, user_id, customer_account_id, kind [oab|advogado|parte|cnj], value, uf, label, case_id?, responsible_user_id?, active, use_paid_fallback, deadline_days default 5, created_at, updated_at)`
- `publications(id, user_id, customer_account_id, source [djen|firecrawl|codilo], external_id, tribunal, orgao, publication_date, captured_at, cnj?, content, snippet, url_original, hash unique per user, status [new|read|archived], case_id?, task_id?, created_at)` — índice único `(user_id, hash)` para deduplicar re-fetch.
- `publication_term_matches(publication_id, term_id, matched_field, matched_snippet)` — muitos-para-muitos.
- `publication_fetch_log(id, user_id, term_id, source, ok, http_status, latency_ms, results_count, error, cost_usd, created_at)`.

Todas RLS por `user_id = auth.uid()`; `service_role` com acesso total pra cron/hook.

## Server functions (`createServerFn`, auth por `requireSupabaseAuth`)

- `listTerms`, `upsertTerm`, `deleteTerm`
- `listPublications({ filters, cursor })` com paginação
- `updatePublication({ id, status | case_id | task_id })`
- `runFetchNow({ termIds? })` — dispara o pipeline pros termos do usuário (throttle 5 min)
- `createTaskFromPublication({ publicationId, dueDate, assignee })`

## Pipeline server-side

`src/lib/publications/`:

- `sources/djen.ts` — cliente REST do DJEN CNJ, normaliza pro shape interno.
- `sources/firecrawl.ts` — usa gateway Firecrawl já conectado, faz `search` restrito ao domínio do DJE relevante por UF.
- `sources/codilo.ts` — placeholder atrás de `CODILO_API_KEY` (só ativa quando o segredo existir; pedimos depois se o usuário quiser habilitar).
- `pipeline.ts` — orquestra escalonamento, dedup por hash SHA-256 do `(tribunal|data|conteúdo)`, gravação em `publications` + `publication_term_matches`, auto-vinculação a `cases` por CNJ, criação da tarefa e enfileiramento da notificação.

## Endpoints públicos (cron)

Rota nova `src/routes/api/public/hooks/fetch-publications.ts` (POST, autenticado por `apikey` = anon key, seguindo o padrão do projeto):
- Corre `pipeline.run()` para **todos** os termos ativos do sistema, particionado por `user_id`, com concorrência limitada.
- Agendado via `pg_cron` + `pg_net` 1x/dia às 06h BRT.

Rota `src/routes/api/public/hooks/publications-digest.ts` (POST):
- Monta e envia o e-mail-resumo por advogado responsável (usa infra de e-mail já configurada; se ainda não estiver, o próprio passo pede pro usuário rodar o setup de domínio).
- Agendado 07h BRT.

## UI nova

- `src/routes/_authenticated/publicacoes.tsx` — substituído por feed real com filtros, `useSuspenseQuery`, paginação e detalhe em `Sheet`.
- `src/routes/_authenticated/publicacoes.termos.tsx` — CRUD de termos.
- `src/components/publications/PublicationCard.tsx`, `PublicationDetailSheet.tsx`, `TermForm.tsx`, `RunNowButton.tsx`.
- Badge de não-lidas no `AppSidebar` (query leve com `count`).

## Testes

- `pipeline.test.ts` cobre: dedup por hash, escalonamento (mock DJEN vazio → Firecrawl responde), auto-vinculação por CNJ, throttle de "Buscar agora".
- `sources/djen.test.ts` valida parser com fixture real.

## Fora do escopo desta entrega

- Assinatura de PJe/e-SAJ com certificado A1/A3 (exigiria upload de certificado e biblioteca de assinatura — feature separada).
- OCR de peças anexas às publicações.
- Ativação real da fonte paga: código fica pronto atrás de flag; a chave (`CODILO_API_KEY` ou equivalente) é pedida ao usuário só se/quando ele quiser ligar.

## Perguntas que resolvo durante a implementação

- Fuso do digest: assumindo `America/Sao_Paulo`; ajustável por usuário depois.
- Prazo default da tarefa: 5 dias corridos; cada termo pode sobrescrever.
- Retenção de publicações lidas: mantido indefinidamente; arquivamento é ação manual.

