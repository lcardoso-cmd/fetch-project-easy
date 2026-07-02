import { Packer } from "docx";
import { createStyledDocument, htmlToDocxChildren } from "/dev-server/src/lib/docx/template.ts";
import fs from "fs";

async function main() {
  const html = `<h1>1. Objeto</h1><p>Serviços de assessoria jurídica em matéria tributária, com análise documental, elaboração de peças e acompanhamento processual.</p><h2>1.1 Escopo</h2><ul><li>Análise de créditos dos últimos 60 meses</li><li>Elaboração do pedido administrativo</li><li>Acompanhamento até decisão final</li></ul><blockquote>Prazo estimado: 90 dias úteis a partir da entrega dos documentos.</blockquote><h1>2. Honorários</h1><p>Regime misto: parcela fixa mensal e êxito sobre valores recuperados.</p><h3>Condições de pagamento</h3><ol><li>Fixo: R$ 5.000,00 mensais</li><li>Êxito: 20% sobre o crédito homologado</li></ol><hr /><h1>3. Condições Gerais</h1><p>A vigência é de 12 meses, prorrogáveis mediante acordo entre as partes.</p><p style="text-align:right"><strong>São Paulo, 02 de julho de 2026.</strong></p>`;
  const doc = createStyledDocument({
    title: "Proposta Comercial",
    subtitle: "Assessoria tributária — Cliente Exemplo Ltda.",
    children: htmlToDocxChildren(html),
    meta: { header: "Proposta comercial" },
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync("/tmp/docxqa/proposta.docx", Buffer.from(buf));
  console.log("wrote bytes:", buf.byteLength);
}
main().catch((e) => { console.error(e); process.exit(1); });
