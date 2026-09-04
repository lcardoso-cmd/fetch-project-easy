# Corrigir análise de documentos grandes no Novo caso

## Objetivo
Fazer o documento começar a ser processado de verdade, preencher os dados essenciais assim que forem encontrados, permitir navegar pelo sistema enquanto a leitura continua e impedir que um documento cancelado reapareça em um novo cadastro.

## Implementação

1. **Tornar o acionamento da fila confiável**
   - Substituir o disparo descartável atual por uma execução limitada e confirmada pelo servidor.
   - Manter a reserva exclusiva já existente no banco, o limite de tentativas e a retomada de trabalhos interrompidos.
   - Fazer a tela e o indicador global reativarem com segurança qualquer item que permaneça parado na fila, sem criar processamento duplicado.
   - Tratar falhas de acionamento de forma visível, em vez de deixar o documento indefinidamente em “Na fila”.

2. **Entregar dados em duas etapas**
   - Fazer uma leitura rápida das páginas iniciais, onde normalmente aparecem número do processo, cliente, partes, vara/tribunal ou câmara arbitral e natureza do caso.
   - Gravar esse primeiro resultado parcial no registro persistente enquanto a leitura complementar continua.
   - Depois analisar até 20 páginas, mesclar os campos adicionais sem apagar correções já feitas pelo usuário e concluir como completo ou parcial.
   - Atualizar progresso e páginas analisadas durante a leitura, não apenas no fim.

3. **Preencher o formulário progressivamente**
   - Aplicar `extracted_data` mesmo quando o documento ainda estiver em processamento.
   - Preencher somente campos ainda vazios ou ainda controlados automaticamente, preservando toda edição manual.
   - Manter a revisão obrigatória antes da criação do caso e exibir claramente quais dados ainda estão sendo procurados.

4. **Adicionar acompanhamento global minimizado**
   - Criar um indicador no lado direito do shell para documentos de “Novo caso” que estejam em fila, leitura ou análise.
   - Mostrar nome truncado, etapa, progresso e ação “Retomar cadastro”.
   - Continuar acompanhando após navegar para Casos, Biblioteca ou outras telas; encerrar a consulta automática quando não houver trabalho ativo.
   - Integrar ao espaço já ocupado pelo chat lateral sem sobreposição, com apresentação compacta no celular.

5. **Corrigir cancelamento e retomada**
   - Transformar “Cancelar” em uma ação real: descartar o intake, remover o arquivo ainda não convertido e limpar o rascunho local antes de sair.
   - Preservar o rascunho apenas quando o usuário navega para outra tela com intenção de retomar depois.
   - Impedir que um novo cadastro herde um documento cujo intake esteja cancelado, convertido ou inexistente.
   - Manter a conversão atual sem novo download quando o caso for confirmado.

## Detalhes técnicos
- Alterar o pipeline de intake, as funções de servidor e a tela `Novo caso` sem mexer em homepage, sidebar, RBAC, CRM, cobrança ou comunicação.
- Reutilizar `case_intake_documents`, os bloqueios `claim_intake_jobs`, o Storage privado e a fila de indexação RAG já existentes.
- Não baixar integralmente PDFs grandes para a leitura textual; manter HTTP Range. OCR integral continua limitado pela capacidade segura do ambiente e deve informar quando o PDF digitalizado exceder esse limite.
- O indicador global consultará apenas itens do usuário na organização ativa e respeitará as políticas já existentes.

## Validação
- Reativar o envio real atualmente parado e confirmar mudança de `queued` para leitura/análise e depois resultado.
- Testar PDF textual grande, PDF parcialmente digitalizado, erro, reprocessamento normal e OCR.
- Confirmar preenchimento parcial antes do término, preservação de edição manual, navegação durante o processamento e retomada pelo indicador.
- Confirmar que “Cancelar” limpa o documento e que abrir “Novo caso” novamente inicia vazio.
- Executar testes direcionados, verificação de tipos e validação visual autenticada em desktop e celular, incluindo ausência de sobreposição com o chat lateral.
