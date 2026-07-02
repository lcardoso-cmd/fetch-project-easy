
## Objetivo

A landing (`/`) hoje mostra só 4 recursos genéricos (chat, peças, casos, público-alvo). O sistema já entrega muito mais valor — proposta comercial inteligente, agenda com Google/Outlook, marketing, publicações, pareceres, colaboração, etc. Vamos reorganizar a landing para comunicar isso sem virar uma lista sem hierarquia.

## Nova estrutura da página

```text
┌──────────────────────────────────────────┐
│ Header (inalterado)                      │
├──────────────────────────────────────────┤
│ Hero (mantém copy + CTA)                 │
├──────────────────────────────────────────┤
│ Personas (Advogado / Perito / Assist.)   │
├──────────────────────────────────────────┤
│ NOVO — "Plataforma completa" (bento)     │
│   6 pilares em cards de tamanhos vários  │
├──────────────────────────────────────────┤
│ NOVO — "Fluxo de trabalho ponta a ponta" │
│   4 passos: Captar → Trabalhar →         │
│   Entregar → Acompanhar                  │
├──────────────────────────────────────────┤
│ NOVO — "Integra com seu dia a dia"       │
│   Google Agenda, Outlook, DOCX/PDF,      │
│   voz, RAG citando fontes                │
├──────────────────────────────────────────┤
│ CTA final (inalterado)                   │
│ Footer (inalterado)                      │
└──────────────────────────────────────────┘
```

## Seção "Plataforma completa" — 6 pilares

Bento grid (2 col mobile, 3 col desktop, alguns cards ocupando 2 colunas):

1. **Assistente JurisMind por caso** — RAG híbrido citando trechos e páginas dos documentos do processo.
2. **Peças, laudos e pareceres** — petições, contestações, quesitos, laudos periciais, pareceres técnicos, tudo padronizado em DOCX/PDF com a marca do escritório.
3. **Proposta comercial em minutos** — gere propostas a partir de documentos do cliente, versionamento com diff, exportação em Word e conversão em caso com um clique.
4. **Agenda integrada** — sincronize Google Agenda e Outlook, veja prazos, audiências e compromissos em uma única visão.
5. **Marketing jurídico** — trilha dedicada para escritórios trabalharem captação e comunicação (novo pilar de negócio).
6. **Publicações e monitoramento** — acompanhe intimações e movimentações para nunca perder um prazo.

## Seção "Fluxo ponta a ponta" — 4 passos

Timeline horizontal (desktop) / vertical (mobile):

1. **Capte** — Proposta comercial inteligente com auto-preenchimento dos dados do cliente.
2. **Trabalhe** — Chat com os documentos do caso, geração de peças, laudos e pareceres.
3. **Entregue** — Exportação padronizada (DOCX/PDF) com logo, cabeçalho e margens do escritório.
4. **Acompanhe** — Agenda sincronizada, publicações monitoradas e notificações no painel.

## Seção "Integra com seu dia a dia"

Faixa de logos/etiquetas: Google Agenda, Microsoft Outlook, exportação DOCX/PDF, transcrição por voz, colaboração em equipe com convites e capacidades granulares.

## Detalhes técnicos

- Arquivo único: `src/routes/index.tsx`. Sem novas rotas nem dependências.
- Ícones do `lucide-react` já usados no projeto (Handshake, CalendarDays, Megaphone, FileSearch, Sparkles, Workflow, MicIcon, Puzzle etc.).
- Manter `JurisMindMark`, `IconBox`, tokens semânticos (`bg-card`, `text-muted-foreground`, `bg-primary`, `bg-accent`), sem cores hardcoded.
- Bento grid via Tailwind (`grid-cols-2 md:grid-cols-3` + `md:col-span-2` em cards de destaque).
- Timeline responsiva: `flex flex-col md:flex-row` com números em círculos.
- Atualizar `meta description` para incluir proposta, agenda e marketing (mantendo <160 chars).
- Sem mudanças em lógica de negócio, rotas, autenticação ou backend.

## Fora do escopo

- Preços, depoimentos, screenshots de produto (podemos adicionar depois se quiser).
- Novas páginas dedicadas por funcionalidade.
- Alterações no header, hero e CTA finais.
