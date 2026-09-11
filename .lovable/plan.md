# Consulta processual pelo chat e atualização confirmada do caso

## Objetivo
Permitir que o advogado peça no próprio JurisMind algo como “consulte o andamento atualizado deste processo”. O sistema consultará fontes externas, mostrará a origem e o horário da consulta e preparará uma atualização do caso, mas só salvará após confirmação explícita do usuário.

## Experiência no chat
1. O JurisMind identifica o número CNJ já cadastrado no caso ou usa o número informado no pedido.
2. Consulta a fonte oficial estruturada do CNJ para metadados e movimentações disponíveis.
3. Complementa com publicações do DJEN e, quando necessário, tenta a consulta pública oficial do tribunal por meio do conector de navegação já disponível.
4. Responde com:
   - situação encontrada e data da consulta;
   - últimas movimentações em ordem cronológica;
   - fonte e link oficial em cada informação;
   - aviso claro quando uma fonte estiver atrasada, indisponível, protegida por captcha ou não cobrir o processo.
5. Exibe uma proposta de atualização com comparação “atual → encontrado”.
6. O usuário escolhe **Confirmar atualização** ou **Descartar**. Nada será alterado silenciosamente.

## Persistência e histórico
- Criar um registro próprio para cada consulta, com organização, caso, número CNJ, fonte, horário, resultado e falha sanitizada.
- Armazenar movimentações normalizadas sem duplicá-las, preservando o conteúdo e a URL de origem.
- Criar propostas de alteração pendentes, aprovadas ou rejeitadas.
- Ao confirmar, aplicar somente os campos exibidos na comparação e gravar autor, horário, valores anteriores, valores novos e fontes.
- Não sobrescrever partes, cliente, estratégia, descrição jurídica ou outros fatos sensíveis a partir de conteúdo coletado.
- Manter isolamento por organização e acesso ao caso com RLS, permissões de edição e auditoria.

## Fontes e confiabilidade
- **Primária:** API Pública DataJud/CNJ para metadados e movimentos estruturados disponíveis.
- **Complementar:** DJEN para comunicações e intimações oficiais relacionadas ao CNJ.
- **Fallback:** páginas públicas oficiais do TJRJ por meio do Firecrawl já conectado, aceitando que captcha e mudanças do portal podem impedir a leitura.
- Nunca apresentar DJEN como se fosse a consulta processual completa.
- Nunca inventar movimentação quando nenhuma fonte retornar dados.
- Informar que a atualização pode não ser em tempo real e que processos sigilosos podem não aparecer.

## Implementação técnica
- Criar um serviço server-only de consulta processual com normalização CNJ, adaptador DataJud, complemento DJEN e fallback TJRJ.
- Adicionar ao motor do chat uma ferramenta somente de consulta, disponível quando houver número CNJ válido.
- Retornar no streaming um resultado estruturado contendo fontes, movimentações, divergências e uma proposta de atualização.
- Criar uma função autenticada separada para confirmar a proposta; ela revalida organização, acesso ao caso, estado pendente e campos permitidos antes da escrita.
- Renderizar no chat um cartão de resultado com movimentações, links, diferenças e botões de confirmar/descartar.
- Persistir esse cartão no histórico da conversa para continuar disponível ao reabrir o chat.
- Usar o motor Astra já adotado apenas para interpretar e explicar os dados; a coleta e a gravação serão determinísticas.

## Banco de dados
Adicionar tabelas multiempresa para:
- consultas processuais e suas fontes;
- movimentações processuais normalizadas;
- propostas de atualização do caso;
- auditoria das alterações confirmadas.

Cada nova tabela terá `GRANT`, RLS, políticas baseadas em associação à organização e acesso ao caso, índices por caso/CNJ/data e deduplicação por fonte + identificador/hash da movimentação.

## Validação
- Testes unitários de normalização CNJ, movimentos, deduplicação, falhas de fonte e comparação de alterações.
- Testes de segurança para impedir leitura ou confirmação entre organizações e impedir confirmação por usuário sem permissão de edição.
- Testes do fluxo: consultar → visualizar fontes → confirmar → atualizar caso → reabrir conversa e ver o histórico.
- Testar com o processo informado (`0021932-09.2019.8.19.0023`) sem assumir que a fonte pública retornará dados.
- Validar respostas para fonte indisponível, captcha, processo inexistente e processo sigiloso.

## Limites explícitos
A solução consulta as melhores fontes públicas disponíveis, mas não pode garantir acesso em tempo real ao portal do TJRJ quando houver captcha, indisponibilidade ou restrição. Nesses casos, o JurisMind mostrará exatamente o que conseguiu consultar, sem afirmar que o andamento está completo.
