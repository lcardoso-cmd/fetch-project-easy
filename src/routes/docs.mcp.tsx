import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MCP_URL = "https://jurismind.b2bconsulting.com.br/mcp";

export const Route = createFileRoute("/docs/mcp")({
  head: () => ({
    meta: [
      { title: "Conectar clientes MCP · JurisMind" },
      {
        name: "description",
        content:
          "Passo a passo para conectar ChatGPT, Claude e Cursor ao endpoint MCP do JurisMind via OAuth Supabase, com exemplos das ferramentas disponíveis.",
      },
      { property: "og:title", content: "Conectar clientes MCP · JurisMind" },
      {
        property: "og:description",
        content:
          "Como plugar assistentes de IA (ChatGPT, Claude, Cursor) no JurisMind via MCP, com autenticação OAuth e exemplos de chamadas.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: McpDocsPage,
});

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
        <code className={lang ? `language-${lang}` : undefined}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 opacity-0 transition group-hover:opacity-100"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

const TOOLS: Array<{
  name: string;
  title: string;
  desc: string;
  input: string;
  example: string;
}> = [
  {
    name: "list_cases",
    title: "Listar casos",
    desc: "Retorna casos do usuário autenticado (id, título, cliente, CNJ, jurisdição, status).",
    input: `status?: "active" | "archived" | "closed" | "all"
limit?: number (1–100, padrão 50)`,
    example: `{
  "name": "list_cases",
  "arguments": { "status": "active", "limit": 20 }
}`,
  },
  {
    name: "get_case",
    title: "Detalhes do caso",
    desc: "Retorna todos os campos de um caso pelo UUID.",
    input: `case_id: string (UUID)`,
    example: `{
  "name": "get_case",
  "arguments": { "case_id": "b3f1c8e2-..." }
}`,
  },
  {
    name: "list_documents",
    title: "Listar documentos do caso",
    desc: "Documentos anexados ao caso (id, nome, tipo, tamanho, status de indexação).",
    input: `case_id: string (UUID)`,
    example: `{
  "name": "list_documents",
  "arguments": { "case_id": "b3f1c8e2-..." }
}`,
  },
  {
    name: "search_documents",
    title: "Buscar nos documentos (RAG)",
    desc: "Busca semântica + textual (híbrida) nos documentos. Pode ser escopada a um caso.",
    input: `query: string
case_id?: string (UUID)
limit?: number`,
    example: `{
  "name": "search_documents",
  "arguments": {
    "query": "cláusula de rescisão antecipada",
    "case_id": "b3f1c8e2-...",
    "limit": 5
  }
}`,
  },
  {
    name: "list_tasks",
    title: "Listar tarefas",
    desc: "Tarefas do usuário, opcionalmente filtradas por caso e status.",
    input: `case_id?: string (UUID)
status?: "pending" | "in_progress" | "blocked" | "done" | "all"
limit?: number (1–200)`,
    example: `{
  "name": "list_tasks",
  "arguments": { "status": "pending" }
}`,
  },
  {
    name: "create_task",
    title: "Criar tarefa",
    desc: "Cria tarefa para o usuário, opcionalmente vinculada a um caso.",
    input: `title: string (1–300)
description?: string
case_id?: string (UUID)
priority?: "low" | "medium" | "high" | "urgent"
due_date?: string (YYYY-MM-DD)`,
    example: `{
  "name": "create_task",
  "arguments": {
    "title": "Protocolar contestação",
    "priority": "high",
    "due_date": "2026-08-01",
    "case_id": "b3f1c8e2-..."
  }
}`,
  },
];

function McpDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            JurisMind
          </Link>
          <Badge variant="outline">Documentação · MCP</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Integrações de agentes
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Conectar ChatGPT, Claude ou Cursor ao JurisMind
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            O JurisMind expõe um servidor MCP (Model Context Protocol) autenticado por OAuth.
            Assistentes externos podem consultar seus casos, documentos e tarefas — sempre agindo
            como você, respeitando as políticas de acesso do sistema.
          </p>
        </div>

        <Card className="mt-8 border-border/60 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Endpoint MCP
              </div>
              <code className="mt-1 block text-sm font-medium">{MCP_URL}</code>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">Streamable HTTP</Badge>
              <Badge variant="secondary">OAuth 2.1 + DCR</Badge>
              <Badge variant="secondary">RLS por usuário</Badge>
            </div>
          </div>
        </Card>

        <nav className="mt-10 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-2">
          <a href="#overview" className="hover:text-foreground text-muted-foreground">1. Visão geral</a>
          <a href="#auth" className="hover:text-foreground text-muted-foreground">2. Autenticação OAuth</a>
          <a href="#clients" className="hover:text-foreground text-muted-foreground">3. Configurar clientes</a>
          <a href="#tools" className="hover:text-foreground text-muted-foreground">4. Ferramentas disponíveis</a>
          <a href="#curl" className="hover:text-foreground text-muted-foreground">5. Chamadas brutas (curl)</a>
          <a href="#troubleshooting" className="hover:text-foreground text-muted-foreground">6. Solução de problemas</a>
        </nav>

        <div className="mt-14 space-y-14">
          <Section id="overview" title="1. Visão geral">
            <p>
              MCP é um padrão aberto que permite a agentes de IA descobrirem e chamarem ferramentas
              hospedadas por aplicações. O JurisMind expõe um servidor MCP em{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">/mcp</code> que o cliente conecta uma
              única vez; depois disso, o assistente pode listar casos, buscar trechos nos autos
              (RAG), consultar tarefas e criar novas atividades como se fosse você.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Transporte: <strong>Streamable HTTP</strong> (POST JSON-RPC + eventos SSE).</li>
              <li>Autenticação: <strong>OAuth 2.1</strong> pela sua conta JurisMind (Supabase Auth).</li>
              <li>Registro dinâmico de clientes (DCR) habilitado — nenhuma configuração manual.</li>
              <li>Todas as chamadas rodam sob suas políticas RLS. O token nunca é exposto ao modelo.</li>
            </ul>
          </Section>

          <Section id="auth" title="2. Como funciona a autenticação">
            <p>
              Ao adicionar o servidor pela primeira vez, o cliente MCP abre uma janela do navegador
              apontando para o servidor de autorização do JurisMind. O fluxo é o mesmo do "Entrar
              com Google" que você já conhece:
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>O cliente redireciona para <code className="rounded bg-muted px-1.5 py-0.5">/.lovable/oauth/consent</code>.</li>
              <li>Se você não estiver logado, entra normalmente no JurisMind.</li>
              <li>Uma tela de consentimento mostra qual cliente está pedindo acesso.</li>
              <li>Ao aprovar, o cliente recebe um <em>access token</em> e um <em>refresh token</em>.</li>
              <li>O token é renovado automaticamente — você só precisa aprovar uma vez.</li>
            </ol>
            <p>
              Você pode revogar o acesso a qualquer momento em{" "}
              <Link to="/configuracoes/perfil" className="underline">Configurações</Link>{" "}
              → sessões OAuth.
            </p>
          </Section>

          <Section id="clients" title="3. Configurar em cada cliente">
            <Tabs defaultValue="chatgpt" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                <TabsTrigger value="claude">Claude</TabsTrigger>
                <TabsTrigger value="cursor">Cursor / Codex</TabsTrigger>
              </TabsList>

              <TabsContent value="chatgpt" className="mt-4 space-y-4">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    A aba <strong>Connectors</strong> só aparece em alguns planos.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Se você não vê "Connectors" em <em>Configurações</em> (só aparecem Geral,
                    Notificações, Personalização, Plugins, Voz, Uso, Controles de dados, Navegador na
                    nuvem, Armazenamento, Segurança e login, Conta e Teclado), sua conta ainda não tem
                    o recurso. Conectores MCP personalizados estão disponíveis hoje em{" "}
                    <strong>ChatGPT Business, Enterprise, Edu e Team</strong>, e em contas{" "}
                    <strong>Pro</strong> com o <em>Developer Mode</em> ativado em{" "}
                    <em>Settings → Connectors → Advanced</em>. Planos <strong>Plus</strong> e{" "}
                    <strong>Free</strong> ainda não expõem MCP personalizado.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-foreground">Opção A — Se você vê "Connectors"</h3>
                  <ol className="ml-5 mt-2 list-decimal space-y-2 text-foreground">
                    <li>Abra <strong>ChatGPT → Settings → Connectors → Add custom connector</strong>.</li>
                    <li>Escolha o tipo <strong>Streamable HTTP (MCP)</strong>.</li>
                    <li>
                      Cole a URL:
                      <div className="mt-2">
                        <CodeBlock code={MCP_URL} />
                      </div>
                    </li>
                    <li>Deixe <strong>OAuth</strong> como método de autenticação (padrão).</li>
                    <li>Clique em <strong>Connect</strong> — abre o popup do JurisMind para consentimento.</li>
                    <li>No chat, ative o conector no seletor de ferramentas (ícone <em>Tools</em>).</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-medium text-foreground">Opção B — Enquanto seu plano não tem MCP nativo</h3>
                  <ul className="ml-5 mt-2 list-disc space-y-2 text-foreground">
                    <li>
                      <strong>Use Claude ou Cursor</strong> (abas ao lado) — ambos suportam MCP em todos
                      os planos, inclusive gratuitos. É o caminho mais rápido para testar o JurisMind.
                    </li>
                    <li>
                      <strong>Ative o Developer Mode</strong> (planos Pro): em{" "}
                      <em>Settings → Connectors</em>, role até <em>Advanced settings</em> e habilite
                      "Developer mode". A opção <em>Add custom connector</em> aparece em seguida.
                    </li>
                    <li>
                      <strong>Crie um GPT com Actions</strong> apontando para uma API REST sua — funciona
                      no Plus, mas não é MCP nativo (exige adaptar cada tool para OpenAPI e não reaproveita
                      este endpoint <code>/mcp</code>).
                    </li>
                    <li>
                      Aguarde a OpenAI liberar conectores personalizados para o Plus. Quando a aba
                      "Connectors" aparecer na sua conta, siga a Opção A.
                    </li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="claude" className="mt-4 space-y-3">
                <p>Em <strong>Claude.ai</strong>:</p>
                <ol className="ml-5 list-decimal space-y-2 text-foreground">
                  <li>Vá em <strong>Settings → Connectors → Add custom connector</strong>.</li>
                  <li>Nome: <code className="rounded bg-muted px-1.5 py-0.5">JurisMind</code></li>
                  <li>URL do servidor: <CodeBlock code={MCP_URL} /></li>
                  <li>Salve e clique em <strong>Connect</strong>. Aprove o consentimento no popup.</li>
                </ol>
                <p>Em <strong>Claude Desktop</strong>, edite o arquivo de configuração:</p>
                <CodeBlock
                  lang="json"
                  code={`{
  "mcpServers": {
    "jurismind": {
      "url": "${MCP_URL}"
    }
  }
}`}
                />
                <p className="text-sm text-muted-foreground">
                  Localização: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) ou <code>%APPDATA%\Claude\claude_desktop_config.json</code> (Windows).
                </p>
              </TabsContent>

              <TabsContent value="cursor" className="mt-4 space-y-3">
                <p>
                  No <strong>Cursor</strong>, abra o arquivo <code>~/.cursor/mcp.json</code> (ou crie-o) e adicione:
                </p>
                <CodeBlock
                  lang="json"
                  code={`{
  "mcpServers": {
    "jurismind": {
      "url": "${MCP_URL}"
    }
  }
}`}
                />
                <p>
                  Reinicie o Cursor. Ao ativar o servidor pela primeira vez em{" "}
                  <strong>Settings → MCP</strong>, o navegador abrirá para consentimento.
                </p>
                <p>
                  Para o <strong>OpenAI Codex CLI</strong>, use a mesma URL como servidor MCP remoto
                  no seu <code>~/.codex/config.toml</code>:
                </p>
                <CodeBlock
                  lang="toml"
                  code={`[mcp_servers.jurismind]
url = "${MCP_URL}"`}
                />
              </TabsContent>
            </Tabs>
          </Section>

          <Section id="tools" title="4. Ferramentas disponíveis">
            <p>
              Depois de conectado, o assistente enxerga as ferramentas abaixo. Todas retornam JSON
              estruturado; você pode pedir ao modelo para chamar diretamente pelo nome.
            </p>
            <div className="grid gap-4">
              {TOOLS.map((t) => (
                <Card key={t.name} className="border-border/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm text-primary">{t.name}</div>
                      <div className="mt-0.5 font-medium">{t.title}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        Entrada
                      </div>
                      <CodeBlock code={t.input} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        Exemplo de chamada
                      </div>
                      <CodeBlock lang="json" code={t.example} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          <Section id="curl" title="5. Chamadas brutas (curl)">
            <p>
              Útil para debug. Substitua <code>$TOKEN</code> por um access token válido obtido pelo
              fluxo OAuth (o cliente MCP faz isso automaticamente).
            </p>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Listar ferramentas
              </div>
              <CodeBlock
                lang="bash"
                code={`curl -sS ${MCP_URL} \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Chamar uma ferramenta
              </div>
              <CodeBlock
                lang="bash"
                code={`curl -sS ${MCP_URL} \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_documents",
      "arguments": {
        "query": "cláusula de rescisão",
        "limit": 3
      }
    }
  }'`}
              />
            </div>
            <p className="text-sm">
              O cabeçalho <code>Accept: application/json, text/event-stream</code> é obrigatório
              pela especificação MCP Streamable HTTP — sem ele o servidor responde <code>406</code>.
            </p>
          </Section>

          <Section id="troubleshooting" title="6. Solução de problemas">
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>"Unauthorized" ou 401</strong> — token expirou ou foi revogado. Remova a
                conexão no cliente e adicione novamente para refazer o consentimento.
              </li>
              <li>
                <strong>Popup de consentimento não aparece</strong> — verifique se o navegador não
                está bloqueando pop-ups do domínio <code>jurismind.b2bconsulting.com.br</code>.
              </li>
              <li>
                <strong>Ferramentas não aparecem no cliente</strong> — no ChatGPT/Claude, é preciso
                ativar o conector no seletor de ferramentas de cada conversa.
              </li>
              <li>
                <strong>"Client must accept text/event-stream"</strong> — está chamando por curl sem
                o header <code>Accept</code>. Veja a seção acima.
              </li>
              <li>
                <strong>Erros de validação nas ferramentas</strong> — os schemas Zod bloqueiam
                UUIDs malformados, datas fora do padrão etc. Peça ao modelo para revalidar o input.
              </li>
            </ul>
            <p className="pt-2">
              Precisa expor mais ferramentas (ex.: gerar proposta, criar caso)? Fale com o suporte
              JurisMind.
            </p>
          </Section>
        </div>

        <div className="mt-16 flex items-center justify-between border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <span>Referência oficial MCP</span>
          <a
            href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            modelcontextprotocol.io <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
