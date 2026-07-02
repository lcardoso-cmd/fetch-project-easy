## Objetivo

Garantir que leitores de tela anunciem corretamente as mudanças de estado do microfone (iniciar/parar gravação, transcrição parcial, silêncio detectado, transcrição concluída, erros) e que o foco vá para o banner de erro do microfone quando ele surgir, permitindo ação imediata via teclado.

## Escopo

Alterações restritas a `src/components/chat/jurismind-chat.tsx` (UI/apresentação). Sem mudanças em lógica de gravação, transporte SSE ou persistência.

## Mudanças

### 1. Separar regiões live por severidade
Hoje há um único wrapper `aria-live="polite"` envolvendo REC, "Transcrevendo…", aviso de silêncio e o card de erro. Isso mistura status transitórios com erros, e o Radix Popover (mic picker) dentro dele quebra o anúncio.

- Criar duas regiões vivas dedicadas, fora do fluxo visual quando necessário:
  - **`statusRegion`** (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`): compõe uma única frase textual a partir do estado atual (ex.: "Gravando há 12 segundos", "Microfone silencioso", "Transcrevendo em tempo real", "Transcrição concluída"). Fica `sr-only` (visualmente escondida, mas acessível), enquanto os chips coloridos existentes seguem sendo visuais.
  - **`alertRegion`** (`role="alert"`, `aria-live="assertive"`): recebe `micError` quando muda. Também `sr-only` para não duplicar leitura do banner visível.

- O chip visual de REC recebe `aria-hidden="true"` (informação redundante com a região de status) e o cronômetro continua no botão via `aria-label` já existente.

- A frase de status é regenerada apenas quando o estado muda (não a cada tick do cronômetro) para não spammar o leitor: usar buckets ("Gravando", "Gravando, microfone silencioso", "Transcrevendo em tempo real", "Transcrição concluída", "Ocioso") memorizados via `useMemo`/`useEffect`.

### 2. Gerenciamento de foco no banner de erro
Quando `micError` passa de `null` para uma mensagem:

- Renderizar o container do erro com `role="alertdialog"` leve: `role="alert"`, `tabIndex={-1}` e `ref` para chamar `.focus({ preventScroll: false })` num `useEffect` disparado pela transição de `micError`.
- Adicionar `aria-labelledby` apontando para o texto da mensagem e `aria-describedby` para as ações (Trocar microfone / Tentar novamente).
- Ao fechar o banner (botão X, retomar gravação, escolher outro mic), devolver foco ao botão de microfone (`micButtonRef`) para não perder contexto do teclado.
- Tecla `Escape` dentro do banner chama o mesmo handler de fechar.

### 3. Rotular o botão de microfone dinamicamente
O `aria-label` atual só descreve a ação; adicionar `aria-describedby` apontando para a região de status quando `recording || transcribing`, para que o leitor associe o botão ao estado. Também adicionar `aria-live` implícito via atualização do `aria-label` já existente (mantém-se).

### 4. Popover de seleção de microfone
- O `PopoverContent` recebe `aria-label="Selecionar microfone"` (já é dialog via Radix, mas sem título visível).
- Ao trocar de microfone, anunciar via `statusRegion` (ex.: "Microfone alterado para Realtek Audio").
- Botão "Autorizar" ganha `aria-busy={unlockingLabels}`.

### 5. Composição do texto de status (regras)

```text
idle                      → "" (região vazia)
recording                 → "Gravando. {mm}:{ss}"
recording + micSilent     → "Gravando. Microfone silencioso, verifique o dispositivo."
recording + segmentInFlight → "Gravando. Transcrevendo em tempo real."
transcribing (final)      → "Transcrevendo áudio, aguarde."
transição transcribing→idle com texto novo → "Transcrição concluída."
mic trocado               → "Microfone selecionado: {label}."
```

Reset após ~2s para "Transcrição concluída" e trocas de microfone, para não permanecer estático.

## Detalhes técnicos

- Novos refs: `micErrorRef` (HTMLDivElement), `micButtonRef` (HTMLButtonElement).
- Novo estado: `srStatus: string` atualizado via `useEffect([recording, transcribing, micSilent, segmentInFlight, selectedMicId])`.
- Usar `useEffect` separado que observa `micError` e, na transição `null → string`, foca `micErrorRef.current`; na transição `string → null`, restaura foco em `micButtonRef.current` se este ainda estiver montado e visível.
- Regiões `sr-only` usam a classe utilitária já presente no projeto (Tailwind `sr-only`).
- Não alterar comportamento em telas sem leitor de tela: nenhum layout muda; apenas ARIA e foco.

## Fora de escopo

- Mudanças em SSE de transcrição, no encoder WAV, no gateway ou no banco.
- Refactor do banner visual do microfone (permanece com mesma aparência).
- Ajustes de acessibilidade em outras áreas do chat (histórico, composer, uploads) — podem ser feitas em plano separado.

## Verificação

- Typecheck do arquivo alterado.
- Snapshot manual via Playwright: forçar `micError` (bloqueando `getUserMedia`), confirmar que:
  1. O foco vai para o banner.
  2. `role="alert"` está presente com a mensagem.
  3. Fechar devolve foco ao botão de microfone.
- Inspecionar DOM: garantir presença de duas regiões `sr-only` com `role="status"` e `role="alert"`.
