import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const CaseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  client_name: z.string().max(200).optional(),
  status: z.enum(["active", "archived", "closed"]).default("active"),
});

export const getCases = createServerFn({ method: "GET" }).handler(async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
});

export const getCase = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: caseData, error } = await supabase
      .from("cases")
      .select("*, documents(*), events(*)")
      .eq("id", data.id)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;
    return caseData;
  });

export const createCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CaseSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: newCase, error } = await supabase
      .from("cases")
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        client_name: data.client_name,
        status: data.status,
      })
      .select()
      .single();

    if (error) throw error;
    return newCase;
  });

export const updateCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        client_name: z.string().max(200).optional(),
        status: z.enum(["active", "archived", "closed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { id, ...updates } = data;
    const { data: updatedCase, error } = await supabase
      .from("cases")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return updatedCase;
  });

export const deleteCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { error } = await supabase.from("cases").delete().eq("id", data.id).eq("user_id", user.id);
    if (error) throw error;
    return { success: true };
  });
