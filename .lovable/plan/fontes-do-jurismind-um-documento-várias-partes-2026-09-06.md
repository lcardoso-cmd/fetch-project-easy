# Fontes do JurisMind: um documento, várias partes

Hoje, quando um arquivo grande é dividido para leitura, cada parte aparece como uma fonte separada na resposta da IA, com nome repetido e sem jeito de abrir o trecho citado. O objetivo é tratar o documento dividido como uma única fonte, indicar em qual parte e em qual página está a informação, e permitir abrir o arquivo já na página indicada.

## Como vai ficar

Abaixo da resposta, o bloco de fontes passa a listar **um item por documento**, com as partes agrupadas dentro dele:

```text
Fontes (1 documento · 4 trechos)

Petição inicial e anexos.pdf
   [F1] Parte 2 · p. 143     ← clicável
   [F3] Parte 2 · p. 147     ← clicável
   [F5] Parte 7 · p. 612     ← clicável
```

- O nome do documento aparece uma única vez (sem "- parte 3" no título).
- Cada trecho mostra "Parte N" e a página **do documento original** (a numeração já é contínua, então p. 612 é a página 612 do arquivo inteiro).
- Clicar em um trecho abre o visualizador do arquivo daquela parte, posicionado na página citada, com o texto do trecho ao lado para conferência e a opção de abrir em nova aba.
- Documentos que não foram divididos continuam como hoje, apenas com a página clicável.

## O que muda tecnicamente

1. **`src/lib/chat-rag.server.ts`** — ao montar as citações, buscar também `split_group_id`, `part_index`, `part_count`, `page_offset` e `parent_document_id` dos documentos citados; acrescentar ao tipo `Citation`: `group_key`, `base_filename`, `part_index`, `part_count`, `page` (página global) e `page_in_part` (`page - page_offset`, usada para abrir o PDF na página certa). O rótulo enviado ao modelo (`labelFor`/`contextBlock`) passa a usar nome-base + "Parte N" + página, para que a própria resposta cite a fonte de forma consistente.
2. **Nome-base compartilhado** — mover `baseDocumentName` de `src/components/documents/document-list.tsx` para um módulo compartilhado (`src/lib/documents/naming.ts`) e reutilizá-lo no servidor e na interface, sem alterar o comportamento da lista de documentos.
3. **Novo componente `src/components/chat/source-viewer-dialog.tsx`** — diálogo que chama `getDocumentUrl` e exibe o arquivo em iframe com `#page=<page_in_part>`, mostrando trecho, parte e página, além de botão para nova aba.
4. **`SourcesBlock` em `src/components/chat/jurismind-chat.tsx`** — reagrupar as citações por `group_key`, renderizar cabeçalho por documento e trechos clicáveis que abrem o novo diálogo; a contagem de "documentos" passa a considerar o grupo, não o nome do arquivo da parte.
5. **`src/components/chat/chat-panel.tsx`** — usar o mesmo agrupamento e o mesmo diálogo, para as duas superfícies de chat ficarem iguais.
6. **Compatibilidade** — citações antigas já salvas em `ai_chat_messages` não têm os novos campos; a interface cai no comportamento atual (nome do arquivo + localização) quando eles faltarem.

## Fora de escopo

Nenhuma mudança de banco, de indexação/leitura de documentos ou de permissões. A numeração de páginas já é gravada de forma contínua na indexação, então não há reprocessamento necessário.
