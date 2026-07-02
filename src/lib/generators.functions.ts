import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapability } from "@/lib/capability-middleware";
import { chatComplete } from "./ai.server";

const ProposalSchema = z.object({
  client_name: z.string().trim().max(200).optional().default(""),
  client_document: z.string().trim().max(50).optional().default(""),
  client_address: z.string().trim().max(300).optional().default(""),
  client_city_state: z.string().trim().max(150).optional().default(""),
  counterparty_name: z.string().trim().max(200).optional().default(""),
  counterparty_document: z.string().trim().max(50).optional().default(""),
  counterparty_address: z.string().trim().max(300).optional().default(""),
  counterparty_city_state: z.string().trim().max(150).optional().default(""),
  counterparty_lawyer: z.string().trim().max(200).optional().default(""),
  matter: z.string().trim().max(2000).optional().default(""),
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
  .middleware([requireCapability("commercial")])
  .inputValidator((input: unknown) => ProposalSchema.parse(input))
  .handler(async ({ data }) => {
    const counterpartyFilled = Boolean(
      data.counterparty_name ||
        data.counterparty_document ||
        data.counterparty_address ||
        data.counterparty_city_state ||
        data.counterparty_lawyer,
    );
    const clientFilled = Boolean(
      data.client_name || data.client_document || data.client_address || data.client_city_state,
    );
    const firmFilled = Boolean(
      data.firm_name ||
        data.firm_practice_areas ||
        data.firm_address ||
        data.firm_phone ||
        data.firm_email ||
        data.lawyer_name ||
        data.lawyer_title,
    );

    const omitInstructions = [
      !counterpartyFilled
        ? '- OMITA POR COMPLETO qualquer seção, título, subtítulo ou parágrafo sobre a "Contraparte" / "Parte contrária" / "Réu" / "Requerido". Não escreva o cabeçalho "Contraparte" nem frases como "a ser identificada", "a definir" ou "[Nome da contraparte]". Simplesmente não mencione a contraparte.'
        : "",
      !clientFilled
        ? '- OMITA POR COMPLETO qualquer seção "Dados do Cliente" / "Contratante" e não invente identificação. Refira-se genericamente como "o Cliente" quando estritamente necessário.'
        : "",
      !firmFilled
        ? '- OMITA POR COMPLETO a seção "Dados do Escritório" e o bloco de assinatura com identificação do advogado.'
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system = `Você é um advogado sênior brasileiro especialista em redigir propostas comerciais de serviços jurídicos. Use linguagem ${data.tone}, estrutura clara com as seções: Apresentação, Objeto, Escopo de Serviços, Honorários, Prazo, Condições Gerais, Aceite. Português do Brasil.

FORMATO DE SAÍDA (OBRIGATÓRIO):
- Produza HTML semântico puro. Use apenas as tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>. Pode usar style="text-align:center|right" em <h1>/<p> quando fizer sentido.
- NÃO use Markdown, NÃO use crases, NÃO use "#", NÃO use "**", NÃO use "---". Nada de blocos de código.
- Comece por <h1 style="text-align:center">PROPOSTA DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS</h1>.

REGRAS DE PREENCHIMENTO (OBRIGATÓRIAS):
- Use SEMPRE os dados fornecidos — nunca deixe placeholders como "[Nome do Escritório]", "[Endereço]", "[definir percentual]", "___", "xxx", "(a definir)", "(a preencher)", "N/A".
- Quando um dado NÃO for informado, OMITA a linha/parágrafo/seção correspondente por completo. Não escreva colchetes vazios, nem "a definir", nem "não informado", nem reticências indicando lacuna.
- Se após omitir só sobrar o cabeçalho de uma seção, OMITA também o cabeçalho.
- Não invente CNPJ, endereços, telefones, valores, nomes ou datas.
${omitInstructions ? `\nOMISSÕES ESPECÍFICAS DESTA PROPOSTA:\n${omitInstructions}` : ""}`;
    const line = (label: string, value: string) => (value ? `- ${label}: ${value}` : `- ${label}: (não informado — omitir do texto)`);
    const user = `Gere uma proposta comercial usando exatamente os dados abaixo:

DADOS DO CLIENTE
${line("Cliente", data.client_name)}
${line("CPF/CNPJ", data.client_document)}
${line("Endereço", data.client_address)}
${line("Cidade/Estado", data.client_city_state)}

DADOS DA CONTRAPARTE
${line("Contraparte", data.counterparty_name)}
${line("CPF/CNPJ da contraparte", data.counterparty_document)}
${line("Endereço da contraparte", data.counterparty_address)}
${line("Cidade/Estado da contraparte", data.counterparty_city_state)}
${line("Advogado da contraparte", data.counterparty_lawyer)}

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
${line("Cargo/Título", data.lawyer_title)}

Retorne apenas o HTML da proposta, sem comentários adicionais.`;
    const r = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.5 },
    );
    // Garante que a saída seja HTML: se o modelo insistir em Markdown, converte o básico.
    let html = r.content.trim();
    // Remove eventuais cercas ```html
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!/<\w+[^>]*>/.test(html)) {
      // Fallback minimalista: transforma parágrafos em <p>.
      html = html
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
    }
    // Sanitização determinística: remove placeholders remanescentes e blocos vazios.
    html = sanitizeProposalHtml(html, { counterpartyFilled, clientFilled, firmFilled });
    return { content: html };
  });

/**
 * Remove placeholders remanescentes (colchetes, "a definir", "xxx", "___") e
 * blocos que ficaram vazios/somente com cabeçalho quando o usuário deixou
 * campos vazios. Impede que o preview e o .docx renderizem "buracos".
 */
function sanitizeProposalHtml(
  html: string,
  flags: { counterpartyFilled: boolean; clientFilled: boolean; firmFilled: boolean },
): string {
  let out = html;

  // 1) Remove placeholders inline dentro do texto.
  //    - "[qualquer coisa]"  → nada
  //    - "(a definir)", "(a combinar)", "(a preencher)", "(não informado)", "(pendente)"
  //    - sequências "___" ou "xxx" (3+)
  const inlinePlaceholders: RegExp[] = [
    /\[[^\]\n<]{1,120}\]/g,
    /\((?:a\s+(?:definir|combinar|preencher|especificar)|não\s+informad[oa]|pendente|n\/?a)\)/gi,
    /\b_{3,}\b/g,
    /\bx{3,}\b/gi,
  ];
  for (const re of inlinePlaceholders) out = out.replace(re, "");

  // 2) Remove seções da contraparte (h1/h2/h3 + conteúdo até o próximo heading do MESMO nível ou superior)
  //    quando o usuário não informou nada da contraparte.
  if (!flags.counterpartyFilled) {
    out = removeSectionByHeading(out, /contraparte|parte\s+contr[aá]ria|r[eé]u|requerid[oa]/i);
  }
  if (!flags.clientFilled) {
    out = removeSectionByHeading(out, /dados\s+d[oa]\s+cliente|contratante/i);
  }
  if (!flags.firmFilled) {
    out = removeSectionByHeading(out, /dados\s+d[oa]\s+escrit[oó]rio|do\s+escrit[oó]rio/i);
  }

  // 3) Colapsa espaços/pontuação órfã dentro de tags de texto.
  out = out.replace(/<(p|li|h1|h2|h3)([^>]*)>\s*([:;,.\-–—]\s*)+/gi, "<$1$2>");
  out = out.replace(/(\s*[:;,\-–—]\s*)+<\/(p|li|h1|h2|h3)>/gi, "</$2>");

  // 4) Remove parágrafos/itens/headings que ficaram vazios após limpeza.
  //    Roda em loop porque remover um heading pode deixar o seguinte também vazio.
  const emptyBlock = /<(p|li|h1|h2|h3)\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\s)*\s*<\/\1>/gi;
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out.replace(emptyBlock, "");
    if (out === before) break;
  }

  // 5) Remove listas <ul>/<ol> que ficaram sem <li>.
  out = out.replace(/<(ul|ol)\b[^>]*>\s*<\/\1>/gi, "");

  // 6) Remove heading seguido imediatamente de outro heading de mesmo nível ou superior
  //    (indica que a seção ficou sem corpo).
  const stripEmptyHeading = (level: 1 | 2 | 3) => {
    const re = new RegExp(
      `<h${level}\\b[^>]*>[\\s\\S]*?<\\/h${level}>\\s*(?=<h[1-${level}]\\b|$)`,
      "gi",
    );
    for (let i = 0; i < 3; i++) {
      const before = out;
      out = out.replace(re, "");
      if (out === before) break;
    }
  };
  stripEmptyHeading(3);
  stripEmptyHeading(2);

  // 7) Colapsa múltiplos espaços em branco entre tags.
  out = out.replace(/(\s*\n\s*){3,}/g, "\n\n");

  return out.trim();
}

function removeSectionByHeading(html: string, headingPattern: RegExp): string {
  // Encontra <h1|h2|h3>...heading...</hN> e remove tudo até o próximo heading de nível <= N (ou fim).
  const headingRe = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches: { start: number; end: number; level: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      level: Number(m[1]),
      text: m[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  // Remove do maior índice para o menor para não bagunçar offsets.
  const toRemove: { from: number; to: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i];
    if (!headingPattern.test(h.text)) continue;
    // acha próximo heading de nível <= h.level
    let cutEnd = html.length;
    for (let j = i + 1; j < matches.length; j++) {
      if (matches[j].level <= h.level) {
        cutEnd = matches[j].start;
        break;
      }
    }
    toRemove.push({ from: h.start, to: cutEnd });
  }
  // mescla intervalos e aplica de trás pra frente
  toRemove.sort((a, b) => b.from - a.from);
  let out = html;
  for (const r of toRemove) {
    out = out.slice(0, r.from) + out.slice(r.to);
  }
  return out;
}


const MarketingSchema = z.object({
  topic: z.string().min(1).max(500),
  format: z.enum(["post-linkedin", "post-instagram", "artigo-blog", "newsletter"]).default("post-linkedin"),
  audience: z.string().max(300).optional().default("clientes empresariais"),
  tone: z.enum(["autoridade", "educativo", "provocativo", "acolhedor"]).default("educativo"),
});

export const generateMarketing = createServerFn({ method: "POST" })
  .middleware([requireCapability("marketing")])
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
  .middleware([requireCapability("expert_opinion")])
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


