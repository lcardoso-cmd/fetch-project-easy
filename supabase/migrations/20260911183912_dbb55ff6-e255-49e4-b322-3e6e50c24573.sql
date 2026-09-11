CREATE OR REPLACE FUNCTION public.decide_case_update_proposal(_proposal_id uuid, _decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _proposal public.case_update_proposals;
  _case public.cases;
  _allowed jsonb;
  _previous jsonb;
BEGIN
  IF _decision NOT IN ('applied', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  SELECT * INTO _proposal
  FROM public.case_update_proposals
  WHERE id = _proposal_id
  FOR UPDATE;

  IF _proposal.id IS NULL OR _proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'Proposta não encontrada ou já decidida';
  END IF;
  IF NOT public.user_can_edit_case(_proposal.case_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para editar este caso';
  END IF;

  SELECT * INTO _case FROM public.cases WHERE id = _proposal.case_id FOR UPDATE;
  _allowed := jsonb_strip_nulls(jsonb_build_object(
    'case_number', _proposal.proposed_values->'case_number',
    'jurisdiction', _proposal.proposed_values->'jurisdiction'
  ));
  _previous := jsonb_build_object(
    'case_number', _case.case_number,
    'jurisdiction', _case.jurisdiction
  );

  IF _decision = 'applied' THEN
    UPDATE public.cases
    SET case_number = CASE WHEN _allowed ? 'case_number' THEN _allowed->>'case_number' ELSE case_number END,
        jurisdiction = CASE WHEN _allowed ? 'jurisdiction' THEN _allowed->>'jurisdiction' ELSE jurisdiction END
    WHERE id = _proposal.case_id;
  END IF;

  UPDATE public.case_update_proposals
  SET status = _decision,
      decided_by_user_id = auth.uid(),
      decided_at = now()
  WHERE id = _proposal.id;

  INSERT INTO public.case_update_audit (
    organization_id, case_id, proposal_id, actor_user_id, action,
    previous_values, applied_values, source_refs
  ) VALUES (
    _proposal.organization_id, _proposal.case_id, _proposal.id, auth.uid(), _decision,
    _previous, CASE WHEN _decision = 'applied' THEN _allowed ELSE '{}'::jsonb END,
    _proposal.source_refs
  );

  RETURN jsonb_build_object('ok', true, 'status', _decision, 'applied_values', _allowed);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_case_update_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_case_update_proposal(uuid, text) TO authenticated, service_role;