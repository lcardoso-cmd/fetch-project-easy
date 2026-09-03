-- =====================================================================
-- FASE 2 — organization_id como vínculo obrigatório
-- =====================================================================

-- 1) LIMPEZA DOS DADOS DE TESTE (autorizada: MVP sem operação ativa)
TRUNCATE TABLE
  public.rag_retrieval_events,
  public.mcp_tool_audit_log,
  public.ai_session_events,
  public.ai_usage_events,
  public.ai_chat_messages,
  public.ai_chat_threads,
  public.publication_term_matches,
  public.publication_fetch_log,
  public.publications,
  public.monitoring_terms,
  public.proposal_shares,
  public.proposal_versions,
  public.proposal_drafts,
  public.proposal_attachments,
  public.message_tasks,
  public.message_mentions,
  public.messages,
  public.conversation_participants,
  public.conversations,
  public.tasks,
  public.events,
  public.document_audit_events,
  public.document_chunks,
  public.documents,
  public.case_quesitos,
  public.case_access,
  public.cases,
  public.b2b_service_request_attachments,
  public.b2b_service_request_events,
  public.b2b_service_requests,
  public.google_connections,
  public.outlook_connections,
  public.google_oauth_states,
  public.outlook_oauth_states
CASCADE;

-- 2) REMOVER TODAS AS POLICIES ANTIGAS DAS TABELAS DE DOMÍNIO
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'cases','case_quesitos','documents','document_chunks','document_audit_events',
      'conversations','conversation_participants','messages','message_mentions','message_tasks',
      'tasks','events','proposal_drafts','proposal_versions','proposal_shares','proposal_attachments',
      'publications','publication_fetch_log','publication_term_matches','monitoring_terms',
      'ai_chat_threads','ai_chat_messages','ai_usage_events','ai_session_events',
      'rag_retrieval_events','mcp_tool_audit_log','b2b_service_requests',
      'b2b_service_request_events','b2b_service_request_attachments',
      'google_connections','outlook_connections','ai_budgets'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) POLICIES DE STORAGE E FUNÇÕES ANTIGAS BASEADAS EM user_id
DROP POLICY IF EXISTS "Team members can read shared case documents" ON storage.objects;
DROP POLICY IF EXISTS "Team editors can delete shared case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

DROP FUNCTION IF EXISTS public.hybrid_search_chunks(extensions.vector, text, uuid, uuid, uuid[], integer, integer);
DROP FUNCTION IF EXISTS public.match_chunks(extensions.vector, integer, uuid);
DROP FUNCTION IF EXISTS public.match_chunks_scoped(extensions.vector, uuid, uuid, uuid[], integer);
DROP FUNCTION IF EXISTS public.hybrid_search_chunks_v2(extensions.vector, text, uuid, text, uuid[], integer, integer);
DROP FUNCTION IF EXISTS public.fetch_chunk_neighbors(uuid, uuid[], integer[]);
DROP FUNCTION IF EXISTS public.user_can_access_case(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_can_edit_case(uuid, uuid);

-- 4) ESTRUTURA: autoria + organização
ALTER TABLE public.cases RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.cases DROP COLUMN IF EXISTS team_member_ids;
ALTER TABLE public.cases ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_cases_org ON public.cases(organization_id);

ALTER TABLE public.case_quesitos RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.case_quesitos ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.documents RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.documents ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_documents_org ON public.documents(organization_id);

ALTER TABLE public.document_chunks RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.document_chunks ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_document_chunks_org ON public.document_chunks(organization_id);

ALTER TABLE public.document_audit_events RENAME COLUMN user_id TO actor_user_id;
ALTER TABLE public.document_audit_events ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.conversations ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_participants ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.message_mentions ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tasks RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.tasks ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.events RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.events ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.proposal_drafts RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.proposal_drafts ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_versions RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.proposal_versions ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_shares RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.proposal_shares ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_attachments RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.proposal_attachments ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.publications RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.publications ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.publication_fetch_log RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.publication_fetch_log ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.monitoring_terms RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.monitoring_terms ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.publication_term_matches ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.ai_chat_threads RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE public.ai_chat_threads ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_chat_messages ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.ai_usage_events ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_session_events ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.rag_retrieval_events ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.mcp_tool_audit_log ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.b2b_service_requests ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.google_connections ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.outlook_connections ADD COLUMN organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- orçamento de IA passa a ser da organização
DROP TABLE public.ai_budgets;
CREATE TABLE public.ai_budgets (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_limit_usd numeric NOT NULL DEFAULT 50,
  warn_threshold_pct integer NOT NULL DEFAULT 80,
  max_tokens integer NOT NULL DEFAULT 4096,
  max_context_chars integer NOT NULL DEFAULT 120000,
  max_retries integer NOT NULL DEFAULT 2,
  force_fallback_on_retry boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_budgets TO authenticated;
GRANT ALL ON public.ai_budgets TO service_role;
ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ai_budgets_updated BEFORE UPDATE ON public.ai_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) HELPERS DE ACESSO
CREATE OR REPLACE FUNCTION public.support_can_read(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants g
    WHERE g.organization_id = _organization_id
      AND g.support_user_id = _user_id
      AND g.revoked_at IS NULL
      AND now() BETWEEN g.starts_at AND g.expires_at
  );
$$;

CREATE OR REPLACE FUNCTION public.case_organization(_case_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.cases WHERE id = _case_id;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_case(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id
      AND public.is_org_member(c.organization_id, _user_id)
      AND (
        c.created_by_user_id = _user_id
        OR public.has_org_permission(c.organization_id, _user_id, 'cases.view_all')
        OR EXISTS (SELECT 1 FROM public.case_access a WHERE a.case_id = _case_id AND a.user_id = _user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_case(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id
      AND public.is_org_member(c.organization_id, _user_id)
      AND (
        c.created_by_user_id = _user_id
        OR public.has_org_permission(c.organization_id, _user_id, 'cases.manage_all')
        OR EXISTS (
          SELECT 1 FROM public.case_access a
          WHERE a.case_id = _case_id AND a.user_id = _user_id
            AND a.access_level IN ('editor','manager')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.support_can_read(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.case_organization(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_access_case(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_edit_case(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_can_read(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.case_organization(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_case(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_edit_case(uuid, uuid) TO authenticated, service_role;

-- 6) RAG RPCs escopadas por organização + caso
CREATE OR REPLACE FUNCTION public.hybrid_search_chunks_v2(
  query_embedding extensions.vector,
  query_text text,
  filter_organization_id uuid,
  filter_case_id uuid DEFAULT NULL,
  keyword_text text DEFAULT NULL,
  filter_doc_ids uuid[] DEFAULT NULL,
  match_count integer DEFAULT 24,
  rrf_k integer DEFAULT 60
)
RETURNS TABLE(id uuid, document_id uuid, case_id uuid, chunk_index integer, content text,
  source_kind text, page_start integer, page_end integer, section_title text, sheet_name text,
  row_start integer, row_end integer, chunking_version text,
  vector_similarity double precision, fts_rank double precision, score double precision)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  WITH base AS (
    SELECT c.* FROM public.document_chunks c
    WHERE c.organization_id = filter_organization_id
      AND public.is_org_member(filter_organization_id, auth.uid())
      AND (filter_case_id IS NULL OR c.case_id = filter_case_id)
      AND public.user_can_access_case(c.case_id, auth.uid())
      AND (filter_doc_ids IS NULL OR c.document_id = ANY (filter_doc_ids))
  ),
  v AS (
    SELECT b.id, 1 - (b.embedding <=> query_embedding) AS vector_similarity,
           ROW_NUMBER() OVER (ORDER BY b.embedding <=> query_embedding) AS rn
    FROM base b ORDER BY b.embedding <=> query_embedding LIMIT match_count * 3
  ),
  f AS (
    SELECT b.id, ts_rank(b.content_tsv, plainto_tsquery('portuguese', query_text)) AS fts_rank,
           ROW_NUMBER() OVER (ORDER BY ts_rank(b.content_tsv, plainto_tsquery('portuguese', query_text)) DESC) AS rn
    FROM base b WHERE b.content_tsv @@ plainto_tsquery('portuguese', query_text)
    ORDER BY fts_rank DESC LIMIT match_count * 3
  ),
  kw AS (
    SELECT b.id, ts_rank(b.content_tsv, plainto_tsquery('portuguese', keyword_text)) AS kw_rank,
           ROW_NUMBER() OVER (ORDER BY ts_rank(b.content_tsv, plainto_tsquery('portuguese', keyword_text)) DESC) AS rn
    FROM base b
    WHERE keyword_text IS NOT NULL AND length(btrim(keyword_text)) > 0
      AND b.content_tsv @@ plainto_tsquery('portuguese', keyword_text)
    ORDER BY kw_rank DESC LIMIT match_count * 3
  ),
  fused AS (
    SELECT COALESCE(v.id, f.id, kw.id) AS id,
           COALESCE(v.vector_similarity, 0) AS vector_similarity,
           GREATEST(COALESCE(f.fts_rank, 0), COALESCE(kw.kw_rank, 0)) AS fts_rank,
           (CASE WHEN v.rn IS NOT NULL THEN 1.0 / (rrf_k + v.rn) ELSE 0 END) +
           (CASE WHEN f.rn IS NOT NULL THEN 1.0 / (rrf_k + f.rn) ELSE 0 END) +
           (CASE WHEN kw.rn IS NOT NULL THEN 0.5 / (rrf_k + kw.rn) ELSE 0 END) AS score
    FROM v FULL OUTER JOIN f ON f.id = v.id
    FULL OUTER JOIN kw ON kw.id = COALESCE(v.id, f.id)
  )
  SELECT b.id, b.document_id, b.case_id, b.chunk_index, b.content, b.source_kind,
         b.page_start, b.page_end, b.section_title, b.sheet_name, b.row_start, b.row_end,
         b.chunking_version, fused.vector_similarity, fused.fts_rank, fused.score
  FROM fused JOIN base b ON b.id = fused.id
  ORDER BY fused.score DESC LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.fetch_chunk_neighbors(
  filter_organization_id uuid, filter_case_id uuid, doc_ids uuid[], chunk_indexes integer[]
)
RETURNS TABLE(id uuid, document_id uuid, case_id uuid, chunk_index integer, content text,
  source_kind text, page_start integer, page_end integer, section_title text, sheet_name text,
  row_start integer, row_end integer, chunking_version text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.id, c.document_id, c.case_id, c.chunk_index, c.content, c.source_kind,
         c.page_start, c.page_end, c.section_title, c.sheet_name, c.row_start, c.row_end,
         c.chunking_version
  FROM public.document_chunks c
  JOIN unnest(doc_ids, chunk_indexes) AS t(doc_id, idx)
    ON t.doc_id = c.document_id AND t.idx = c.chunk_index
  WHERE c.organization_id = filter_organization_id
    AND c.case_id = filter_case_id
    AND public.is_org_member(filter_organization_id, auth.uid())
    AND public.user_can_access_case(filter_case_id, auth.uid());
$$;

-- 7) POLICIES NOVAS
CREATE POLICY cases_select ON public.cases FOR SELECT TO authenticated
USING (public.user_can_access_case(id, auth.uid()) OR public.support_can_read(organization_id, auth.uid()));
CREATE POLICY cases_insert ON public.cases FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'cases.create')
  AND created_by_user_id = auth.uid()
);
CREATE POLICY cases_update ON public.cases FOR UPDATE TO authenticated
USING (public.user_can_edit_case(id, auth.uid()))
WITH CHECK (public.user_can_edit_case(id, auth.uid()));
CREATE POLICY cases_delete ON public.cases FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'cases.delete'));

CREATE POLICY quesitos_select ON public.case_quesitos FOR SELECT TO authenticated
USING (public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY quesitos_write ON public.case_quesitos FOR ALL TO authenticated
USING (public.user_can_edit_case(case_id, auth.uid()))
WITH CHECK (public.user_can_edit_case(case_id, auth.uid()));

CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
USING (public.user_can_access_case(case_id, auth.uid()) OR public.support_can_read(organization_id, auth.uid()));
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND public.user_can_access_case(case_id, auth.uid())
  AND created_by_user_id = auth.uid()
);
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
USING (public.user_can_edit_case(case_id, auth.uid()))
WITH CHECK (public.user_can_edit_case(case_id, auth.uid()));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'documents.delete')
  AND public.user_can_access_case(case_id, auth.uid())
);

CREATE POLICY chunks_select ON public.document_chunks FOR SELECT TO authenticated
USING (public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY chunks_write ON public.document_chunks FOR ALL TO authenticated
USING (public.user_can_edit_case(case_id, auth.uid()))
WITH CHECK (public.user_can_edit_case(case_id, auth.uid()));

CREATE POLICY doc_audit_select ON public.document_audit_events FOR SELECT TO authenticated
USING (public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY doc_audit_insert ON public.document_audit_events FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_case(case_id, auth.uid()) AND actor_user_id = auth.uid());

CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       AND public.is_conversation_participant(id, auth.uid()));
CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated
USING (public.is_conversation_participant(id, auth.uid()))
WITH CHECK (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY participants_select ON public.conversation_participants FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY participants_insert ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY participants_update ON public.conversation_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY mentions_select ON public.message_mentions FOR SELECT TO authenticated
USING (mentioned_user_id = auth.uid()
       OR public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY mentions_insert ON public.message_mentions FOR INSERT TO authenticated
WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY mentions_update ON public.message_mentions FOR UPDATE TO authenticated
USING (mentioned_user_id = auth.uid()) WITH CHECK (mentioned_user_id = auth.uid());

CREATE POLICY message_tasks_all ON public.message_tasks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
               AND public.is_conversation_participant(m.conversation_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
               AND public.is_conversation_participant(m.conversation_id, auth.uid())));

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (
    created_by_user_id = auth.uid() OR assigned_to_user_id = auth.uid()
    OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all')
    OR (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()))
  )
);
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by_user_id = auth.uid());
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (created_by_user_id = auth.uid() OR assigned_to_user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'cases.manage_all'))
)
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
USING (created_by_user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'cases.manage_all'));

CREATE POLICY events_select ON public.events FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (created_by_user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all')
       OR (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid())))
);
CREATE POLICY events_write ON public.events FOR ALL TO authenticated
USING (created_by_user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'cases.manage_all'))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by_user_id = auth.uid());

CREATE POLICY proposal_drafts_all ON public.proposal_drafts FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'proposals.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'proposals.use')
            AND created_by_user_id = auth.uid());
CREATE POLICY proposal_versions_all ON public.proposal_versions FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'proposals.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'proposals.use')
            AND created_by_user_id = auth.uid());
CREATE POLICY proposal_shares_all ON public.proposal_shares FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'proposals.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'proposals.use')
            AND created_by_user_id = auth.uid());
CREATE POLICY proposal_attachments_all ON public.proposal_attachments FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'proposals.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'proposals.use')
            AND created_by_user_id = auth.uid());

CREATE POLICY publications_all ON public.publications FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'publications.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'publications.use'));
CREATE POLICY monitoring_terms_all ON public.monitoring_terms FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'publications.use'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'publications.use')
            AND created_by_user_id = auth.uid());
CREATE POLICY publication_fetch_log_select ON public.publication_fetch_log FOR SELECT TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'publications.use'));
CREATE POLICY publication_matches_select ON public.publication_term_matches FOR SELECT TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'publications.use'));
CREATE POLICY publication_matches_insert ON public.publication_term_matches FOR INSERT TO authenticated
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'publications.use'));
CREATE POLICY publication_matches_delete ON public.publication_term_matches FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'publications.use'));

CREATE POLICY ai_threads_all ON public.ai_chat_threads FOR ALL TO authenticated
USING (public.user_can_access_case(case_id, auth.uid())
       AND public.has_org_permission(organization_id, auth.uid(), 'ai.use'))
WITH CHECK (public.user_can_access_case(case_id, auth.uid())
       AND public.has_org_permission(organization_id, auth.uid(), 'ai.use')
       AND created_by_user_id = auth.uid());
CREATE POLICY ai_messages_all ON public.ai_chat_messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ai_chat_threads t WHERE t.id = thread_id
               AND public.user_can_access_case(t.case_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.ai_chat_threads t WHERE t.id = thread_id
               AND public.user_can_access_case(t.case_id, auth.uid()))
            AND user_id = auth.uid());

CREATE POLICY ai_usage_select ON public.ai_usage_events FOR SELECT TO authenticated
USING (
  (user_id = auth.uid() AND public.has_org_permission(organization_id, auth.uid(), 'usage.view_self'))
  OR public.has_org_permission(organization_id, auth.uid(), 'usage.view_organization')
  OR public.has_platform_role(auth.uid(), 'platform_admin')
);
CREATE POLICY ai_usage_insert ON public.ai_usage_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY ai_session_select ON public.ai_session_events FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'usage.view_organization'));
CREATE POLICY ai_session_insert ON public.ai_session_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY rag_events_select ON public.rag_retrieval_events FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'usage.view_organization'));
CREATE POLICY rag_events_insert ON public.rag_retrieval_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY mcp_audit_select ON public.mcp_tool_audit_log FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'usage.view_organization'));
CREATE POLICY mcp_audit_insert ON public.mcp_tool_audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY ai_budgets_select ON public.ai_budgets FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       OR public.has_platform_role(auth.uid(), 'platform_admin'));
CREATE POLICY ai_budgets_write ON public.ai_budgets FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'usage.manage_budget'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'usage.manage_budget'));

CREATE POLICY google_conn_select ON public.google_connections FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'integrations.view'));
CREATE POLICY google_conn_write ON public.google_connections FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.has_org_permission(organization_id, auth.uid(), 'integrations.manage'))
WITH CHECK (user_id = auth.uid() AND public.has_org_permission(organization_id, auth.uid(), 'integrations.manage'));

CREATE POLICY outlook_conn_select ON public.outlook_connections FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_permission(organization_id, auth.uid(), 'integrations.view'));
CREATE POLICY outlook_conn_write ON public.outlook_connections FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.has_org_permission(organization_id, auth.uid(), 'integrations.manage'))
WITH CHECK (user_id = auth.uid() AND public.has_org_permission(organization_id, auth.uid(), 'integrations.manage'));

CREATE POLICY b2b_requests_select ON public.b2b_service_requests FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'services.view')
  OR public.has_platform_role(auth.uid(), 'platform_operations')
);
CREATE POLICY b2b_requests_insert ON public.b2b_service_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'services.request')
  AND requester_user_id = auth.uid()
);
CREATE POLICY b2b_requests_update ON public.b2b_service_requests FOR UPDATE TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_operations'))
WITH CHECK (public.has_platform_role(auth.uid(), 'platform_operations'));

CREATE POLICY b2b_events_select ON public.b2b_service_request_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
    AND (
      (public.has_org_permission(r.organization_id, auth.uid(), 'services.view') AND kind <> 'note_internal')
      OR public.has_platform_role(auth.uid(), 'platform_operations')
    )
));
CREATE POLICY b2b_events_insert ON public.b2b_service_request_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
    AND (
      (public.has_org_permission(r.organization_id, auth.uid(), 'services.request') AND kind = 'note_public')
      OR public.has_platform_role(auth.uid(), 'platform_operations')
    )
));

CREATE POLICY b2b_attachments_select ON public.b2b_service_request_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
    AND (
      (public.has_org_permission(r.organization_id, auth.uid(), 'services.view') AND visibility = 'client')
      OR public.has_platform_role(auth.uid(), 'platform_operations')
    )
));
CREATE POLICY b2b_attachments_insert ON public.b2b_service_request_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by_user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
    AND (
      public.has_org_permission(r.organization_id, auth.uid(), 'services.request')
      OR public.has_platform_role(auth.uid(), 'platform_operations')
    )
));
CREATE POLICY b2b_attachments_delete ON public.b2b_service_request_attachments FOR DELETE TO authenticated
USING (uploaded_by_user_id = auth.uid() OR public.has_platform_role(auth.uid(), 'platform_operations'));

-- 8) STORAGE: documentos por organização (path = {organization_id}/...)
CREATE POLICY documents_storage_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND (
    NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.storage_path = name)
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = name AND public.user_can_access_case(d.case_id, auth.uid())
    )
  )
);
CREATE POLICY documents_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'documents.upload')
);
CREATE POLICY documents_storage_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'documents.upload')
);
CREATE POLICY documents_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'documents.delete')
);