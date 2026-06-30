# Plano: Replicar JurisMind fielmente no Lovable

## Objetivo
Reproduzir o protótipo do GitHub (`lcardoso-cmd/jurismind`) com **mesma UI, mesmo fluxo e mesmas funcionalidades**, adaptando do stack original (Next.js + Firebase + OpenAI + Genkit) para o stack do Lovable (TanStack Start + Lovable Cloud/Supabase + Lovable AI Gateway).

Sem dados de exemplo — apenas estrutura e código funcional.

---

## Sobre as chaves de API (boa notícia)
Você **não precisa fornecer chave de OpenAI nem Gemini**. O Lovable já inclui o **Lovable AI Gateway**, que dá acesso direto a:
- `google/gemini-2.5-pro` / `gemini-3-flash` (chat, raciocínio, tool-calling)
- `openai/gpt-5`, `gpt-5-mini` (alternativas)
- `google/gemini-embedding-001` (embeddings pro RAG)
- Geração de imagem

Custo é debitado dos créditos do workspace. **Só precisarei pedir chaves se você quiser integrações externas** (Google Drive OAuth, Gamma.app).

---

## Escopo do trabalho (em ondas)

### 🌊 Onda 1 — UI/Layout fiel ao original
Replicar visualmente o app: sidebar, header, paleta, tipografia, navegação, dashboard principal. O que você vê hoje (cara genérica) vira **a cara real do JurisMind**.
- Sidebar com todas as seções: Dashboard, Casos, Agenda, My Files, My Tasks, Marketing, Proposal, Monitoring, Integrations, Settings, Admin
- Layout do dashboard com cards de visão geral
- Cores, espaçamento, fontes idênticas ao original

### 🌊 Onda 2 — Núcleo RAG (igual ao original)
Já temos a base (`document_chunks` + pgvector + `match_chunks`). Falta refinar pra ficar **igual ao fluxo original**:
- Upload com extração de texto (PDF/DOCX) e chunking inteligente
- Embeddings via Lovable AI (Gemini embedding) ou OpenAI (sua escolha)
- Chat por caso com **tool-calling** (criar tabela, gerar resumo, etc — igual `chat-tools.ts` original)
- Chat global cruzando todos os documentos do usuário
- Resumo automático de caso após upload (campo `summary` já existe na tabela `cases`)
- Citações com trecho + nome do arquivo

### 🌊 Onda 3 — Módulos de produtividade (telas que estão vazias)
- **Casos**: detalhe completo com timeline, partes envolvidas, documentos, prazos
- **Agenda**: calendário com prazos e audiências (tabela `events` já existe)
- **My Files**: visão global de todos os documentos
- **My Tasks**: tarefas (criar tabela)
- **Settings**: perfil, OAB, telefone, preferências

### 🌊 Onda 4 — Geradores com IA (replicar actions originais)
- **Proposal**: gerador de propostas comerciais com IA
- **Marketing**: chat especializado em marketing jurídico
- **Export**: gerar Word (.docx) e PowerPoint (.pptx) de resumos/petições — bibliotecas `docx` e `pptxgenjs` rodam no edge runtime do TanStack
- **Geração de imagem** para materiais visuais

### 🌊 Onda 5 — Admin / Multi-tenant
- Tabela `user_roles` (admin/lawyer/client) com RLS
- Telas `/admin/clients` e `/admin/tenants` se for multi-escritório
- Gerenciamento de permissões

### 🌊 Onda 6 — Integrações externas (precisam chave/credencial)
- **Google Drive** (per-user OAuth): listar arquivos do Drive do usuário e importar pro caso. Requer você criar OAuth Client no Google Cloud Console e me passar Client ID + Secret.
- **Gamma.app** (apresentações automáticas): requer GAMMA_API_KEY
- **Monitoring de processos**: depende de qual fonte (API de tribunal, scraping, ou input manual)

---

## Decisões técnicas chave

| Original (Firebase/Next) | No Lovable |
|---|---|
| Firebase Auth | Supabase Auth (já configurado) |
| Firestore | Postgres + RLS (já temos tabelas) |
| Firebase Storage | Supabase Storage (bucket `documents` já existe) |
| OpenAI direto (chave do usuário) | Lovable AI Gateway (sem chave) |
| Genkit flows | `createServerFn` + AI SDK + tool-calling |
| Next.js server actions | TanStack server functions |
| Per-user Google OAuth | Implementar manualmente (você cria OAuth app) |

---

## Como vamos trabalhar
Cada onda é um ciclo de implementação. Eu sugiro começar pela **Onda 1 (UI fiel)** porque é o que mais incomoda você visualmente agora — depois disso o app já "parece" o JurisMind. Em seguida Onda 2 (RAG completo) que é o coração técnico.

**Você aprova esse plano e começo pela Onda 1?**

Se quiser começar por outra onda ou priorizar algo específico (ex.: "Drive primeiro porque é o mais doloroso"), me diz antes de aprovar.
