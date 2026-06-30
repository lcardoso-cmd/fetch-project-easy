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

const PieceSchema = z.object({
  case_id: z.string().uuid(),
  piece_type: z.enum([
    "peticao-inicial",
    "contestacao",
    "replica",
    "recurso-apelacao",
    "agravo-instrumento",
    "memoriais",
    "parecer",
    "notificacao-extrajudicial",
    "laudo-pericial",
    "esclarecimentos-perito",
    "parecer-tecnico",
    "impugnacao-laudo",
    "quesitos-suplementares",
  ]),
  instructions: z.string().max(3000).optional().default(""),
});

const PIECE_GUIDE: Record<string, string> = {
  "peticao-inicial":
    "Petição inicial cível com: Endereçamento, Qualificação das partes, Dos Fatos, Do Direito (com fundamentos legais e jurisprudência quando cabível), Dos Pedidos, Do Valor da Causa, Das Provas, Local/Data, Assinatura.",
  contestacao:
    "Contestação com: Endereçamento, Qualificação, Preliminares (se cabíveis), Mérito (impugnação fato a fato), Do Direito, Dos Pedidos, Provas, Local/Data.",
  replica:
    "Réplica à contestação: refutar preliminares e impugnar mérito ponto a ponto, reiterando pedidos da inicial.",
  "recurso-apelacao":
    "Recurso de Apelação (CPC art. 1.009 e ss.): Endereçamento ao juízo a quo, Razões de Apelação separadas (síntese da lide, do julgado, das razões de reforma, dos pedidos).",
  "agravo-instrumento":
    "Agravo de Instrumento (CPC art. 1.015): Endereçamento ao Tribunal, requisitos do art. 1.016, pedido de efeito suspensivo/antecipação de tutela quando cabível.",
  memoriais:
    "Memoriais finais: síntese da causa, prova produzida, fundamentos jurídicos, reiteração dos pedidos.",
  parecer:
    "Parecer jurídico: Consulta, Análise dos Fatos, Análise Jurídica (legislação, doutrina, jurisprudência), Conclusão objetiva.",
  "notificacao-extrajudicial":
    "Notificação extrajudicial: identificação das partes, exposição dos fatos, fundamento, requerimento, prazo para cumprimento, consequências do descumprimento.",
  "laudo-pericial":
    "Laudo pericial estruturado (CPC arts. 464-480) com seções: 1) Identificação (perito, processo, juízo nomeante, partes, data da nomeação); 2) Objeto da perícia; 3) Metodologia e diligências realizadas; 4) Análise técnica; 5) Resposta fundamentada aos quesitos (agrupados por origem: juízo, autor, réu); 6) Conclusão objetiva; 7) Anexos sugeridos. Linguagem técnica, impessoal e imparcial.",
  "esclarecimentos-perito":
    "Esclarecimentos do perito a pedido de parte ou do juízo: resposta pontual a cada quesito complementar mantendo o teor técnico do laudo já apresentado.",
  "parecer-tecnico":
    "Parecer técnico do assistente técnico contratado pela parte: 1) Identificação do assistente e da parte assistida; 2) Documentos analisados; 3) Metodologia; 4) Análise técnica dos pontos relevantes; 5) Resposta aos quesitos da parte assistida; 6) Considerações sobre o laudo oficial (se houver); 7) Conclusão técnica favorável aos interesses da parte assistida, mantendo rigor técnico.",
  "impugnacao-laudo":
    "Impugnação ao laudo pericial oficial pela parte assistida: 1) Síntese do laudo oficial; 2) Pontos controversos (metodologia, premissas, cálculos, interpretação); 3) Fundamentação técnica da divergência item a item; 4) Quesitos suplementares sugeridos; 5) Conclusão pleiteando complementação/refazimento do laudo ou prevalência do parecer do assistente.",
  "quesitos-suplementares":
    "Lista de quesitos suplementares formulados pela parte assistida, numerados, claros, técnicos e ligados a pontos não respondidos ou mal esclarecidos no laudo oficial.",
};

export const draftLegalPiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PieceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { embedTexts } = await import("./ai.server");

    const { data: caseRow, error: caseErr } = await context.supabase
      .from("cases")
      .select("id, title, client_name, case_type, jurisdiction, summary, description")
      .eq("id", data.case_id)
      .eq("user_id", context.userId)
      .single();
    if (caseErr || !caseRow) throw new Error("Caso não encontrado");

    // Query semântica para puxar trechos relevantes do caso
    const seed = `${caseRow.title} ${caseRow.case_type ?? ""} ${data.instructions} ${data.piece_type}`;
    const [qEmb] = await embedTexts([seed]);
    let contextBlock = "(Sem documentos indexados neste caso.)";
    if (qEmb) {
      const { data: matches } = await context.supabase.rpc("match_chunks", {
        query_embedding: qEmb as unknown as string,
        match_count: 12,
        filter_user_id: context.userId,
      });
      const filtered = (matches ?? []).filter(
        (m: { case_id: string }) => m.case_id === data.case_id,
      );
      if (filtered.length > 0) {
        contextBlock = filtered
          .map(
            (m: { content: string }, idx: number) => `[Trecho ${idx + 1}]\n${m.content}`,
          )
          .join("\n\n---\n\n");
      }
    }

    const system = `Você é um advogado brasileiro experiente. Redija a peça jurídica solicitada em português formal, em Markdown, fiel ao CPC/2015 e à praxe forense. ${PIECE_GUIDE[data.piece_type]}
REGRAS:
- Use APENAS fatos presentes no contexto do caso. Se faltar informação, marque com [INSERIR ...].
- Não invente nomes, CPF/CNPJ, valores, datas ou jurisprudência. Quando citar jurisprudência, use placeholder [CITAR JURISPRUDÊNCIA].
- Cabeçalhos em Markdown (##), corpo em parágrafos claros.`;

    const user = `CASO: ${caseRow.title}
Cliente: ${caseRow.client_name ?? "[INSERIR]"}
Tipo: ${caseRow.case_type ?? "[INSERIR]"}
Jurisdição: ${caseRow.jurisdiction ?? "[INSERIR]"}
Resumo: ${caseRow.summary ?? caseRow.description ?? "(sem resumo)"}

INSTRUÇÕES ESPECÍFICAS DO ADVOGADO: ${data.instructions || "(usar padrão da peça)"}

CONTEXTO DOS DOCUMENTOS DO CASO:
${contextBlock}

Gere a peça completa agora.`;

    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-pro", temperature: 0.3 },
    );
    return { content: r.content, case_title: caseRow.title };
  });

