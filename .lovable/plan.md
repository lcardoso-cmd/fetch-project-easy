# Alinhar a janela do JurisMind ao que a homepage mostra

## Resposta direta antes do plano

Sim, isto é 100% factível, porque nada aqui depende de criar funcionalidade nova. Word, PDF, Excel, PowerPoint e as respostas com fontes já funcionam de verdade no sistema hoje. O trabalho é de apresentação: dar aos resultados dentro do caso a mesma clareza visual da demonstração pública, e destacar o botão do JurisMind em vez de deixá-lo perdido entre abas e tabelas.

O escopo é fechado e verificável na tela, então não fica pela metade.

## O que muda

### 1. O botão do JurisMind deixa de competir com as abas

Hoje o caso abre com uma fileira de abas (Visão geral, Documentos, Produção, Prazos, Atividade) e o acesso ao JurisMind fica diluído ali no meio.

Passa a existir, no topo do caso, um bloco de ação próprio e destacado — fundo navy, ciano só no realce, texto branco — com:

- o convite principal "Perguntar ao JurisMind sobre este caso";
- três atalhos que já disparam a conversa com o pedido pronto: "Analisar documentos", "Redigir peça", "Gerar planilha", "Montar apresentação";
- contagem de documentos já indexados do caso, para o advogado saber sobre o que a IA vai responder.

As abas continuam existindo, mas ficam visualmente secundárias em relação a esse bloco.

### 2. Os resultados dentro da janela do JurisMind ganham a mesma leitura da homepage

Dentro do painel de conversa do caso, cada material produzido passa a aparecer como um cartão de resultado claro, com cabeçalho identificando o tipo, prévia fiel e ações de download alinhadas:

- **Análise**: conclusão em destaque e as fontes citadas como marcadores clicáveis, mostrando documento e página.
- **Peça**: prévia com aparência de página A4 (título, seções, parágrafos), com "Abrir editor", "Baixar Word" e "Baixar PDF".
- **Planilha**: tabela com cabeçalho fixo, alinhamento numérico à direita e linha de total destacada, com "Baixar Excel".
- **Apresentação**: lâmina principal em 16:9 com miniaturas dos demais slides, com "Baixar PowerPoint".

Os arquivos continuam sendo gerados pelos mesmos mecanismos atuais — só a moldura muda.

### 3. Organização da janela do JurisMind

O painel lateral do caso passa a ter uma estrutura constante: conversa acima, materiais produzidos agrupados abaixo com rótulo "Materiais deste caso", para que o advogado não precise rolar a conversa inteira para reencontrar um arquivo.

## Detalhes técnicos

- `src/routes/_authenticated/assistencias.$caseId.tsx`: novo bloco de ação primária acima de `Tabs`, abrindo `CaseJurisMindPanel` com um prompt inicial por atalho.
- `src/components/chat/case-jurismind-panel.tsx`: cabeçalho do painel, seção de materiais e passagem do prompt inicial.
- `src/components/chat/artifact-cards.tsx`: reestilização de `PetitionCard`, `PDFCard`, `TableCard`, `PresentationCard` reaproveitando a linguagem visual já definida em `src/components/marketing/output-showcase.tsx` (tokens navy/ciano, tipografia mínima de 15px, tabela com rolagem horizontal controlada).
- Citações: componente de referência reutilizável para as fontes já devolvidas por `chat-rag.server.ts` (documento, página, tipo de fonte).
- Nenhuma alteração em endpoints (`/api/tools/table|petition|presentation|pdf`), schema, RLS ou lógica de IA.
- Verificação: typecheck, suíte de testes existente e conferência visual do caso e do painel em desktop e mobile.

## Fora de escopo

- Não muda a geração de conteúdo nem os modelos de IA.
- Não altera permissões, cobrança ou dados.
- Não conecta a demonstração pública a dados reais.
