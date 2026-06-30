import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { useAuth } from "@/hooks/use-auth";

/**
 * Carrega o perfil profissional do usuário autenticado.
 * Auto-cria a linha em `profiles` se ainda não existir.
 */
export function useProfile() {
  const { user } = useAuth();
  const getProfileFn = useServerFn(getMyProfile);
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfileFn(),
    enabled: !!user,
    staleTime: 60_000,
  });
}
