# Apresentação em PDF 16:9 da página inicial

Transformar o conteúdo da página inicial numa apresentação profissional em PDF widescreen (16:9), com um botão de download na própria página, e garantir que ela acompanhe automaticamente qualquer atualização do texto da homepage.

## Como a sincronia é garantida

Hoje os textos da homepage estão escritos direto dentro da página. O plano cria um único arquivo de conteúdo (fluxo, entregáveis, camadas de inteligência, jurisprudência, governança, números e chamadas para ação). A página inicial passa a ler esse arquivo, e a apresentação também. Ou seja: mudar o texto num lugar atualiza a página e o PDF ao mesmo tempo, sem trabalho duplicado.

## O que o cliente recebe

Apresentação em 16:9 (33,87 × 19,05 cm), gerada na hora, com identidade navy/ciano:

1. Capa com marca e posicionamento
2. O problema / IA genérica versus JurisMind
3. Fluxo de trabalho em etapas
4. Entregáveis (análise, peça, planilha, apresentação)
5. Camadas de inteligência (documentos próprios, RAG, rastreabilidade)
6. Jurisprudência de fontes oficiais
7. Governança, segurança e auditoria
8. Plataforma e módulos
9. Números / provas
10. Encerramento com convite ao teste e contato

Cada slide segue o mesmo padrão visual: faixa navy, título grande, marcador ciano, blocos de texto legíveis, numeração e rodapé com a marca.

## Botão de download

- Botão "Baixar apresentação (PDF)" no topo da página inicial (perto do hero) e repetido no encerramento.
- Estados de carregando, erro amigável e nome de arquivo `JurisMind-Apresentacao.pdf`.
- Funciona sem login, para poder ser enviado a clientes.

## Detalhes técnicos

- Novo `src/lib/marketing/pitch-content.ts`: fonte única de verdade do conteúdo (tipado), consumido por `src/routes/index.tsx` e pelo gerador de slides.
- Novo `src/lib/marketing/deck-pdf.server.ts`: monta o PDF com `pdf-lib` (já instalado) em páginas de 960×540 pt, fontes Carlito já embutidas em `src/lib/documents/fonts/carlito.ts`, cores de `src/lib/documents/tokens.ts` + navy `#000038` / ciano `#00FFFF`. Helpers de wrap de texto por métrica real, grid de cartões e rodapé.
- Nova rota pública `src/routes/api/public/deck.ts` (GET) devolvendo `application/pdf` com `Content-Disposition` e cache curto; sem dados de cliente, apenas conteúdo de marketing.
- Novo componente `src/components/marketing/deck-download-button.tsx` usado na homepage.
- Refatoração da homepage limitada a substituir literais pelas constantes do módulo de conteúdo; nenhuma mudança de layout, seções ou carrossel.
- Testes: `src/lib/marketing/__tests__/deck-pdf.test.ts` verificando número de slides, dimensão 960×540, presença de todos os títulos do conteúdo e quebra de texto sem estouro.
- QA visual obrigatório: converter cada slide em imagem e revisar todos antes de entregar (texto cortado, sobreposição, contraste), corrigindo e regerando até ficar limpo.
