# Corrigir definitivamente a fila de leitura dos documentos

## Diagnóstico confirmado

- O PDF do caso atual foi dividido corretamente em **11 partes**, com cerca de 190 páginas por parte.
- As 11 partes estão `queued`, com **zero tentativas, nenhum heartbeat e zero trechos indexados**. A primeira está parada desde 17:04 UTC; o processador não chegou a reservá-la.
- O acionamento automático existente não se mostrou confiável no ambiente publicado: não há execução registrada do processador nem avanço apesar das consultas periódicas da tela.
- Quando uma parte excede a janela curta de execução, o código salva o progresso, devolve o trabalho para `queued` e libera o bloqueio. A seleção seguinte consulta novamente a fila geral, sem preferência pelo trabalho iniciado.
- Vários pontos podem acordar o processador ao mesmo tempo. O bloqueio atual impede duplicar a mesma parte, mas permite que execuções concorrentes reservem partes diferentes.
- A prioridade de leitura já está correta no código atual: primeiro tenta extrair a camada de texto; OCR é reservado às páginas realmente rasterizadas ou ao comando explícito “Ler como imagem”. Essa regra será preservada.

## Comportamento desejado

```text
Parte 1: texto nativo → verificação → OCR só onde necessário → trechos → pronta
Parte 2: texto nativo → verificação → OCR só onde necessário → trechos → pronta
Parte 3: ...
```

Uma parte iniciada continuará sendo a prioridade nas rodadas seguintes até terminar, falhar definitivamente ou ser cancelada. Só então a próxima parte será iniciada.

## Implementação

1. **Tornar o acionamento confiável**
   - Fazer o disparo confirmar que o primeiro trabalho foi efetivamente reservado antes de liberar a requisição.
   - Encadear automaticamente uma nova rodada enquanto houver trabalho pendente, sem depender da tela aberta.
   - Manter a tarefa periódica apenas como recuperação de segurança, não como mecanismo principal.
   - Registrar início, continuação, conclusão e falha com identificadores do trabalho e da parte para permitir diagnóstico objetivo.

2. **Serializar o processamento por organização**
   - Ajustar a reserva no banco para permitir somente um trabalho de indexação ativo por organização.
   - Tratar disputas de reserva sem transformar concorrência normal em erro.
   - Impedir que múltiplos disparos criados durante o upload façam partes diferentes rodarem em paralelo.

3. **Dar afinidade ao documento já iniciado**
   - Priorizar trabalhos com checkpoint/`started_at` sobre documentos ainda não iniciados.
   - Para arquivos divididos, respeitar `split_group_id` e `part_index`, concluindo as partes na ordem.
   - Ao atingir o limite de uma rodada, salvar o checkpoint e retomar a mesma parte na próxima rodada, sem consumir tentativa por continuação normal.

4. **Preservar texto primeiro e OCR como último recurso**
   - Manter extração nativa por páginas/faixas como primeira etapa.
   - Confirmar páginas duvidosas por segunda leitura quando a parte couber com segurança.
   - Enviar ao OCR somente páginas confirmadamente sem camada textual; nunca encaminhar o PDF inteiro por uma falha transitória do leitor.
   - Persistir páginas concluídas e falhas de OCR para não repetir trabalho já feito.

5. **Recuperar com segurança a fila atual**
   - Após publicar a correção, recolocar apenas os 11 trabalhos parados do caso atual no fluxo corrigido, preservando arquivos e metadados.
   - Não apagar nem recriar documentos e não duplicar trabalhos ativos.

6. **Validar ponta a ponta**
   - Testes de concorrência: vários disparos simultâneos devem reservar apenas uma parte por organização.
   - Testes de afinidade: uma parte incompleta deve ser retomada antes da próxima.
   - Testes de ordem: partes 1, 2, 3… devem concluir sequencialmente.
   - Testes de leitura: PDF textual não chama OCR; PDF misto chama OCR apenas nas páginas necessárias.
   - Verificação no banco e na tela do caso: tentativa/heartbeat aparecem na primeira parte, seu progresso cresce, ela conclui, e somente depois a segunda começa.

## Alterações técnicas previstas

- Processador e acionamento da fila em `src/lib/jobs/worker.server.ts` e no endpoint protegido de execução.
- Função de reserva da fila em uma migration, mantendo isolamento por organização e acesso exclusivo do serviço.
- Ajustes mínimos na seleção/status exibidos para refletir a ordem sequencial real.
- Testes automatizados do escalonamento, retomada e decisão texto/OCR.
