## 1. Corrigir o editor da Proposta Comercial (bug de digitação)

**Sintoma:** ao digitar no editor da proposta, o texto não fica ou o cursor "pula".

**Causa:** em `src/components/chat/rich-text-editor.tsx`, o `useEffect` de sync externo compara `safeHtml` (HTML já sanitizado pelo DOMPurify) com `lastEmittedRef.current` (HTML cru vindo do `contentEditable`). A cada tecla, o pai reemite o HTML, o DOMPurify normaliza atributos/tags, `safeHtml !== lastEmittedRef.current`, e o efeito sobrescreve o `innerHTML` — resetando o cursor para o início.

**Correção:** normalizar o valor emitido pelo próprio DOMPurify antes de guardar em `lastEmittedRef` e comparar contra o mesmo formato normalizado; adicionalmente, quando o valor entrante já bate com o `innerHTML` atual do nó (mesmo que difira do último emitido) não fazer nada. Efeito colateral zero no autosave.

## 2. Página Marketing (nova experiência)

Refatorar `src/routes/_authenticated/marketing.tsx` para deixar de ser "Markdown cru + Copiar" e ficar no mesmo nível da Proposta:

### 2.1 Resultado editável
- Substituir o `<ReactMarkdown>` por `RichTextEditor` (mesmo componente do proposta).
- Converter o markdown gerado em HTML (usando um helper `markdownToHtml` simples ou `marked`) antes de entregar ao editor.
- Estado `outputHtml` editável; botões: **Copiar texto**, **Baixar .docx** (usa `/api/tools/petition`), **Baixar .pdf** (`/api/tools/pdf`).

### 2.2 Geração de imagens (novo server fn)
Criar `generateMarketingImages` em `src/lib/generators.functions.ts` que:
- Recebe `{ topic, format, tone, content }`.
- Chama a AI Gateway `/v1/images/generations` (modelo `openai/gpt-image-2`, `quality: "low"`, streaming desativado no server, mas retornando `b64_json`) duas vezes:
  - **16:9** (1536×864 aprox — usar `size: "1536x1024"`).
  - **9:16** (1024×1536).
- Prompt visual sóbrio/executivo: paleta neutra (navy/marfim), tipografia sutil, sem texto explícito na imagem, alinhado com o tema do post. Sem rostos reais, sem logos.
- Retorna `{ image_16x9_b64, image_9x16_b64 }`.
- Chamado logo após o texto ser gerado (paralelo, com loading próprio) e também botão **Gerar imagens** para regerar.

### 2.3 UI de imagens
Nova seção **Artes para publicação** na página:
- Dois cards lado a lado (16:9 e 9:16) com preview.
- Botões por card: **Baixar PNG**, **Enviar por WhatsApp**.
- **WhatsApp**: abre `https://wa.me/?text=<texto+link>`. Como o WhatsApp Web não aceita anexar imagem via URL diretamente, o botão faz download da imagem + copia o texto do post + abre `wa.me` com o texto pronto, mostrando um toast: "Imagem baixada — anexe manualmente no WhatsApp". (Alternativa nativa mobile: `navigator.share` com `files` quando disponível — usar quando presente.)
- Estados: loading, erro, "regerar imagens".

### 2.4 Ajustes de fluxo
- Layout passa a duas colunas maiores (form à esquerda, resultado + artes à direita empilhados).
- Preservar todos os campos atuais do briefing.
- Toasts de sucesso/erro consistentes.

## Arquivos afetados

- `src/components/chat/rich-text-editor.tsx` — fix do sync do `lastEmittedRef`.
- `src/lib/generators.functions.ts` — novo `generateMarketingImages` (server fn) chamando AI Gateway server-side.
- `src/routes/_authenticated/marketing.tsx` — nova UI (editor + cards de imagem + WhatsApp/Download).
- (opcional) `src/lib/markdown-to-html.ts` — helper simples para converter markdown do gerador para HTML no editor.

## Fora de escopo

- Não altero a lógica de geração de texto (`generateMarketing` continua igual).
- Não altero backend do `/api/tools/pdf` nem `/api/tools/petition` — reaproveito.
- Não altero o autosave/versionamento da proposta.
