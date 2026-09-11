# Motor jurídico de ponta com consumo controlado

## Objetivo

Atualizar o núcleo conversacional do JurisMind para usar **`openai/gpt-6-astra`** nas respostas jurídicas e na redação final, sem desperdiçar créditos com contexto irrelevante, repetições ou tentativas indevidas.

A meta será **máxima fidelidade verificável**, não uma promessa impossível de 100% de acerto: toda conclusão baseada no caso continuará ligada a fontes, e o JurisMind deverá declarar quando os documentos não sustentarem uma resposta segura.

## O que será feito

### 1. Modernizar o motor principal

- Migrar o chat jurídico em streaming para a Responses API do Lovable AI, própria para o modelo de ponta atual.
- Usar raciocínio com esforço controlado: menor em pedidos simples e maior em análises, estratégia, riscos e redação jurídica.
- Manter resposta e resumo do raciocínio em streaming, com cancelamento apenas quando o usuário clicar em parar.
- Preservar as ferramentas atuais: consulta ao caso, páginas, documentos, prazos, jurisprudência, tarefas e geração de Word, PDF, planilha e apresentação.
- Adaptar os contratos dessas ferramentas para validação estrita, evitando chamadas ambíguas ou argumentos incompletos.

### 2. Substituir o seletor de “modelo” por profundidade de trabalho

- **Rápido**: mesma IA de ponta, recuperação documental enxuta e raciocínio leve.
- **Balanceado**: busca ampliada, reordenação de evidências e raciocínio médio.
- **Máximo**: recuperação mais abrangente, verificação adicional e raciocínio alto para trabalhos críticos.
- O modo escolhido passará a controlar profundidade, quantidade de evidências e esforço — não trocar silenciosamente para um modelo jurídico inferior.

### 3. Reduzir tokens sem retirar fatos importantes

- Carregar o histórico completo e confiável da conversa pelo servidor, em vez de depender apenas das últimas oito mensagens enviadas pela tela.
- Remover duplicações de fontes, resultados de ferramentas e trechos sobrepostos antes da chamada final.
- Manter a busca híbrida existente, mas ajustar dinamicamente a quantidade de trechos conforme a pergunta e a suficiência encontrada.
- Enviar texto integral de páginas apenas quando a pergunta exigir; consultas simples usam metadados e trechos curtos.
- Aplicar limites de saída por tipo de pedido no texto das instruções, evitando respostas longas sem necessidade.
- Manter OCR e catálogo visual como fluxos separados e econômicos; eles não precisam usar o modelo jurídico principal.

### 4. Cache seguro para contexto jurídico

- Substituir o cache temporário em memória por cache persistente e isolado por organização.
- Cachear somente respostas determinísticas e sem ações, com chave que inclua caso, documentos selecionados, versão da indexação, pergunta, modo e instruções.
- Invalidar automaticamente quando documentos, leitura, partes ou dados relevantes do caso mudarem.
- Nunca reutilizar por cache uma criação de tarefa, evento, arquivo, busca externa ou resposta baseada em contexto desatualizado.

### 5. Falhas, fallback e orçamento

- Remover o fallback por simples demora: raciocínio jurídico mais longo não será interrompido nem trocado por modelo inferior após poucos segundos.
- Retentar somente limites temporários e falhas de serviço, com espera e número limitado de tentativas.
- Em falta de créditos ou bloqueio administrativo, interromper imediatamente e mostrar a causa real, sem novas chamadas automáticas.
- Preservar limites mensais por organização e registrar modelo, modo, tokens de entrada/saída, custo, cache, evidências usadas e duração.

### 6. Qualidade mensurável

- Criar uma suíte de perguntas jurídicas de referência com respostas esperadas, fontes obrigatórias e casos sem evidência suficiente.
- Medir separadamente: correção das citações, cobertura documental, afirmações sem fonte, uso correto das ferramentas, custo e tempo.
- Comparar o motor atual com o novo antes de tornar a mudança padrão.
- Liberar primeiro de forma controlada, com possibilidade de retorno rápido ao fluxo anterior se houver regressão.

## Detalhes técnicos

- Criar um adaptador server-only para Lovable AI com propagação do identificador de execução e tratamento padronizado de erros.
- Migrar o fluxo jurídico em `src/routes/api/chat/stream.ts` e `src/lib/chat-rag.server.ts` para `openai/gpt-6-astra`, mantendo SSE e persistência das mensagens.
- Separar as funções de chat jurídico das rotinas auxiliares em `src/lib/ai.server.ts`, para que OCR, embeddings, catálogo e tarefas leves mantenham configurações próprias.
- Buscar o histórico pelo `thread_id` no servidor, validar que pertence à organização/caso e reconstruir corretamente mensagens e pares de chamadas de ferramenta.
- Atualizar `src/components/chat/jurismind-chat.tsx` para exibir profundidade, resumo de raciocínio recolhível e erros acionáveis, sem expor fornecedor ou detalhes internos ao usuário final.
- Criar tabela de cache com `GRANT`, RLS, expiração, versão documental e isolamento por organização; nenhum cache compartilhado entre clientes.
- Atualizar preços e telemetria para que o painel de consumo não registre custo zero para o novo modelo.

## Validação

- Testes unitários do adaptador, histórico completo, contratos de ferramentas, deduplicação de contexto, invalidação de cache e semântica de erros.
- Testes reais do gateway para resposta simples, análise com fontes, uso de ferramenta e conversa com múltiplos turnos.
- Cenários de benchmark com documentos do caso: pergunta factual, contradição entre páginas, ausência de evidência, peça jurídica e consulta a dado estruturado.
- Conferência de streaming, botão parar, persistência, histórico, fontes e materiais gerados em desktop e mobile.
- Critério de aprovação: nenhuma queda na precisão das fontes, nenhuma ação duplicada e redução mensurável de tokens por resposta equivalente.

## Fora de escopo

- Prometer 100% de acerto ou substituir revisão profissional do advogado.
- Refazer o pipeline de OCR e indexação de documentos que já funciona separadamente.
- Alterar permissões dos casos ou misturar configurações da organização com preferências pessoais.
