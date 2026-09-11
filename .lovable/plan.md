# Redesign profissional da tela do JurisMind

## Direção escolhida

Construir a opção **Contexto em destaque**, mantendo a identidade navy institucional, títulos em Sora, interface em Manrope e ciano restrito a seleção, foco e ações importantes.

## O que muda

- Substituir os dois blocos estreitos da esquerda por uma única barra lateral organizada e recolhível.
- Separar o conteúdo lateral em **Documentos** e **Caso**, evitando nomes, partes e dados truncados.
- Exibir cada documento em uma linha legível, com tipo, páginas, data, seleção e ação para abrir a prévia sem sair do JurisMind.
- Reorganizar os dados do caso em rótulo e valor, com espaço suficiente para jurisdição, número do processo e nomes longos das partes.
- Dar à conversa uma coluna central de leitura, cabeçalho compacto e indicador claro de quantos documentos serão usados.
- Trocar o vazio inicial por um bloco útil de contexto da análise e manter as sugestões próximas ao campo de pedido.
- Ampliar e fixar o campo de pedido no rodapé, preservando anexos, voz, modelo, geração, materiais e tela cheia.
- Manter histórico de conversas no painel externo existente e preservar todos os fluxos atuais.

## Responsividade e acessibilidade

- No desktop, a barra lateral poderá ser recolhida para ampliar a conversa.
- Em telas menores, caso e documentos continuarão acessíveis em painel deslizante.
- Textos operacionais terão no mínimo 15px; nomes longos quebrarão linha em vez de desaparecer.
- Botões de ícone terão rótulos acessíveis, foco visível e dimensões estáveis.

## Detalhes técnicos

- Refatorar `JurisMindChat` sem alterar streaming, persistência, seleção de documentos ou geração de arquivos.
- Reaproveitar a função existente de URL temporária para abrir a prévia do documento em uma janela ampla.
- Atualizar a fonte de interface para Manrope no carregamento global e no token tipográfico.
- Usar exclusivamente tokens semânticos existentes da marca, sem introduzir outra paleta.
- Validar a tela com dados reais em desktop e mobile, incluindo abertura de documento, recolhimento da barra e envio de mensagem.

## Fora de escopo

- Nenhuma mudança no banco de dados, permissões, IA, processamento de documentos ou conteúdo das respostas.
