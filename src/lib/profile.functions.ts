import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRACTICE_TYPES = ["advogado", "perito_judicial", "assistente_tecnico"] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

const PracticeTypeEnum = z.enum(PRACTICE_TYPES);

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, oab_number, phone, practice_type, specialty, onboarding_completed")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw error;

    // Auto-cria o perfil se ainda não existir (primeiro login).
    if (!data) {
      const { data: created, error: insErr } = await context.supabase
        .from("profiles")
        .insert({ id: context.userId })
        .select(
          "id, full_name, oab_number, phone, practice_type, specialty, onboarding_completed",
        )
        .single();
      if (insErr) throw insErr;
      return created;
    }
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        full_name: z.string().trim().max(160).optional().nullable(),
        oab_number: z.string().trim().max(40).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        practice_type: PracticeTypeEnum.optional(),
        specialty: z.string().trim().max(120).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId)
      .select(
        "id, full_name, oab_number, phone, practice_type, specialty, onboarding_completed",
      )
      .single();
    if (error) throw error;
    return updated;
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        practice_type: PracticeTypeEnum,
        specialty: z.string().trim().max(120).optional().nullable(),
        full_name: z.string().trim().max(160).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Garante que o perfil exista antes do update (caso o usuário pule getMyProfile).
    await context.supabase
      .from("profiles")
      .upsert({ id: context.userId }, { onConflict: "id" });

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({
        practice_type: data.practice_type,
        specialty: data.specialty ?? null,
        full_name: data.full_name ?? null,
        onboarding_completed: true,
      })
      .eq("id", context.userId)
      .select(
        "id, full_name, oab_number, phone, practice_type, specialty, onboarding_completed",
      )
      .single();
    if (error) throw error;
    return updated;
  });
