# Painel de consumo de IA (tokens + custo mensal)

## Objetivo
Registrar cada chamada de IA (chat, embeddings, visão) com tokens e custo estimado, e mostrar num painel mensal com totais do workspace e quebra por usuário/modelo.

## 1. Registro de uso (backend)

**Nova tabela `ai_usage_events`** (migration):

| coluna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → auth.users | quem chamou |
| feature | text | `chat`, `chat_stream`, `embeddings`, `vision_ocr`, `rerank`, `rewrite`, `tools_petition`, etc. |
| model | text | ex.: `google/gemini-2.5-flash` |
| prompt_tokens | int | |
| completion_tokens | int | |
| total_tokens | int | (gerado) |
| cost_usd | numeric(12,6) | calculado a partir da tabela de preços |
| cost_credits | numeric(12,4) | opcional, quando o gateway devolver |
| gateway_run_id | text | header `X-Lovable-AIG-Run-ID` |
| case_id / thread_id | uuid nullable | contexto |
| created_at | timestamptz default now() |

- RLS: dono lê o próprio; office_admin/platform_admin veem tudo.
- Grants `authenticated` + `service_role`.
- Índices: `(created_at desc)`, `(user_id, created_at desc)`, `(model, created_at desc)`.

**Instrumentação em `src/lib/ai.server.ts`**
- `chatComplete`, `chatCompleteStream`, `embedTexts`, `visionExtractPdf` já recebem a resposta do gateway. Ler `json.usage` (SSE: último chunk com `usage` quando disponível; fallback: soma dos deltas ou 0).
- Novo helper `logAiUsage({ userId, feature, model, usage, gatewayRunId, caseId, threadId })` que insere via `supabaseAdmin` no `ai_usage_events`.
- Novo helper `estimateCostUsd(model, promptTokens, completionTokens)` com tabela estática de preços (`src/lib/ai-pricing.ts`) — Gemini Flash, Flash Lite, Pro, GPT-5 mini/nano, embeddings 3-small. Preços atualizáveis num único arquivo.
- Cada função de IA passa a receber `userId` (opcional para calls internas) e chama `logAiUsage` após sucesso. Falha no log não bloqueia a resposta (try/catch silencioso + `console.warn`).
- Propagar `userId` a partir de `chat-rag.server.ts`, `route-auth.server.ts`, `/api/tools/*.ts` e `/api/chat/stream.ts`.

## 2. Server functions de leitura (`src/lib/usage.functions.ts`)

Todas com `requireSupabaseAuth` + `requireCapability('view_usage_panel')` (nova capability, default ligada para `office_admin` e `platform_admin`).

- `getUsageSummary({ month })` → totais do mês (tokens in/out, custo USD, nº chamadas), variação vs mês anterior, série diária.
- `getUsageByUser({ month })` → linha por usuário (nome, email, tokens, custo, calls).
- `getUsageByModel({ month })` → linha por modelo.
- `getUsageByFeature({ month })` → linha por feature.
- `listUsageEvents({ month, userId?, model?, limit, offset })` → paginação para drill-down.

`month` = `YYYY-MM`; default = mês corrente do fuso do servidor.

## 3. UI do painel

**Nova rota** `src/routes/_authenticated/configuracoes/consumo.tsx` (link no menu Configurações, visível só com `view_usage_panel`).

Layout "Minimal Editorial":
- Header com título + seletor de mês (dropdown com últimos 12 meses).
- 4 KPIs no topo: total de chamadas, tokens (in / out), custo estimado (USD), custo médio por chamada. Cada card mostra delta vs mês anterior.
- Gráfico de linha diária (Recharts) — custo por dia no mês.
- Duas tabelas lado a lado (grid `md:grid-cols-2`):
  - **Por usuário**: avatar + nome, calls, tokens, custo, barra proporcional.
  - **Por modelo**: modelo, calls, tokens, custo.
- Tabela expansível "Por feature" abaixo.
- Botão "Exportar CSV" (client-side a partir dos dados carregados).

Estados: skeleton no carregamento, empty state "Sem consumo neste mês".

## 4. Preços (arquivo único `src/lib/ai-pricing.ts`)

```
gemini-2.5-flash:       in $0.30 / out $2.50 por 1M
gemini-2.5-flash-lite:  in $0.10 / out $0.40 por 1M
gemini-2.5-pro:         in $1.25 / out $10.00 por 1M
gemini-3-flash-preview: in $0.30 / out $2.50 por 1M
gpt-5-nano:             in $0.05 / out $0.40 por 1M
text-embedding-3-small: in $0.02 por 1M
```

Fallback para modelo desconhecido: registra tokens, custo 0 e loga aviso.

## 5. Detalhes técnicos

- Streaming SSE: pedir `stream_options: { include_usage: true }` no body do gateway pra receber o chunk final com `usage`.
- Embeddings retornam `usage.prompt_tokens` — soma pelos batches.
- Vision OCR: usa mesma rota de chat, já vem `usage`.
- Índice `(created_at, user_id)` para agregações mensais rápidas via SQL (`date_trunc('day', created_at)`).
- Timezone das agregações: `America/Sao_Paulo` (parametrizável).
- Todos os selects agregados via RPC SQL functions (uma por consulta) para evitar N+1 e respeitar RLS via `security definer` + checagem de capability dentro da função.

## Fora do escopo desta entrega
- Alertas de gasto / limites (pode ser um follow-up).
- Faturamento por cliente (`customer_accounts`).
- Preços em BRL — só USD nesta versão; conversão fica pra depois.
