# Substituir favicon pela imagem enviada

## Objetivo
Trocar o favicon atual do JurisMind pelo ícone enviado (`apple-touch-icon.png`).

## Passos
1. **Preparar o asset**: redimensionar a imagem enviada para 64×64 px mantendo proporção (padding em vez de esticar) e salvá-la como `public/favicon.png`.
2. **Atualizar a referência**: trocar o link do favicon em `src/routes/__root.tsx` para apontar para `/favicon.png`.
3. **Remover o antigo**: deletar `public/favicon.ico` para não servir o ícone legado.
4. **Validar**: verificar se o novo favicon aparece na aba do navegador no preview.

## Escopo
Apenas o favicon. Nenhuma outra funcionalidade, rota ou componente será alterado.
