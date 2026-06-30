## Contexto

Seu repositório `lcardoso-cmd/jurismind` é um **Next.js + Firebase + Genkit/OpenAI** com mais de 30 telas (admin, dashboard, agenda, marketing, propostas, monitoring, tasks, integrations…). O projeto Lovable atual já tem a base correta no stack suportado: **TanStack Start + Lovable Cloud (Supabase) + Lovable AI**, com tabelas `cases`, `documents`, `document_chunks` (pgvector) e `events` já criadas e RLS ativa.

Não dá pra copiar 1:1 — o que vou fazer é **reescrever as features no stack atual**, em fases. Começo pelo núcleo que faz sentido pra um RAG jurídico.

## Fase 1 — MVP (vamos começar por aqui)

Funcionalidades essenciais do Jurismind, adaptadas:

1. **Identidade visual** — copio cores, fontes e textos do `globals.css` + landing do repo
2. **Casos** (já existe estrutura) — expandir com os campos do tipo `Case` original: número do processo, jurisdição, tipo (Arbitragem/Contencioso), partes, advogados da equipe, contato, resumo gerado por IA
3. **Upload de documentos** — drag&drop, salva no bucket `documents`, registra em `documents`
4. **Pipeline RAG** — server function que:
   - extrai texto (PDF/DOCX/TXT)
   - chunka
   - gera embeddings via Lovable AI Gateway (`text-embedding-3-small`)
   - grava em `document_chunks` (já tem `vector(1536)` + função `match_chunks`)
5. **Chat com IA** por caso — usa `match_chunks` pra recuperar trechos e responde com Gemini/GPT via Lovable AI, citando os documentos
6. **Resumo automático do caso** — botão que gera resumo via IA a partir dos documentos indexados

## Fase 2 (depois do MVP, sob demanda)

- Agenda / prazos (tabela `events` já existe)
- Tasks / Kanban
- Propostas
- Marketing / Monitoring / Integrations
- Admin (tenants/clientes) — exige roles e multi-tenancy

## Arquivos que vou criar/editar na Fase 1

```text
src/styles.css                              # importar identidade do globals.css
src/routes/index.tsx                        # landing inspirada no /app/page.tsx
src/routes/_authenticated/cases.$id.tsx     # detalhe do caso (novo)
src/routes/_authenticated/chat.tsx          # chat RAG (reescrever)
src/components/cases/case-detail.tsx        # campos extras
src/components/documents/upload-zone.tsx    # drag&drop
src/components/chat/chat-panel.tsx          # interface de chat
src/lib/documents.functions.ts              # upload + listagem
src/lib/rag.functions.ts                    # pipeline embeddings + busca
src/lib/chat.functions.ts                   # streaming chat com RAG
supabase/migrations/...                     # adicionar colunas em `cases` (case_number, jurisdiction, case_type, parties jsonb, summary, etc.)
```

## Detalhes técnicos

- **AI**: uso exclusivamente o **Lovable AI Gateway** (já temos `LOVABLE_API_KEY`) — embeddings via `openai/text-embedding-3-small`, chat via `google/gemini-2.5-flash`. Não preciso de chave do usuário.
- **Parsing PDF**: como o runtime é Cloudflare Workers (sem `pdf-parse`/`sharp`), uso `unpdf` (puro JS, edge-compatible) ou recebo texto extraído no cliente.
- **RAG**: chunks de ~500 tokens com overlap de 50, embedding 1536-dim, busca por similaridade cosseno via `match_chunks` (já existe).
- **Firebase → Supabase**: `users` → `auth.users` + `profiles`, `cases` collection → `cases` table, `documents` subcollection → `documents` table, Firestore listeners → TanStack Query.
- **Genkit → Lovable AI**: chamo direto via `fetch` ao AI Gateway nas server functions.

## Pergunta antes de implementar

Quer que eu **comece a Fase 1 inteira** (~bastante trabalho, vários arquivos), ou prefere que eu faça **só um pedaço primeiro** (ex.: só identidade visual + landing, ou só o pipeline RAG) pra você validar antes?