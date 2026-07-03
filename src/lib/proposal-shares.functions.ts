import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapability } from "@/lib/capability-middleware";
import { hashSharePassword } from "@/lib/proposal-shares-crypto";

export interface ProposalShare {
  id: string;
  token: string;
  title: string;
  client_name: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  has_password: boolean;
  created_at: string;
}

const pageConfigSchema = z
  .object({
    format: z.enum(["A4", "Letter"]).optional(),
    orientation: z.enum(["portrait", "landscape"]).optional(),
    margins: z
      .object({
        top: z.number().optional(),
        right: z.number().optional(),
        bottom: z.number().optional(),
        left: z.number().optional(),
      })
      .optional(),
  })
  .optional();

const coverSchema = z
  .object({
    clientName: z.string().max(300).optional(),
    clientDocument: z.string().max(300).optional(),
    clientAddress: z.string().max(300).optional(),
    matter: z.string().max(300).optional(),
    reference: z.string().max(300).optional(),
    date: z.string().max(300).optional(),
  })
  .nullable()
  .optional();

const watermarkSchema = z
  .object({ text: z.string().max(60), opacity: z.number().optional() })
  .nullable()
  .optional();

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}


function mapRow(row: {
  id: string;
  token: string;
  title: string;
  client_name: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  password_hash: string | null;
  created_at: string;
}): ProposalShare {
  return {
    id: row.id,
    token: row.token,
    title: row.title,
    client_name: row.client_name,
    max_downloads: row.max_downloads,
    download_count: row.download_count,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_accessed_at: row.last_accessed_at,
    has_password: !!row.password_hash,
    created_at: row.created_at,
  };
}

export const createProposalShare = createServerFn({ method: "POST" })
  .middleware([requireCapability("commercial")])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        client_name: z.string().max(200).optional().nullable(),
        html: z.string().min(1).max(500_000),
        page: pageConfigSchema,
        cover: coverSchema,
        watermark: watermarkSchema,
        password: z.string().min(4).max(120).optional().nullable(),
        expires_in_days: z.number().int().min(1).max(365).optional().nullable(),
        max_downloads: z.number().int().min(1).max(1000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let passwordSalt: string | null = null;
    let passwordHash: string | null = null;
    if (data.password && data.password.trim()) {
      passwordSalt = randomToken(16);
      passwordHash = await hashSharePassword(data.password, passwordSalt);
    }
    const expiresAt = data.expires_in_days
      ? new Date(Date.now() + data.expires_in_days * 86_400_000).toISOString()
      : null;

    // Retry a few times on the unlikely token collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = randomToken(32);
      const { data: row, error } = await context.supabase
        .from("proposal_shares")
        .insert({
          user_id: context.userId,
          token,
          title: data.title,
          client_name: data.client_name ?? null,
          html: data.html,
          page_config: data.page ?? {},
          cover: data.cover ?? null,
          watermark: data.watermark ?? null,
          password_salt: passwordSalt,
          password_hash: passwordHash,
          max_downloads: data.max_downloads ?? null,
          expires_at: expiresAt,
        })
        .select(
          "id, token, title, client_name, max_downloads, download_count, expires_at, revoked_at, last_accessed_at, password_hash, created_at",
        )
        .single();
      if (!error && row) return mapRow(row);
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
    }
    throw new Error("Não foi possível gerar um token único, tente novamente.");
  });

export const listProposalShares = createServerFn({ method: "GET" })
  .middleware([requireCapability("commercial")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proposal_shares")
      .select(
        "id, token, title, client_name, max_downloads, download_count, expires_at, revoked_at, last_accessed_at, password_hash, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map(mapRow);
  });

export const revokeProposalShare = createServerFn({ method: "POST" })
  .middleware([requireCapability("commercial")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProposalShare = createServerFn({ method: "POST" })
  .middleware([requireCapability("commercial")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_shares")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
