import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatComplete } from "./ai.server";

const ProposalSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  client_document: z.string().trim().max(50).optional().default(""),
  client_address: z.string().trim().max(300).optional().default(""),
  client_city_state: z.string().trim().max(150).optional().default(""),
  matter: z.string().trim().min(1).max(2000),
  scope: z.string().trim().max(2000).optional().default(""),
  fees: z.string().trim().max(500).optional().default(""),
  success_fee: z.string().trim().max(100).optional().default(""),
  deadline: z.string().trim().max(200).optional().default(""),
  firm_name: z.string().trim().max(200).optional().default(""),
  firm_practice_areas: z.string().trim().max(300).optional().default(""),
  firm_address: z.string().trim().max(300).optional().default(""),
  firm_phone: z.string().trim().max(50).optional().default(""),
  firm_email: z.string().trim().max(200).optional().default(""),
  lawyer_name: z.string().trim().max(200).optional().default(""),
  lawyer_title: z.string().trim().max(150).optional().default(""),
  tone: z.enum(["formal", "consultivo", "direto"]).default("formal"),
});

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProposalSchema.parse(input))
  .handler(async ({ data }) => {
    const system = `Você é um advogado sênior brasileiro especialista em redigir propostas comerciais de serviços jurídicos. Use linguagem ${data.tone}, estrutura clara em Markdown, com cabeçalhos: Apresentação, Objeto, Escopo de Serviços, Honorários, Prazo, Condições Gerais, Aceite. Português do Brasil.

REGRAS DE PREENCHIMENTO:
- Use SEMPRE os dados fornecidos abaixo — não deixe placeholders como "[Nome do Escritório]", "[Endereço]", "[definir percentual]" etc. quando o dado estiver informado.
- Quando um dado NÃO for informado, OMITA a linha/parágrafo correspondente por completo (não escreva colchetes vazios, não escreva "a definir" nem "não informado").
- Não invente CNPJ, endereços, telefones ou valores que não tenham sido fornecidos.`;
    const line = (label: string, value: string) => (value ? `- ${label}: ${value}` : `- ${label}: (não informado — omitir do texto)`);
    const user = `Gere uma proposta comercial usando exatamente os dados abaixo:

DADOS DO CLIENTE
${line("Cliente", data.client_name)}
${line("CPF/CNPJ", data.client_document)}
${line("Endereço", data.client_address)}
${line("Cidade/Estado", data.client_city_state)}

OBJETO E ESCOPO
${line("Matéria/Caso", data.matter)}
${line("Escopo informado", data.scope)}

HONORÁRIOS E PRAZO
${line("Honorários", data.fees)}
${line("Honorários de êxito", data.success_fee)}
${line("Prazo estimado", data.deadline)}

DADOS DO ESCRITÓRIO / ADVOGADO
${line("Nome do escritório", data.firm_name)}
${line("Áreas de atuação", data.firm_practice_areas)}
${line("Endereço do escritório", data.firm_address)}
${line("Telefone", data.firm_phone)}
${line("E-mail", data.firm_email)}
${line("Advogado responsável", data.lawyer_name)}
${line("Cargo/Título", data.lawyer_title)}`;
    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.5 },
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
      .select(
        "id, title, client_name, case_type, jurisdiction, summary, description, matter_kind, assisted_party_name, perito_nomination_ref, perito_deadline_date",
      )
      .eq("id", data.case_id)
      .eq("user_id", context.userId)
      .single();
    if (caseErr || !caseRow) throw new Error("Caso não encontrado");

    // Quesitos do caso (para laudos / pareceres / impugnação)
    const { data: quesitos } = await context.supabase
      .from("case_quesitos")
      .select("source, number, question, answer")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .order("source", { ascending: true })
      .order("number", { ascending: true, nullsFirst: false });

    let quesitosBlock = "(Nenhum quesito cadastrado.)";
    if ((quesitos ?? []).length > 0) {
      const grouped = (quesitos ?? []).reduce<Record<string, typeof quesitos>>((acc, q) => {
        (acc[q.source] ??= [] as never)?.push(q as never);
        return acc;
      }, {});
      quesitosBlock = Object.entries(grouped)
        .map(([src, list]) => {
          const items = (list ?? [])
            .map(
              (q, i) =>
                `  ${q.number ?? i + 1}. ${q.question}${q.answer ? `\n     Resposta prévia: ${q.answer}` : ""}`,
            )
            .join("\n");
          return `Quesitos de ${src}:\n${items}`;
        })
        .join("\n\n");
    }

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

    const isPerito =
      data.piece_type === "laudo-pericial" || data.piece_type === "esclarecimentos-perito";
    const isAssistente =
      data.piece_type === "parecer-tecnico" ||
      data.piece_type === "impugnacao-laudo" ||
      data.piece_type === "quesitos-suplementares";

    const persona = isPerito
      ? "Você é um(a) perito(a) judicial brasileiro(a) experiente, redigindo documento técnico, impessoal e imparcial, em obediência aos arts. 464-480 do CPC."
      : isAssistente
        ? "Você é um(a) assistente técnico(a) contratado(a) por uma das partes. Redija documento técnico rigoroso, defendendo os interesses legítimos da parte assistida sem comprometer o rigor metodológico."
        : "Você é um(a) advogado(a) brasileiro(a) experiente. Redija a peça em português formal, fiel ao CPC/2015 e à praxe forense.";

    const system = `${persona} ${PIECE_GUIDE[data.piece_type]}
REGRAS:
- Use APENAS fatos presentes no contexto do caso e nos quesitos. Se faltar informação, marque com [INSERIR ...].
- Não invente nomes, CPF/CNPJ, valores, datas, jurisprudência ou conclusões técnicas. Use placeholders [INSERIR ...] / [CITAR JURISPRUDÊNCIA] / [DADO TÉCNICO PENDENTE] quando necessário.
- Saída em Markdown, cabeçalhos em ## e parágrafos claros.`;

    const clientLabel = isPerito
      ? "Juízo nomeante"
      : isAssistente
        ? "Parte assistida"
        : "Cliente";
    const clientValue =
      isAssistente && caseRow.assisted_party_name
        ? caseRow.assisted_party_name
        : (caseRow.client_name ?? "[INSERIR]");

    const user = `CASO: ${caseRow.title}
${clientLabel}: ${clientValue}
Tipo: ${caseRow.case_type ?? "[INSERIR]"}
Jurisdição: ${caseRow.jurisdiction ?? "[INSERIR]"}
${caseRow.perito_nomination_ref ? `Nomeação: ${caseRow.perito_nomination_ref}\n` : ""}${caseRow.perito_deadline_date ? `Prazo do laudo: ${caseRow.perito_deadline_date}\n` : ""}Resumo: ${caseRow.summary ?? caseRow.description ?? "(sem resumo)"}

INSTRUÇÕES ESPECÍFICAS: ${data.instructions || "(usar padrão do documento)"}

QUESITOS DO CASO:
${quesitosBlock}

CONTEXTO DOS DOCUMENTOS DO CASO:
${contextBlock}

Gere o documento completo agora.`;

    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-pro", temperature: 0.3 },
    );
    return { content: r.content, case_title: caseRow.title };
  });


