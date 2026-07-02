import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITY_TYPES = ["pessoa_fisica", "pessoa_juridica"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const SELECT_COLS =
  "id, full_name, entity_type, firm_name, tax_id, firm_address, firm_website, logo_path";

export type FirmProfile = {
  entity_type: EntityType;
  firm_name: string | null;
  tax_id: string | null;
  firm_address: string | null;
  firm_website: string | null;
  logo_path: string | null;
  logo_url: string | null;
  full_name: string | null;
};

async function signLogo(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("firm-logos")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export const getFirmProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FirmProfile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(SELECT_COLS)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const row = data ?? {
      full_name: null,
      entity_type: "pessoa_fisica" as EntityType,
      firm_name: null,
      tax_id: null,
      firm_address: null,
      firm_website: null,
      logo_path: null,
    };
    const logo_url = await signLogo(context.supabase, row.logo_path);
    return {
      entity_type: (row.entity_type as EntityType) ?? "pessoa_fisica",
      firm_name: row.firm_name ?? null,
      tax_id: row.tax_id ?? null,
      firm_address: row.firm_address ?? null,
      firm_website: row.firm_website ?? null,
      logo_path: row.logo_path ?? null,
      logo_url,
      full_name: row.full_name ?? null,
    };
  });

export const updateFirmProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        entity_type: z.enum(ENTITY_TYPES),
        firm_name: z.string().trim().max(200).optional().nullable(),
        tax_id: z.string().trim().max(40).optional().nullable(),
        firm_address: z.string().trim().max(400).optional().nullable(),
        firm_website: z.string().trim().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("profiles")
      .upsert({ id: context.userId }, { onConflict: "id" });
    const { error } = await context.supabase
      .from("profiles")
      .update({
        entity_type: data.entity_type,
        firm_name: data.firm_name ?? null,
        tax_id: data.tax_id ?? null,
        firm_address: data.firm_address ?? null,
        firm_website: data.firm_website ?? null,
      })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setFirmLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ path: z.string().min(1).max(300) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // path deve começar com o userId (a política de storage garante o mesmo)
    const [folder] = data.path.split("/");
    if (folder !== context.userId) {
      throw new Error("Caminho de logo inválido");
    }
    // Remove logo antigo, se diferente
    const { data: prev } = await context.supabase
      .from("profiles")
      .select("logo_path")
      .eq("id", context.userId)
      .maybeSingle();
    const previous = prev?.logo_path ?? null;
    if (previous && previous !== data.path) {
      await context.supabase.storage.from("firm-logos").remove([previous]);
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ logo_path: data.path })
      .eq("id", context.userId);
    if (error) throw error;
    const logo_url = await signLogo(context.supabase, data.path);
    return { ok: true, logo_url };
  });

export const removeFirmLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prev } = await context.supabase
      .from("profiles")
      .select("logo_path")
      .eq("id", context.userId)
      .maybeSingle();
    if (prev?.logo_path) {
      await context.supabase.storage.from("firm-logos").remove([prev.logo_path]);
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ logo_path: null })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
