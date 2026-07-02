## Objetivo

Permitir escolher qual microfone é usado pelo chat de voz, com destaque quando ocorrer falha (`NotReadableError`, silêncio persistente, permissão negada em um dispositivo específico), e reutilizar o mesmo dispositivo em gravações futuras.

## Escopo

Alterações restritas a `src/components/chat/jurismind-chat.tsx` (frontend). Nenhuma mudança de backend/servidor.

## Comportamento

1. **Enumeração**
   - Ao montar o componente e ao clicar no seletor, chamar `navigator.mediaDevices.enumerateDevices()` e filtrar `kind === "audioinput"`.
   - Se os `label`s estiverem vazios (permissão nunca concedida), mostrar apenas "Microfone padrão" e um botão "Autorizar para listar dispositivos" que faz um `getUserMedia({audio:true})` curto só para liberar os labels e depois re-enumera.
   - Ouvir `navigator.mediaDevices.ondevicechange` para atualizar a lista quando um mic é conectado/desconectado.

2. **Persistência**
   - Guardar o `deviceId` escolhido em `localStorage` (`jurismind:mic-device-id`) e num `state` (`selectedMicId`).
   - Se o `deviceId` salvo não existir mais na lista, cair para `default` e limpar o storage.

3. **Uso na gravação**
   - `startRecording` passa `{ audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true }` para `getUserMedia`.
   - Em `OverconstrainedError`, fazer fallback automático para `{ audio: true }`, mostrar toast leve ("Dispositivo indisponível — usando padrão") e limpar `selectedMicId`.

4. **UI**
   - Novo `Popover` acionado por um botão discreto (ícone `Settings2` ou `ChevronDown`) posicionado ao lado do botão de microfone existente na barra do composer. Não aumentar a altura da barra.
   - Conteúdo do popover:
     - Título "Microfone".
     - Lista de opções com `RadioGroup`: cada item mostra o `label` do dispositivo (ou "Microfone {n}" quando vazio); o item ativo recebe check.
     - Botão "Atualizar lista" (re-enumera).
     - Rodapé com o `deviceId` atual em fonte mono truncada (útil para debug) — opcional, discreto.
   - No banner de erro existente (`micError`), adicionar um botão secundário "Trocar microfone" que abre o mesmo popover.
   - Desabilitar a troca enquanto `recording === true` (mostrar dica: "Pare a gravação para trocar").

5. **Acessibilidade**
   - `aria-label` no botão do seletor: "Escolher microfone".
   - Popover fecha ao selecionar; foco retorna ao botão do mic.

## Detalhes técnicos

- Novos estados/refs em `jurismind-chat.tsx`:
  - `const [mics, setMics] = useState<MediaDeviceInfo[]>([])`
  - `const [selectedMicId, setSelectedMicId] = useState<string | null>(...)` inicializado do `localStorage`.
  - `const [micPickerOpen, setMicPickerOpen] = useState(false)`
  - `const [micLabelsUnlocked, setMicLabelsUnlocked] = useState(false)`
- Helper `refreshMics()` isolado, chamado em `useEffect` inicial, no `ondevicechange`, ao abrir o popover e após o `getUserMedia` de qualquer gravação (onde os labels ficam disponíveis).
- Ajuste em `startRecording`:
  ```ts
  const constraints: MediaStreamConstraints = {
    audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
  };
  try { stream = await navigator.mediaDevices.getUserMedia(constraints); }
  catch (e) {
    if ((e as DOMException).name === "OverconstrainedError" && selectedMicId) {
      setSelectedMicId(null); localStorage.removeItem("jurismind:mic-device-id");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      toast.message("Microfone selecionado indisponível — usando o padrão.");
    } else { throw e; }
  }
  ```
- Cleanup: garantir que qualquer stream aberto para "desbloquear labels" seja imediatamente parado (`stream.getTracks().forEach(t => t.stop())`).
- Sem novas dependências; `Popover`, `RadioGroup`, `Button` já existem no projeto.

## Fora de escopo

- Seleção de dispositivo de saída (alto-falantes) — o chat não reproduz áudio próprio.
- Testes de latência/ganho por dispositivo.
- Persistência por-usuário no backend (só `localStorage`).
