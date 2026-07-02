Instalar e configurar Storybook para o projeto, depois criar uma story completa para o JurisMindMark.

## Contexto
O projeto usa TanStack Start + Vite 8 + Tailwind v4 e ainda não tem Storybook instalado. O usuário pediu uma seção de Storybook para o componente `JurisMindMark` mostrando cada `context` e o efeito de `variant` como override. A recomendação é instalar o Storybook, que é a ferramenta padrão (e gratuita) para documentação visual de componentes.

## Passos

1. Instalar Storybook e addons necessários
   - `storybook` (framework)
   - `@storybook/react-vite` (renderer para React + Vite)
   - `@storybook/addon-essentials` (controls, docs, actions)
   - `@storybook/addon-interactions` (opcional, para testes de interação)
   - `@storybook/test` (auxiliares de teste, já inclui `@storybook/testing-library`)

2. Inicializar configuração do Storybook
   - Criar `.storybook/main.ts` apontando para arquivos `*.stories.tsx` dentro de `src/components/brand/` (ou `src/**/*.stories.tsx`).
   - Criar `.storybook/preview.ts` importando os estilos globais (`src/styles.css`) para que o Tailwind v4 e os tokens funcionem nos stories.
   - Configurar path aliases (`@/`) e framework Vite corretamente.

3. Garantir compatibilidade com Tailwind v4
   - O Tailwind v4 carrega via `@import "tailwindcss"` no CSS. A preview do Storybook deve importar `src/styles.css` para que as classes utilitárias e os temas funcionem.
   - Verificar se `storybook dev` renderiza corretamente sem erros de CSS/PostCSS.

4. Criar a story de JurisMindMark
   - Arquivo: `src/components/brand/jurismind-mark.stories.tsx`.
   - Meta com `argTypes` para `context`, `variant`, `size`, `rounded` e `className`.
   - Uma story padrão para brincar com os controls.
   - Uma story "All Contexts" que renderiza todos os contextos em grid com labels.
   - Uma story "Variant Override" mostrando o mesmo contexto com diferentes variantes, para deixar explícito o efeito de override.

5. Ajustar scripts no `package.json`
   - `storybook`: `storybook dev -p 6006`
   - `build-storybook`: `storybook build`

6. Verificar
   - Rodar `bun storybook` (ou `storybook dev`) para garantir que inicia sem erros.
   - Verificar que as imagens dos assets aparecem corretamente nas stories (o Storybook via Vite deve respeitar os imports de `.asset.json`).

## Notas técnicas
- Storybook 8+ é compatível com Vite 5/6/7/8. Usar a versão mais recente estável.
- Não alterar o runtime de produção do app (rotas, server functions, etc.) — o Storybook vive fora do fluxo principal.
- Se a instalação do Storybook padrão conflitar com o Vite 8 beta, usar flags para forçar a versão compatível ou ajustar manualmente os pacotes.