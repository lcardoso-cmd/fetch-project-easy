/**
 * Server-only helper para carregar branding do escritório (nome, dados,
 * bytes do logo) para os exports .docx.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Branding {
  firmName: string;
  taxId?: string;
  address?: string;
  website?: string;
  logo?: {
    bytes: Uint8Array;
    type: "png" | "jpg" | "gif" | "bmp";
    /** dimensões em px para o header (largura escala proporcional). */
    heightPx: number;
    widthPx: number;
  };
}

type LogoImageType = "png" | "jpg" | "gif" | "bmp";

function pickImageType(contentType: string | null, path: string): LogoImageType | null {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  const mime = (contentType ?? "").toLowerCase();
  if (mime.includes("png") || ext === "png") return "png";
  if (mime.includes("jpeg") || mime.includes("jpg") || ext === "jpg" || ext === "jpeg")
    return "jpg";
  if (mime.includes("gif") || ext === "gif") return "gif";
  if (mime.includes("bmp") || ext === "bmp") return "bmp";
  // SVG / webp não são suportados pelo docx-js ImageRun de forma confiável.
  return null;
}

export async function loadBrandingForUser(userId: string): Promise<Branding | null> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name, firm_name, tax_id, firm_address, firm_website, logo_path")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile) return null;

  const firmName = (profile.firm_name || profile.full_name || "").trim();
  if (!firmName && !profile.logo_path) return null;

  const branding: Branding = {
    firmName: firmName || "Escritório",
    taxId: profile.tax_id ?? undefined,
    address: profile.firm_address ?? undefined,
    website: profile.firm_website ?? undefined,
  };

  if (profile.logo_path) {
    try {
      const { data: file } = await supabaseAdmin.storage
        .from("firm-logos")
        .download(profile.logo_path);
      if (file) {
        const type = pickImageType(file.type, profile.logo_path);
        if (type) {
          const buf = new Uint8Array(await file.arrayBuffer());
          // Header limite ~48px altura. Tenta detectar dimensões via header.
          const dims = readImageSize(buf, type) ?? { width: 200, height: 60 };
          const scale = 48 / dims.height;
          branding.logo = {
            bytes: buf,
            type,
            heightPx: 48,
            widthPx: Math.max(48, Math.min(220, Math.round(dims.width * scale))),
          };
        }
      }
    } catch {
      // segue sem logo
    }
  }
  return branding;
}

/** Lê dimensões básicas de PNG/JPG. Retorna null se não conseguir. */
function readImageSize(
  buf: Uint8Array,
  type: LogoImageType,
): { width: number; height: number } | null {
  try {
    if (type === "png" && buf.length > 24) {
      // IHDR começa em byte 16: width (4 BE), height (4 BE)
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    if (type === "jpg") {
      // Varredura de segmentos JPEG
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        i += 2;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = (buf[i + 3] << 8) | buf[i + 4];
          const width = (buf[i + 5] << 8) | buf[i + 6];
          return { width, height };
        }
        const segLen = (buf[i] << 8) | buf[i + 1];
        i += segLen;
      }
    }
  } catch {
    return null;
  }
  return null;
}
