GRANT EXECUTE ON FUNCTION public.user_can_access_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;