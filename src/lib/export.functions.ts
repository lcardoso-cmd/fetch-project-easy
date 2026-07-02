import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  case_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  content: z.string().min(1),
});

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w-.]/g, "")
    .replace(/_{2,}/g, "_");
}

/** Quebra o resumo em blocos por TÍTULO: ou linha em branco. */
function splitSections(text: string): { heading: string; body: string }[] {
  const lines = text.split(/\r?\n/);
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) current.body += "\n";
      continue;
    }
    const m = line.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,\-]{3,}?):\s*(.*)$/);
    if (m && m[1] === m[1].toUpperCase()) {
      if (current) sections.push(current);
      current = { heading: m[1].trim(), body: m[2] ? m[2] + "\n" : "" };
    } else {
      if (!current) current = { heading: "", body: "" };
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) sections.push({ heading: "", body: text });
  return sections;
}

export const exportSummaryDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { Packer } = await import("docx");
    const { createStyledDocument, plainTextToDocxChildren } = await import(
      "@/lib/docx/template"
    );

    const doc = createStyledDocument({
      title: data.title,
      children: plainTextToDocxChildren(data.content),
      meta: {
        header: "Resumo do caso",
        creator: "B2B | JurisMind AI",
        description: data.title,
      },
    });

    const buf = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, fileName: `${sanitizeFilename(data.title)}.docx` };
  });


export const exportSummaryPptx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const pptxgen = (await import("pptxgenjs")).default;
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE";

    // Capa
    const cover = pptx.addSlide();
    cover.background = { color: "0F172A" };
    cover.addText(data.title, {
      x: 0.5,
      y: 2.5,
      w: 12,
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: "FFFFFF",
      fontFace: "Calibri",
    });
    cover.addText("Resumo gerado pelo JurisMind", {
      x: 0.5,
      y: 4.0,
      w: 12,
      h: 0.6,
      fontSize: 18,
      color: "94A3B8",
      fontFace: "Calibri",
    });

    const sections = splitSections(data.content);
    for (const sec of sections) {
      const slide = pptx.addSlide();
      slide.addText(sec.heading || data.title, {
        x: 0.5,
        y: 0.4,
        w: 12,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: "0F172A",
        fontFace: "Calibri",
      });
      const bullets = sec.body
        .split(/\n\s*\n|\n/) // parágrafos ou linhas
        .map((s) => s.trim())
        .filter(Boolean);
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true } })),
        {
          x: 0.5,
          y: 1.4,
          w: 12,
          h: 5.5,
          fontSize: 16,
          color: "1F2937",
          fontFace: "Calibri",
          valign: "top",
        },
      );
    }

    const base64 = (await pptx.write({ outputType: "base64" })) as string;
    return { base64, fileName: `${sanitizeFilename(data.title)}.pptx` };
  });
