# Upload de pastas e organização documental por pastas

## Objetivo
Permitir selecionar ou arrastar uma pasta inteira, enviar todos os arquivos compatíveis de uma vez e preservar sua estrutura de subpastas. Depois, as pastas poderão ser criadas, renomeadas e reorganizadas tanto dentro de cada caso quanto na Biblioteca geral.

## Experiência de uso
- Adicionar ao carregamento as opções **Selecionar arquivos** e **Selecionar pasta**.
- Aceitar arrastar uma pasta para a área de envio, mantendo subpastas e nomes originais.
- Mostrar uma revisão antes do envio com quantidade de arquivos, pastas, tamanho total e itens ignorados por formato ou limite.
- Enviar pela fila já existente, com progresso individual, cancelamento e continuidade ao fechar a janela.
- Exibir documentos em uma árvore expansível de pastas, sem perder o agrupamento atual das partes de PDFs grandes.
- Incluir ações para criar subpasta, renomear pasta e mover documentos ou pastas.
- Ao excluir uma pasta, preservar os documentos, movendo-os para o nível acima após confirmação.
- Manter documentos antigos, sem pasta, na seção **Sem pasta**.

## Dentro do caso
- Preservar a pasta escolhida no computador como estrutura dentro do caso.
- Permitir selecionar documentos por pasta para uso no JurisMind.
- Manter prévia, status de leitura, OCR, reprocessamento, exclusão e auditoria em cada documento.
- Quando um PDF for dividido, todas as partes permanecerão dentro da mesma pasta e aparecerão como um único documento expansível.

## Biblioteca geral
- Exibir a mesma estrutura de pastas com busca e filtros atuais.
- Identificar claramente o caso de cada documento.
- Permitir organizar documentos em pastas gerais do escritório e navegar também pelas pastas internas de cada caso.
- Manter abrir, baixar e acessar o caso diretamente pela listagem.

## Dados e segurança
- Criar uma estrutura de pastas por organização, com suporte a subpastas e vínculo opcional a um caso.
- Vincular cada documento à sua pasta e guardar também o caminho relativo original do upload.
- Aplicar isolamento por organização, permissões de documentos, RLS e concessões explícitas de acesso.
- Validar nomes e cada segmento do caminho no servidor para impedir caminhos inválidos ou travessia de diretórios.
- Tratar arquivos com o mesmo nome em pastas diferentes como documentos distintos; duplicidade por conteúdo continua detectada.
- Registrar na auditoria criação, renomeação, movimentação e exclusão de pastas.

## Implementação técnica
- Evoluir o seletor e o gerenciador de upload para transportar `webkitRelativePath` sem alterar o nome visível do arquivo.
- Adicionar `document_folders` com hierarquia por `parent_folder_id` e adicionar `folder_id`/`relative_path` aos documentos.
- Criar operações autenticadas para listar, criar, renomear, mover e remover pastas, sempre limitadas à organização e ao caso permitido.
- Atualizar assinatura de upload, registro, substituição, importação e divisão de PDFs para conservar a pasta.
- Extrair uma árvore documental compartilhada pelas telas do caso e da Biblioteca, reutilizando o agrupamento de documentos divididos.
- Evitar criar uma requisição simultânea por arquivo: manter processamento limitado pela fila existente para pastas grandes.

## Validação
- Testar pasta simples, subpastas aninhadas, nomes repetidos em locais diferentes e arquivos inválidos.
- Testar PDFs divididos, cancelamento, retomada, substituição e importação entre casos.
- Confirmar isolamento entre organizações e permissões de visualização/movimentação.
- Verificar árvore, busca, filtros, prévia e movimentação em desktop e celular.
- Executar testes automatizados e um fluxo autenticado completo: selecionar pasta → enviar → reorganizar → abrir na Biblioteca e no caso.
