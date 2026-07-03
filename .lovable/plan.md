Do I know what the issue is? Sim: o publicado não está falhando só em `/auth`; `/` também retorna HTTP 500. Os logs de produção mostram repetidamente `TypeError: Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined` e depois `h3 swallowed SSR error`. Isso aponta para import estático, no bundle SSR, de bibliotecas que dependem de `tslib`/CJS interop e quebram no runtime publicado.

## Plano de correção

1. **Remover imports estáticos que quebram o boot SSR**
   - Trocar import estático de `pdf-lib` em componentes/rotas por `await import(...)` somente no momento de uso.
   - Trocar import estático de `pptxgenjs` em `/api/tools/presentation` por import dinâmico dentro do `POST`.
   - Trocar imports estáticos de `renderPdf`/`contentToBlocks` nas rotas de PDF por imports dinâmicos dentro do handler, para `pdf-lib` não entrar na inicialização global do servidor.

2. **Isolar geradores de arquivo do carregamento global da aplicação**
   - Garantir que `.docx`, `.pdf` e `.pptx` só carreguem quando o usuário pedir exportação/download.
   - Manter a página inicial, `/auth`, `/entrar`, `/agenda` e demais páginas livres desses módulos durante SSR.

3. **Corrigir o fallback “This page didn’t load”**
   - O botão **Go home** hoje aponta para `/`, mas como `/` também está retornando 500, ele parece “não funcionar”.
   - Ajustar o fallback para deixar claro que **Try again** recarrega e **Go home** usa navegação direta para `/` depois que o boot estiver corrigido; se necessário, adicionar uma alternativa segura para `/entrar` quando `/` continuar indisponível.

4. **Validar contra o publicado antes de encerrar**
   - Testar `GET /`, `GET /auth` e uma rota autenticada pública/redirecionável após a alteração.
   - Conferir logs publicados para garantir que o erro `__extends` desapareceu.
   - Só depois considerar resolvido e pedir republicação se necessário.

## Arquivos prováveis

- `src/routes/api/tools/pdf.ts`
- `src/routes/api/public/proposal-share.$token.ts`
- `src/routes/api/tools/presentation.ts`
- `src/components/documents/file-preview-card.tsx`
- Se aparecer outro import SSR-visible de `pdf-lib`, `docx` ou `pptxgenjs`, aplicar o mesmo padrão.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>