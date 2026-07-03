Plano de correção:

1. Corrigir o editor que abre em branco
- Ajustar `RichTextEditor` para inicializar o `contentEditable` com o HTML recebido já no primeiro render/mount.
- Manter a sincronização externa quando a IA gera/restaura conteúdo, sem apagar cursor a cada tecla.
- Garantir que a folha branca continue com texto escuro no modo claro/escuro.

2. Aplicar o mesmo comportamento nos dois lugares afetados
- Tela `/propostas`: o conteúdo gerado deve aparecer imediatamente na aba “Editor”, igual à “Prévia Word”.
- Chat do JurisMind: os cards editáveis de peça/documento também devem abrir com texto visível.

3. Evitar documento duplicado no chat
- No streaming SSE, não renderizar texto intermediário como resposta final quando a rodada está chamando ferramenta de documento.
- Fazer o chat mostrar apenas uma confirmação curta no balão e o documento uma única vez no card editável.
- Ajustar as instruções/tools para não gerar `create_petition` e `create_pdf` juntos com o mesmo conteúdo, salvo quando o usuário pedir explicitamente os dois formatos.

4. Validar o fluxo
- Conferir visualmente em `/propostas` que a aba “Editor” mostra o mesmo conteúdo da “Prévia Word”.
- Conferir no chat que uma solicitação de peça gera apenas um card editável com o conteúdo e não duplica o documento no texto da conversa.