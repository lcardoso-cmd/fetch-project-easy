import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatComplete } from "./ai.server";

const ProposalSchema = z.object({
  client_name: z.string().min(1).max(200),
  matter: z.string().min(1).max(2000),
  scope: z.string().max(2000).optional().default(""),
  fees: z.string().max(500).optional().default(""),
  deadline: z.string().max(200).optional().default(""),
  tone: z.enum(["formal", "consultivo", "direto"]).default("formal"),
});

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProposalSchema.parse(input))
  .handler(async ({ data }) => {
    const system = `Você é um advogado sênior brasileiro especialista em redigir propostas comerciais de serviços jurídicos. Use linguagem ${data.tone}, estrutura clara em Markdown, com cabeçalhos: Apresentação, Objeto, Escopo de Serviços, Honorários, Prazo, Condições Gerais, Aceite. Português do Brasil. Não invente CNPJ, endereços ou valores não fornecidos.`;
    const user = `Gere uma proposta comercial para:
- Cliente: ${data.client_name}
- Matéria: ${data.matter}
- Escopo informado: ${data.scope || "(definir conforme reunião)"}
- Honorários: ${data.fees || "(a combinar)"}
- Prazo: ${data.deadline || "(a combinar)"}`;
    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.6 },
    );
    return { content: r.content };
  });

const MarketingSchema = z.object({
  topic: z.string().min(1).max(500),
  format: z.enum(["post-linkedin", "post-instagram", "artigo-blog", "newsletter"]).default("post-linkedin"),
  audience: z.string().max(300).optional().default("clientes empresariais"),
  tone: z.enum(["autoridade", "educativo", "provocativo", "acolhedor"]).default("educativo"),
});

export const generateMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MarketingSchema.parse(input))
  .handler(async ({ data }) => {
    const formatGuide: Record<string, string> = {
      "post-linkedin": "Post de LinkedIn, 150-250 palavras, primeiro parágrafo gancho forte, quebras curtas, 3-5 hashtags ao final.",
      "post-instagram": "Legenda de Instagram, 100-180 palavras, tom direto, emojis com parcimônia, CTA + 5-8 hashtags.",
      "artigo-blog": "Artigo de blog em Markdown, 500-800 palavras, com H2/H3, introdução, desenvolvimento e conclusão prática.",
      "newsletter": "Newsletter por e-mail, assunto + corpo curto e escaneável com bullets, CTA claro no final.",
    };
    const system = `Você é um especialista em marketing jurídico no Brasil, com domínio do Provimento 205/2021 da OAB (publicidade sóbria, sem captação de clientela, sem promessa de resultado). Tom: ${data.tone}. Público: ${data.audience}. Formato: ${formatGuide[data.format]} Português do Brasil, em Markdown.`;
    const user = `Tema: ${data.topic}\n\nProduza o conteúdo agora, pronto para publicar.`;
    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.8 },
    );
    return { content: r.content };
  });
