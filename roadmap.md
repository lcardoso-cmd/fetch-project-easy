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
- [ ] Tela do caso como workspace com abas.
- [ ] Reconstruir "Início" operacional.
- [ ] Unificar tarefas + agenda em "Meu trabalho".
- [ ] Biblioteca com filtros e status compreensível.
