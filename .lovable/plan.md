## Objetivo
Melhorar a UX do microfone no chat do JurisMind com feedback visual claro de status (gravando/processando), timer, indicador de nível de áudio e mensagens de erro mais úteis quando a transcrição falhar.

## Escopo
Apenas frontend em `src/components/chat/jurismind-chat.tsx` (mais um pequeno componente auxiliar). Sem mudanças no backend `/api/tools/transcribe`.

## Mudanças

### 1. Estado e refs adicionais
- `recordingMs` (número, atualizado por intervalo a cada 250 ms) para timer "0:12".
- `audioLevel` (0–1) via `AnalyserNode` para mostrar barra de volume — detecta microfone mudo.
- `micError` (string | null) exibido inline abaixo do input quando a última transcrição falha, com botão "Tentar novamente" (reabre gravação) e "Fechar".
- Refs: `analyserRef`, `audioCtxRef`, `rafRef`, `timerRef`, `startedAtRef`.

### 2. Status visual do botão do microfone
- **Idle**: ícone `Mic`, tooltip "Ditar mensagem".
- **Gravando**: variante `destructive`, ícone `Square`, badge pulsante vermelho + timer "0:12" ao lado do botão, barra fina de nível de áudio.
- **Processando**: `Loader2` girando, tooltip "Transcrevendo…", desabilitado.
- **Erro** (transitório): ícone `AlertCircle` por 2s antes de voltar a idle, além do toast e do banner inline.

### 3. Feedback contextual
- Pequeno pill "● REC 0:12" ao lado do botão enquanto grava (aria-live="polite").
- Se `audioLevel` ficar ~0 por >2s durante gravação, mostra dica "Microfone parece silencioso — verifique o dispositivo".
- Auto-stop de segurança em 60s com toast informativo.

### 4. Tratamento de erro aprimorado
Traduzir os erros mais comuns em mensagens acionáveis (toast + banner inline):
- `NotAllowedError` / `PermissionDeniedError` → "Permissão de microfone negada. Habilite nas configurações do navegador."
- `NotFoundError` → "Nenhum microfone encontrado."
- `NotReadableError` → "Microfone ocupado por outro aplicativo."
- HTTP 401/403 do endpoint → "Sessão expirada. Faça login novamente."
- HTTP 413 → "Áudio muito grande. Grave um trecho mais curto."
- HTTP 429 → "Muitas requisições. Aguarde alguns segundos."
- HTTP 5xx / rede → "Falha no serviço de transcrição. Tente novamente."
- Áudio curto (<500 bytes) → mensagem clara "Nada capturado — segure o botão e fale."
- Timeout de 30s no `fetch` (AbortController) → "A transcrição demorou demais."

### 5. Acessibilidade
- `aria-pressed` no botão do mic refletindo `recording`.
- `aria-live="polite"` na região do timer/status.
- `aria-label` dinâmico ("Iniciar gravação" / "Parar gravação (0:12)" / "Transcrevendo").

### 6. Limpeza
- `useEffect` de cleanup ao desmontar: parar `MediaRecorder`, fechar `AudioContext`, cancelar `requestAnimationFrame`, limpar `setInterval`, encerrar tracks do stream.

## Detalhes técnicos
- Nível de áudio: `AudioContext` → `MediaStreamSource` → `AnalyserNode` (fftSize 256), amostra RMS por `requestAnimationFrame`.
- Timer: `setInterval(250ms)` calculando `Date.now() - startedAtRef.current`.
- Renderizar o pill de status e a barra de nível ao lado do botão (dentro do mesmo container flex do input) para não quebrar o layout responsivo.
- Nenhuma alteração no backend; o corpo de request e o parsing da resposta permanecem iguais.

## Fora de escopo
- Streaming/SSE de transcrição parcial (usa endpoint atual não-streaming).
- Mudar provider/model de transcrição.
- Aplicar a mesma UX no editor da proposta (fazemos depois se pedir).