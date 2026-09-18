# Fechar cadastro e acesso por convite

## Objetivo
Permitir cadastro e uso do JurisMind somente a pessoas autorizadas por convite de e-mail.

## Implementação
- Remover o cadastro público e qualquer chamada de teste gratuito que abra uma conta livremente.
- Exibir criação de conta somente quando a pessoa chega por um convite válido e vigente.
- Criar a conta no servidor após conferir token, e-mail e validade do convite; o cliente não poderá escolher outro e-mail.
- Desativar novos cadastros diretos no provedor de autenticação, impedindo contorno pela API pública.
- Manter login por senha e Google para contas já existentes.
- Bloquear a área interna para contas sem vínculo ativo com um escritório ou papel interno autorizado.
- Após o cadastro, retornar ao convite para concluir o vínculo com o escritório.

## Segurança e validação
- Convites revogados, expirados, já usados ou destinados a outro e-mail serão recusados.
- O vínculo com o escritório continuará sendo criado somente após aceite autenticado.
- Validar cadastro por convite, login existente, tentativa sem convite e acesso de conta sem vínculo.
