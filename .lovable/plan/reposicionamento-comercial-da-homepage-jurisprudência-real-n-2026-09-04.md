# Reposicionamento comercial da homepage + jurisprudência real no chat

## O que muda na percepção

Hoje a página abre falando de perguntas, respostas, trechos e contexto — o visitante conclui "é um GPT que lê documentos". A nova página abre mostrando um caso real virando análise, planilha, peça e apresentação, com a fonte de cada conclusão.

Categoria nova: **a plataforma de inteligência, produção e operação jurídica de cada caso.**

## Nova ordem da página

Antes: herói abstrato → como funciona → demonstração de perguntas → materiais (4 blocos empilhados) → plataforma → CTA.

Depois:
1. Herói com nova categoria + demonstração compacta do caso ao lado (cabe em 1366x768)
2. Um único caso em 5 etapas: localizar, organizar, produzir, apresentar, conduzir
3. Entregáveis reais (curtos, com prévia)
4. Como o JurisMind reconstrói o contexto (explicação simples do RAG, detalhes técnicos em conteúdo expansível)
5. Pesquisa jurisprudencial — só entra depois da integração validada
6. Por que não usar apenas um chat de IA (comparação estrutural, sem afirmar incapacidades falsas)
7. Operação e governança do escritório
8. Confiança (só o que é comprovável hoje)
9. Teste grátis por 30 dias

Menu: Como funciona · O que entrega · Por que é diferente · Segurança · Testar grátis. Autenticado vê só "Abrir meu painel".

## Textos principais

- Selo: "A inteligência operacional de cada caso"
- Título: "Transforme os autos em análises, peças, planilhas e apresentações — com cada conclusão ligada à fonte."
- Diferenciação: "Não é apenas um chat jurídico. É o ambiente onde o caso é analisado, produzido e conduzido."
- CTAs: "Testar grátis por 30 dias" / "Ver um caso em ação" (rola até a demonstração)

Caso fictício usado em toda a página: Reclamação Trabalhista — Maria Silva (cartões de ponto x recibos, 47h30 a apurar), com selo "Demonstração com dados fictícios". Segundo exemplo cível na explicação de contexto. Nenhum botão falso: as ações da demonstração são rótulos, não downloads.

## Demonstrador interativo

O `OutputShowcase` deixa de empilhar quatro blocos grandes e passa a ter quatro escolhas (Analisar · Criar peça · Gerar Excel · Criar apresentação) mostrando um resultado por vez, sem carrossel automático, com tabs acessíveis por teclado. As composições visuais já criadas (análise com fontes, folha A4, planilha, slide 16:9) são reaproveitadas; a etapa 5 (tarefa criada com responsável e prazo) é nova.

## Jurisprudência: integrar antes de anunciar

Verificado: `search_jurisprudence` existe só no MCP (`src/lib/mcp/tools/search-jurisprudence.ts`); as ferramentas do chat em `src/lib/chat-rag.server.ts` são create_event, create_task, list_case_events, list_case_tasks, create_petition, create_pdf, create_table, create_presentation — não há busca externa.

Trabalho:
- extrair a lógica para `src/lib/jurisprudence/jurisprudence-search.server.ts` (domínios oficiais autorizados, chave só no servidor, retorno com tribunal, órgão julgador quando houver, número, data, ementa/título, trecho, URL oficial e data da consulta);
- o MCP passa a chamar esse serviço;
- nova ferramenta `search_jurisprudence` no chat, acionada só quando o usuário pedir jurisprudência ou pesquisa externa, com seleção de tribunais;
- referências separadas: `[F1]` documentos do caso, `[J1]` jurisprudência externa; a interface mostra tribunal, origem oficial, link e aviso de fonte externa, e informa quando a pesquisa está indisponível;
- peças geradas separam fundamentos dos autos e precedentes externos;
- testes com respostas simuladas do provedor (nenhuma chamada real).

A seção de jurisprudência da homepage só é publicada depois desses testes passarem; caso a integração não fique operacional, ela não entra e isso é informado.

## Metadados

Title, descrição, Open Graph e canonical atualizados conforme solicitado, com canonical em `https://jurismind.b2bconsulting.com.br/`.

## Visual e acessibilidade

Navy #000038, ciano só como destaque, Sora/Inter, corpo mínimo 16px, auxiliares 14px, contraste AA, nada dependente de hover, animação discreta com `prefers-reduced-motion`. Sem screenshots: tudo em HTML/CSS.

## Fora de escopo

Sidebar, RBAC, cobrança, planos, CRM, upload, criação de casos e comunicação interna permanecem intocados.

## Detalhes técnicos

- Editar: `src/routes/index.tsx` (herói, ordem, menu, head), `src/components/marketing/output-showcase.tsx` (tabs + etapa 5), `src/lib/chat-rag.server.ts` (ferramenta + separação [F]/[J]), `src/lib/mcp/tools/search-jurisprudence.ts` (passa a delegar), componentes de citação do chat.
- Criar: `src/lib/jurisprudence/jurisprudence-search.server.ts`, componentes de herói/demonstração em `src/components/marketing/`, teste unitário da normalização de resultados com provedor simulado.
- Validação: typecheck, suíte existente + novos testes, build de produção, varredura axe e capturas em 1920x1080, 1366x768, 1024x768, 768x1024 e 390x844.
