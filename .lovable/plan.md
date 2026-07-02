## Objetivo

Quando um segmento de transcrição falhar por causa transitória (rede caindo, 429 rate-limit, 5xx do gateway), o chat tenta novamente sozinho com backoff exponencial e teto de tentativas — sem exigir clique manual em "Tentar novamente".

## Escopo

Somente `src/components/chat/jurismind-chat.tsx`. Nenhuma mudança de backend, banco ou UI de outras telas.

## Comportamento

**Erros que disparam retry automático** (transitórios):
- Falha de rede (`fetch` rejeita, sem `res.status`)
- HTTP 429 (rate-limit)
- HTTP 408 / 425 / 500 / 502 / 503 / 504
- Timeout do próprio segmento (novo, ver abaixo)

**Erros que NÃO disparam retry** (mostram banner imediato como hoje):
- 401 / 403 (sessão)
- 402 (créditos)
- 413 (áudio grande)
- 400 (payload inválido)
- `AbortError` por cancelamento explícito do usuário (parar gravação, novo segmento)

**Política de backoff**:
- Máx. 3 tentativas por segmento
- Delays: 500 ms → 1200 ms → 2500 ms (com jitter ±20%)
- Respeita `Retry-After` do servidor quando presente (usa o maior entre header e delay calculado)
- Cada tentativa cria novo `AbortController`; um `abort` externo (usuário parou / novo segmento) interrompe imediatamente e não conta como falha para retry

**Segmentos parciais (durante gravação)**:
- Retry silencioso em background (não mostra toast/banner nas tentativas intermediárias)
- Se todas falharem, apenas incrementa um contador interno; só marca `micError` se **2 segmentos consecutivos** esgotarem retries (evita banner por soluço momentâneo)

**Segmento final (`final=true`, ao parar)**:
- Retry visível: mostra pequeno indicador "Reprocessando… (tentativa 2/3)" na mesma área de status
- Se esgotar, mantém banner atual com "Tentar novamente" manual como fallback

**Cancelamento pelo usuário**:
- Botão "Cancelar" existente e parar gravação abortam a cadeia de retries em curso
- Um novo segmento também aborta retries pendentes do anterior

## Implementação técnica

1. Novo helper `fetchTranscribeWithRetry(body, { signal, final, onAttempt })` dentro do componente:
   - encapsula o `fetch` + parse SSE hoje inline em `flushSegment`
   - loop `for (let attempt = 1; attempt <= 3; attempt++)`
   - classifica erro via helper `isRetryableTranscribeError(status | error)`
   - `await sleepWithAbort(delay, signal)` entre tentativas
2. Refatorar `flushSegment` para delegar rede/parse ao helper e manter apenas a lógica de partial/committed.
3. Novo estado `retryInfo: { attempt: number; max: number } | null` para o indicador visível no flush final. Renderizar dentro do bloco de status existente (linhas ~1750), sem novos componentes.
4. Ref `consecutiveSegmentFailuresRef` para a regra de 2-strikes em parciais.
5. Constantes no topo do módulo: `TRANSCRIBE_MAX_ATTEMPTS = 3`, `TRANSCRIBE_BACKOFF_MS = [500, 1200, 2500]`, `SEGMENT_TIMEOUT_MS = 15000`.
6. Timeout por tentativa: `AbortController` interno + `setTimeout` que aborta; combinado com o signal externo via helper simples.

## Fora do escopo

- Retry no endpoint SSE do chat (`/api/chat/stream`) — só transcrição.
- Persistência de tentativas.
- Retry para erros de permissão de mic (não é transcrição).
