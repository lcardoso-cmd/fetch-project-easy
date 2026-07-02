import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyCapabilities, type Capability } from "@/lib/capabilities.functions";
import { useAuth } from "@/hooks/use-auth";

const SIM_KEY = "jm.viewAsCapabilities";

/**
 * Presets de simulação usados pelo super_admin no menu "Ver como…".
 * A simulação é apenas visual (filtro de UI); o servidor continua
 * autorizando pelas capacidades REAIS do usuário logado.
 */
export const VIEW_AS_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  caps: Capability[];
}> = [
  {
    id: "super_admin",
    label: "Super admin (real)",
    description: "Sua visão real como dono do SaaS — tudo liberado.",
    caps: [],
  },
  {
    id: "platform_admin",
    label: "Admin da plataforma B2B",
    description: "Equipe interna da JurisMind com acesso à área da plataforma.",
    caps: ["platform_admin"],
  },
  {
    id: "office_admin",
    label: "Dono do escritório",
    description: "Gestor do escritório cliente: equipe, integrações e configurações.",
    caps: ["office_admin", "cases", "commercial", "marketing"],
  },
  {
    id: "lawyer",
    label: "Advogado operador",
    description: "Advogado que trabalha em casos, sem acesso comercial/marketing.",
    caps: ["cases"],
  },
  {
    id: "expert",
    label: "Perito",
    description: "Perito com acesso a pareceres técnicos.",
    caps: ["expert_opinion", "cases"],
  },
  {
    id: "commercial",
    label: "Comercial",
    description: "Responsável por propostas comerciais.",
    caps: ["commercial", "cases"],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Responsável por marketing e publicações.",
    caps: ["marketing"],
  },
  {
    id: "empty",
    label: "Usuário recém-convidado",
    description: "Sem nenhuma permissão além do básico.",
    caps: [],
  },
];

export function useCapabilities() {
  const { user } = useAuth();
  const fn = useServerFn(getMyCapabilities);
  const query = useQuery({
    queryKey: ["my-capabilities", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const real = useMemo(() => query.data ?? [], [query.data]);
  const isSuperAdmin = real.includes("super_admin");

  const [simulation, setSimulationState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(SIM_KEY);
  });

  useEffect(() => {
    // Simulação só se aplica ao super admin.
    if (!isSuperAdmin && simulation) {
      window.sessionStorage.removeItem(SIM_KEY);
      setSimulationState(null);
    }
  }, [isSuperAdmin, simulation]);

  const setSimulation = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    if (!id || id === "super_admin") {
      window.sessionStorage.removeItem(SIM_KEY);
      setSimulationState(null);
    } else {
      window.sessionStorage.setItem(SIM_KEY, id);
      setSimulationState(id);
    }
  }, []);

  const activePreset = useMemo(
    () => (simulation ? VIEW_AS_PRESETS.find((p) => p.id === simulation) ?? null : null),
    [simulation],
  );

  const effective = useMemo<Capability[]>(() => {
    if (isSuperAdmin && activePreset) return activePreset.caps;
    return real;
  }, [isSuperAdmin, activePreset, real]);

  const effectiveSet = useMemo(() => new Set<Capability>(effective), [effective]);

  const has = useCallback((c: Capability) => effectiveSet.has(c), [effectiveSet]);
  const hasAny = useCallback(
    (...cs: Capability[]) => cs.some((c) => effectiveSet.has(c)),
    [effectiveSet],
  );

  return {
    capabilities: effective,
    real,
    isLoading: query.isLoading,
    isSuperAdmin,
    has,
    hasAny,
    simulation,
    activePreset,
    setSimulation,
    clearSimulation: () => setSimulation(null),
  };
}
