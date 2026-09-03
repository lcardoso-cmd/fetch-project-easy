import {
  ORG_PERMISSION_LABELS,
  PLATFORM_ROLE_LABELS,
  type OrgPermission,
  type PlatformRole,
} from "@/lib/org-permissions";
import { CAPABILITY_LABELS, type Capability } from "@/lib/capabilities.functions";

export type AccessRequirement = OrgPermission | PlatformRole | Capability;

/**
 * Rótulo humano de qualquer exigência de acesso (permissão de organização,
 * papel da B2B ou capacidade legada). Fonte única usada por telas de
 * "sem permissão" e pelos pedidos de acesso.
 */
export function accessLabel(requirement?: AccessRequirement | null): string | null {
  if (!requirement) return null;
  return (
    (ORG_PERMISSION_LABELS as Record<string, string>)[requirement] ??
    (PLATFORM_ROLE_LABELS as Record<string, string>)[requirement] ??
    (CAPABILITY_LABELS as Record<string, string>)[requirement] ??
    requirement
  );
}

/** A exigência pertence à administração B2B (não ao escritório)? */
export function isPlatformRequirement(requirement?: AccessRequirement | null): boolean {
  if (!requirement) return false;
  return requirement in PLATFORM_ROLE_LABELS;
}
