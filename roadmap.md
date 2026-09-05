# Roadmap — Reconstrução multiempresa (MVP)

Fonte da verdade: organização é o cliente do SaaS. Sem migração gradual, sem dupla escrita.

## Fase 1 — Fundação de dados (em andamento)
- [ ] Enums: platform_role, org_role, org_permission, status de org/assinatura/fatura/convite
- [ ] Tabelas: organizations, organization_memberships, organization_member_permissions,
      organization_invitations, platform_user_roles, case_access, plans, plan_entitlements,
      organization_subscriptions, organization_invoices, organization_invoice_items,
      organization_payments, organization_audit_log, support_access_grants
- [ ] Transferir super_admin/platform_admin de user_capabilities → platform_user_roles
- [ ] Funções de autorização (is_platform_role, has_platform_access, is_org_member,
      has_org_permission, org_role_default_permissions, user_can_access_case)
- [ ] Remover trigger que criava customer_accounts por usuário
- [ ] Seeds: planos Trial/Pro/Enterprise + entitlements

## Fase 2 — organization_id nas tabelas de domínio
- [ ] cases, documents, document_chunks, conversations, messages, tasks, events,
      proposals (drafts/versions/shares/attachments), publications, monitoring_terms,
      ai_usage_events, ai_session_events, ai_budgets, b2b_service_requests
- [ ] Limpar dados de teste
- [ ] Novas policies RLS baseadas em organização/permissão/caso

## Fase 3 — Backend (server functions)
- [ ] Substituir `.eq("user_id", context.userId)` por org + membership + permissão
- [ ] Middleware requireOrgPermission / requirePlatformRole
- [ ] MCP adaptado

## Fase 4 — UI
- [ ] Onboarding: criar organização (trial 30d) vs aceitar convite
- [ ] Seletor de organização + contexto ativo
- [ ] Equipe/permissões, faturamento (owner + billing_manager), contratar B2B
- [ ] Painel B2B com papéis de plataforma
- [ ] Navegação por permissão

## Fase 5 — Limpeza e validação
- [ ] Remover customer_accounts, team_members, team_invitations, user_capabilities
- [ ] Testes de isolamento (RLS + server fns)
- [ ] Regenerar tipos, build, typecheck

## Fase 6 — Reorganização da interface interna autenticada (nova solicitação)
- [ ] Barra lateral: Início, Casos, JurisMind AI, Meu trabalho, Biblioteca + seção "Módulos" (Monitoramento, Comercial) + rodapé (Serviços especializados, Administração, Ajuda, Perfil)
- [ ] Padronizar cabeçalho (breadcrumb, escritório atual, busca, notificações) e títulos de página
- [ ] Reconstruir "Início" (operacional: prazos, tarefas, casos recentes, docs em processamento, ações rápidas)
- [ ] Criar "Meu trabalho" (tarefas + agenda + hoje/atrasados, filtros, lista/quadro/calendário)
- [ ] Workspace do caso com abas: Visão geral, Documentos, JurisMind AI, Produção (Peças), Prazos e tarefas, Atividade
- [ ] Biblioteca (ex-Meus Documentos) com filtros por caso/status
- [ ] Monitoramento (ex-Publicações) com linguagem não técnica; Comercial contendo Propostas
- [ ] Remover Marketing, Conversas e Peças Jurídicas da navegação principal
- [ ] Tipografia mínima 13/14px, contraste, responsivo, acessibilidade
- [ ] Correções de coerência (botão "Editar dados" não destrutivo, sem textos técnicos, sem duplicar Google/Outlook)

## Fase 5 — concluída
- Backend multiempresa compilável: typecheck limpo, 52 testes passando.
- Conversas, publicações, geradores, notificações, B2B e callbacks OAuth migrados para `organization_id`.
- Dedupe de publicações agora por (organization_id, hash).

## Fase 6 — em andamento
- [x] Barra lateral reconstruída: Principal (Início, Casos, JurisMind AI, Meu trabalho, Biblioteca), Módulos (Monitoramento, Comercial), rodapé (Serviços especializados, Administração, Ajuda, Perfil).
- [x] Tipografia do menu ≥ 14px.
- [x] Tela do caso como workspace com abas (Visão geral, Documentos, JurisMind AI, Produção, Prazos e tarefas, Atividade).
- [x] "Início" operacional com dados reais e ações rápidas.
- [x] Tarefas + agenda unificados em "Meu trabalho" (Hoje/Tarefas/Prazos/Agenda/Atrasados + filtros).
- [x] Biblioteca com busca, filtros por caso/status e status compreensível.
- [x] Peças Jurídicas incorporado em Produção via `PieceGenerator`; Google/Outlook apenas em Administração → Integrações (callbacks redirecionam para /integracoes).
- [x] Auditoria de navegação: sem Marketing/Conversas/Peças no menu, sem "Ajuda" duplicada no rodapé.

## Upload e leitura de documentos no Novo caso (concluído)
- Limite único de 250 MB (`src/lib/documents-limits.ts`), validado também no servidor ao gerar o link de envio.
- Documento enviado passa a ter registro próprio (`case_intake_documents`): a leitura roda no servidor, sobrevive a fechar a página e é retomada se travar.
- Leitura de PDF por faixas (`src/lib/rag/pdf-range.server.ts`): até 20 páginas para preencher o formulário, sem baixar o arquivo inteiro.
- Reconhecimento de imagem progressivo apenas nas páginas sem texto; botão "Ler como imagem" para digitalizados.
- Fila durável de leitura completa (`document_index_jobs`) acionada na criação do trabalho, sem verificação periódica do banco; processador em `/api/public/jobs/run` protegido por chave interna.
- Conversão do documento em documento do caso reaproveita o mesmo arquivo (sem novo envio ou download).
- Verificado de ponta a ponta em ambiente real: fila → leitura → extração dos dados do processo → indexação (status "pronto").

## Correção incremental — intake de documentos grandes
- [x] Acionamento confiável do processador após upload e retomada de itens parados.
- [x] Extração rápida inicial + complementação de até 20 páginas com resultado parcial persistido.
- [x] Preenchimento progressivo sem sobrescrever edições manuais.
- [x] Indicador global minimizado com retomada do cadastro.
- [x] Cancelamento real com descarte do arquivo e limpeza do rascunho.
- [x] Validação real do PDF grande: parte 1 reservada e retomada com afinidade, 191 páginas verificadas e partes 2–11 mantidas aguardando.

## Ajustes homepage (concluídos)
- [x] Logo no header deve ter cérebro branco no modo escuro (contraste com fundo navy).
- [x] HeroCarousel deve ser o hero integral da página, não um painel lateral ao lado do texto "Do documento à entrega".
