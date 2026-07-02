import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCapabilities, type Capability } from "@/lib/capabilities.functions";
import { useAuth } from "@/hooks/use-auth";

export function useCapabilities() {
  const { user } = useAuth();
  const fn = useServerFn(getMyCapabilities);
  const query = useQuery({
    queryKey: ["my-capabilities", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const set = new Set<Capability>(query.data ?? []);
  const has = (c: Capability) => set.has(c);
  const hasAny = (...cs: Capability[]) => cs.some((c) => set.has(c));
  return {
    capabilities: query.data ?? [],
    isLoading: query.isLoading,
    has,
    hasAny,
  };
}
