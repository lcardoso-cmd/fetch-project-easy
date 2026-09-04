/**
 * Fonte única de verdade do conteúdo comercial do JurisMind.
 *
 * Consumido por:
 *  - `src/routes/index.tsx` (homepage pública)
 *  - `src/assets/jurismind-apresentacao.pdf.asset.json` (apresentação 16:9 em PDF servida em `/api/public/deck`)
 *
 * Regra: qualquer texto comercial exibido na homepage deve morar aqui,
 * para que a apresentação enviada aos clientes nunca fique defasada.
 */

export interface PitchItem {
  /** Chave estável usada para mapear ícones na UI. */
  key: string;
  t: string;
  d?: string;
  n?: string;
}

export const PITCH = {
  brand: {
    name: "JurisMind AI",
    tagline: "A inteligência operacional de cada caso",
    company: "B2B Consulting",
    site: "https://jurismind.b2bconsulting.com.br/",
    contact: "contato@b2bconsulting.com.br",
  },

  hero: {
    eyebrow: "A inteligência operacional de cada caso",
    title: "Do documento à entrega: um só caso, um só fluxo de trabalho.",
    subtitle:
      "O JurisMind lê os documentos do caso, mostra o trecho exato que sustenta cada afirmação e transforma isso em peça, planilha, apresentação e tarefa da equipe — sem recomeçar a conversa a cada pedido.",
    highlight: "Mais contexto para a IA. Mais controle para o advogado.",
  },

  flow: {
    title: "O mesmo caso atravessa cinco etapas, sem trocar de ferramenta.",
    subtitle:
      "Localizar, organizar, produzir, apresentar e conduzir acontecem sobre a mesma base documental, dentro do caso.",
    items: [
      {
        key: "localizar",
        n: "01",
        t: "Localizar",
        d: "O JurisMind lê os documentos do caso e aponta o trecho exato, com página e origem.",
      },
      {
        key: "organizar",
        n: "02",
        t: "Organizar",
        d: "Datas, valores e obrigações viram apuração comparável em planilha.",
      },
      {
        key: "produzir",
        n: "03",
        t: "Produzir",
        d: "Peças e documentos são redigidos com base nos autos e abertos no editor.",
      },
      {
        key: "apresentar",
        n: "04",
        t: "Apresentar",
        d: "O caso é resumido em apresentação executiva para cliente e sócios.",
      },
      {
        key: "conduzir",
        n: "05",
        t: "Conduzir",
        d: "Tarefas, prazos e agenda ficam vinculados ao mesmo caso e à equipe.",
      },
    ] satisfies PitchItem[],
  },

  deliverables: {
    title: "Escolha uma etapa e veja o resultado.",
    subtitle:
      "Um único caso, cinco entregas. Análise com fontes, planilha, peça, apresentação e a tarefa que mantém o trabalho andando.",
    items: [
      {
        key: "analise",
        t: "Análise com fontes",
        d: "Resposta ligada ao trecho de origem no documento.",
      },
      { key: "peca", t: "Peça jurídica", d: "Minuta editável, exportável em Word e PDF." },
      { key: "planilha", t: "Planilha", d: "Apuração comparativa exportável em Excel." },
      {
        key: "apresentacao",
        t: "Apresentação",
        d: "Deck executivo do caso exportável em PowerPoint.",
      },
      { key: "tarefa", t: "Tarefa e prazo", d: "Ação vinculada ao caso, à agenda e ao responsável." },
      {
        key: "jurisprudencia",
        t: "Jurisprudência",
        d: "Precedentes de sites oficiais de tribunais, com link.",
      },
    ] satisfies PitchItem[],
  },

  intelligence: {
    title: "Por que a resposta vem com página e origem.",
    subtitle:
      "Antes de escrever, o JurisMind procura nos documentos do caso os trechos que respondem ao pedido — e devolve a referência junto com a resposta.",
    items: [
      {
        key: "significado",
        t: "Busca por significado",
        d: "Encontra conteúdos relacionados à ideia da pergunta, mesmo quando usam palavras diferentes.",
      },
      {
        key: "textual",
        t: "Busca textual em português",
        d: "Identifica termos, nomes, valores, expressões e referências específicas.",
      },
      {
        key: "fusao",
        t: "Combinação dos resultados",
        d: "Reúne os resultados das duas buscas e prioriza os trechos mais relacionados.",
      },
      {
        key: "rerank",
        t: "Reavaliação do contexto",
        d: "Nos modos avançados, a pergunta e os trechos podem ser refinados antes da resposta.",
      },
    ] satisfies PitchItem[],
    ragTitle: "O nome dessa tecnologia é RAG.",
    ragBody:
      "RAG permite que a inteligência artificial consulte uma base documental antes de responder. No JurisMind, essa base é formada pelos documentos selecionados para cada caso — inclusive arquivos longos, digitalizados ou com texto em imagem.",
    ragNote: "É como permitir que a IA abra e consulte os autos antes de responder ao advogado.",
    glossary: [
      {
        key: "hibrida",
        t: "Busca híbrida",
        d: "uso combinado da busca por significado com a busca textual em português.",
      },
      {
        key: "fusao",
        t: "Fusão",
        d: "união dos resultados das diferentes buscas em uma única lista priorizada.",
      },
      {
        key: "rerank",
        t: "Reranqueamento",
        d: "nova classificação dos trechos encontrados antes de a resposta ser gerada.",
      },
    ] satisfies PitchItem[],
  },

  jurisprudence: {
    badge: "Pesquisa em fontes oficiais",
    title: "Jurisprudência com link do tribunal, separada da prova dos autos.",
    subtitle:
      "No chat do caso, o advogado pode pedir precedentes. A pesquisa consulta apenas sites oficiais de tribunais (STF, STJ, TST, TSE e tribunais estaduais) e devolve tribunal, órgão julgador, data e link para o inteiro teor.",
    bullets: [
      "Referências [F] são os documentos do caso; [J] são precedentes externos — nunca se misturam.",
      "Resultados fora dos domínios oficiais são descartados.",
      "Se a pesquisa estiver indisponível, o sistema informa em vez de inventar julgados.",
    ],
    exampleLabel: "Exemplo de retorno (fictício)",
    examples: [
      {
        ref: "J1",
        court: "STJ",
        panel: "Terceira Turma",
        date: "12/03/2024",
        title: "Responsabilidade objetiva do transportador",
      },
      {
        ref: "J2",
        court: "TST",
        panel: "Segunda Turma",
        date: "20/05/2024",
        title: "Validade do controle de ponto por exceção",
      },
    ],
    disclaimer:
      "Jurisprudência é apoio argumentativo e deve ser conferida no inteiro teor. Ela não substitui a prova dos autos.",
  },

  differentiation: {
    title: "A diferença não é o modelo. É a estrutura em volta dele.",
    subtitle:
      "GPT e Gemini fornecem os modelos. O JurisMind define sobre quais documentos eles trabalham, o que produzem e como isso volta para a operação do escritório.",
    genericTitle: "Chat genérico usado isoladamente",
    generic: [
      "Contexto colado manualmente a cada conversa.",
      "Documentos soltos, fora da gestão do caso.",
      "Resposta sem indicação da página de origem.",
      "Resultado que não se transforma em tarefa, prazo ou entrega do escritório.",
    ],
    jurismindTitle: "JurisMind",
    jurismind: [
      "Base documental organizada e indexada por caso.",
      "Busca automática dos trechos relevantes antes da resposta.",
      "Referência ao documento e à página que sustentam cada afirmação.",
      "Peça, planilha, apresentação, tarefa e prazo gerados no mesmo lugar.",
    ],
  },

  platform: {
    title: "Inteligência documental conectada à operação do escritório.",
    items: [
      {
        key: "inteligencia",
        t: "Inteligência",
        d: "Consulta documental por caso, análise, produção jurídica e pesquisa de jurisprudência.",
      },
      {
        key: "operacao",
        t: "Operação",
        d: "Casos, documentos, tarefas, agenda, propostas, comunicação interna e publicações.",
      },
      {
        key: "governanca",
        t: "Governança",
        d: "Usuários, permissões, modelos, histórico de uso, consumo e custos estimados.",
      },
    ] satisfies PitchItem[],
  },

  governance: {
    title: "Controle profissional do uso da IA.",
    subtitle:
      "O escritório acompanha quem utiliza os recursos de inteligência artificial, os modelos acionados, o consumo registrado e os custos estimados, com orçamento mensal por organização.",
    items: [
      { key: "usuarios", t: "Usuários e permissões" },
      { key: "historico", t: "Histórico de utilização da IA" },
      { key: "tokens", t: "Tokens e custos estimados" },
      { key: "orcamento", t: "Orçamento mensal" },
    ] satisfies PitchItem[],
  },

  cta: {
    title: "Experimente em um caso real do seu escritório.",
    subtitle:
      "Crie sua conta, organize um caso, inclua os documentos e veja em 30 dias a diferença entre conversar com uma IA e conduzir o caso com ela.",
    button: "Começar meu teste gratuito",
    note: "Teste gratuito por 30 dias.",
    authenticatedTitle: "Continue seu trabalho no JurisMind.",
    authenticatedSubtitle: "Acesse seus casos, documentos e recursos de inteligência jurídica.",
  },

  footer: {
    about:
      "A inteligência operacional de cada caso, construída sobre os documentos do escritório.",
    company: "Uma solução B2B Consulting.",
  },
} as const;

export type Pitch = typeof PITCH;
