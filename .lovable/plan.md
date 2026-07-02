## Objetivo

Trocar a transcrição single-shot atual (só após parar) por transcrição segmentada em tempo real, com o texto aparecendo dentro do próprio input do chat enquanto o usuário fala.

## Estratégia

Rodar dois pipelines de captura em paralelo enquanto o botão do microfone está ativo:

1. **MediaRecorder** (já existente) — preserva o blob `.webm` completo para persistência/replay do áudio (não muda).
2. **Web Audio API + ScriptProcessor/AudioWorklet** — buffer PCM contínuo. A cada ~3s, o buffer acumulado é fatiado em uma janela auto-contida, codificado como WAV 16 kHz mono e enviado para um novo endpoint SSE de transcrição.

Cada segmento retorna deltas via SSE do Lovable AI Gateway (`openai/gpt-4o-mini-transcribe`, `stream: "true"`). O texto de cada segmento fechado é **appendado** ao input; o segmento ainda em processamento aparece como "partial" com opacidade reduzida (mesma caixa, sem bolha extra).

Ao parar a gravação: cancela segmentos em voo, mantém o texto já commitado, e sobe o blob `.webm` no envio da mensagem (fluxo atual de `pendingAudioRef` intacto). Não há re-transcrição final — evita custo duplicado.

## Arquivos afetados

### Novo: `src/routes/api/tools/transcribe-stream.ts`
- POST recebe `{ audio_base64, format: "wav" }`.
- Chama `POST https://ai.gateway.lovable.dev/v1/audio/transcriptions` como `multipart/form-data` com `model=openai/gpt-4o-mini-transcribe` e `stream=true`.
- Faz *passthrough* do `response.body` SSE (mesmo padrão do skill `ai-speech-to-text`), preservando `Content-Type: text/event-stream`.
- Erros (402/429/500) retornam JSON com status apropriado.

### Editar: `src/components/chat/jurismind-chat.tsx`
- Novo helper `src/lib/audio/wav-encoder.ts` (mono 16 kHz, header PCM 16-bit).
- Em `startRecording`:
  - Além do `MediaRecorder`, criar `AudioContext` + `ScriptProcessorNode` (já existe o `analyser`; adicionar um `processor` paralelo que empilha `Float32Array` em `pcmChunksRef`).
  - Timer a cada 3000 ms: se há PCM novo desde o último flush, fatia a janela, codifica WAV, `fetch("/api/tools/transcribe-stream")`, itera o SSE (`event: transcript.text.delta` → atualiza `livePartial`; `transcript.text.done` → move `livePartial` para `committedSegments`), controlado por `AbortController` armazenado em ref.
  - Novos estados: `liveTranscript` (string com o commit corrente + partial), `baseInput` (snapshot do input antes de gravar).
  - Reflete no textarea via `setInput(baseInput + " " + committed + partial)` respeitando espaços.
- Em `stopRecording`:
  - Aborta segmento em voo, para o processor, faz *flush* final de qualquer PCM residual (>0.3s) em uma última chamada SSE bloqueante curta (~2s timeout) para não perder as últimas palavras.
  - Mantém `input` como está; remove o marcador de partial (`livePartial = ""`).
  - Continua salvando `pendingAudioRef` com o blob do MediaRecorder para upload posterior.
- Remove o passo `onstop` de transcrição completa via `/api/tools/transcribe` (deixa o endpoint antigo intacto para fallback/uso externo, mas não é mais chamado do chat).
- Indicador visual: enquanto `livePartial` não vazio, exibir o trecho parcial no textarea com um `<span>` cinza-itálico não é possível dentro de `<textarea>` puro; solução: manter o parcial no próprio textarea (já foi o pedido), e adicionar um badge discreto "transcrevendo..." ao lado de "REC" quando `segmentInFlight`.
- Fallback: se o navegador não expõe `AudioContext`/`ScriptProcessorNode`, cai no comportamento atual (single-shot ao parar) sem quebrar UX.

### Editar: `src/routes/api/tools/transcribe.ts`
- Sem mudança funcional. Fica como fallback e para uso por outras rotas.

## Considerações técnicas

- **Custo**: cada segmento consome créditos do Lovable AI, proporcional à duração real. Janela de 3s equilibra latência vs. custo. Se o segmento estiver em silêncio (RMS < 0.02 durante toda a janela), pula o envio.
- **Idempotência de segmentos**: cada WAV é auto-contido (header PCM 16-bit + amostras), o gateway aceita normalmente. Nada de fragmentos de container webm.
- **Race condition**: um `Map<segmentId, AbortController>` garante que o `stopRecording` cancela tudo em voo.
- **Downsample**: `AudioContext.sampleRate` geralmente é 44.1/48 kHz; downsample linear para 16 kHz reduz upload sem perder qualidade da voz.
- **Sem persistência de partial**: o texto final que vai para o backend é o mesmo que o usuário vê no input no momento de enviar — não muda contrato de `persistChatTurn`.
- **Auto-stop 60s** e monitoramento de silêncio permanecem inalterados.

## Fora do escopo

- Não trocar por ElevenLabs Realtime (foi descartado na pergunta).
- Não mudar UX do envio, upload de áudio, ou storage.
- Não mexer em outras telas que usam gravação (se houver, permanecem no fluxo antigo).