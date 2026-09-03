# Roadmap

## Feito
- [x] Nova homepage pública posicionando o JurisMind como camada de inteligência jurídica (RAG, operação, governança).

## Em aberto (RAG — revisão técnica incremental)
- [ ] Fase 1: fixtures sintéticas + harness de benchmark (Recall@K, MRR, precisão/cobertura de fontes) e linha de base.
- [x] Fase 2: parsers explícitos por formato, chunking estrutural versionado, metadados de procedência, indexação resiliente.
- [ ] Fase 3: keywords no híbrido, diversidade, vizinhos, reranker com procedência, suficiência documental.
- [ ] Fase 4: separação retrieved/cited/supporting, refs [F1], remoção do percentual de similaridade.
- [ ] Fase 5: acesso efetivo ao caso no RAG (membros) + resumo hierárquico do caso.
- [ ] Fase 6: benchmark antes/depois e promoção da nova pipeline.

## Em aberto (homepage — legibilidade e demonstração)
- [ ] Legibilidade/contraste WCAG AA (16px+ texto, 14px+ auxiliar, botões 44px).
- [ ] Trocar exemplo do hero para caso cível de cobrança contratual (fictício, identificado).
- [ ] Abas Cível / Trabalhista / Empresarial na demonstração, sem rotação automática.
- [ ] Mostrar resposta concreta com refs [F1]/[F2]/[F3] e fontes utilizadas.
- [ ] Bloco "Como o JurisMind chegou a essa resposta?" com 4 etapas + explicação de RAG.


## Em aberto (marketing / publicações)
- [ ] Radar Jurídico: busca semanal de temas definidos no sistema via Firecrawl e sugestão de pautas prontas.
- [ ] Tela de geração de publicações: informar URL ou tema → gerar post para redes com Firecrawl.
- [ ] Armazenar fontes e citações (links + trechos) de cada publicação gerada.
- [ ] Templates de post/arte 9:16 e 16:9 com variações automáticas a partir do texto extraído.
- [ ] Fluxo de rascunho → revisão → publicação no sistema para conteúdo raspado.

## Em aberto (monitoramento de publicações judiciais)
- [ ] Habilitar pg_cron e agendar captura diária dos termos monitorados.
- [ ] Digest diário por e-mail com novas publicações e links, por usuário.
- [ ] Notificações imediatas quando publicação nova for vinculada a caso no Kanban.
- [ ] Monitoramento por número de OAB com vinculação ao caso correto.

## Diretriz de comunicação (aplicar em toda copy)
O advogado não contrata o JurisMind para ter acesso a mais uma IA. Contrata para transformar
os documentos e casos do escritório em uma inteligência jurídica organizada, verificável e
integrada ao trabalho.
