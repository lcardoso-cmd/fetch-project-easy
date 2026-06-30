import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  color: z.string().trim().max(20).optional().or(z.literal("")),
});

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_members")
      .select("*")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MemberSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("team_members")
      .insert({
        user_id: context.userId,
        name: data.name,
        email: data.email || null,
        role: data.role || null,
        color: data.color || null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).merge(MemberSchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;
    const { data: row, error } = await context.supabase
      .from("team_members")
      .update({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.email !== undefined ? { email: updates.email || null } : {}),
        ...(updates.role !== undefined ? { role: updates.role || null } : {}),
        ...(updates.color !== undefined ? { color: updates.color || null } : {}),
      })
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
