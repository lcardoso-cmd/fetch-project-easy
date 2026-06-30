# JurisMind híbrido: advogados, peritos e assistentes técnicos

Transformar o produto em uma plataforma única que atenda três perfis profissionais com o mesmo motor (RAG, prazos, extração, chat), adaptando vocabulário, campos e templates por perfil.

## Modelo de perfis

Três `practice_type` no perfil do usuário:

- `advogado` — atua em processos do cliente.
- `perito_judicial` — nomeado pelo juízo para produzir laudo.
- `assistente_tecnico` — contratado por uma das partes para assessorar/criticar o laudo.

Cada usuário escolhe **um perfil principal no onboarding** (fica fixo, mas editável em Configurações). Em cada caso, há um override opcional `case.practice_type` para quem atua nos três papéis ocasionalmente.

Especialidades suportadas (campo livre + sugestões): contábil, engenharia (civil/mecânica/elétrica/segurança do trabalho), médica, psicológica, ambiental, grafotécnica, TI/digital, avaliação de imóveis, "outra".

## Mudanças no banco

```text
profiles
  + practice_type        text   (advogado|perito_judicial|assistente_tecnico)
  + specialty            text   (livre, ex. "contábil")
  + onboarding_completed boolean default false

cases
  + practice_type            text   (override opcional do perfil do usuário)
  + matter_kind              text   (processo|pericia|assistencia_tecnica)
  + assisted_party_name      text   (só para AT — qual parte o profissional assiste)
  + perito_fee_cents         integer
  + perito_appointment_date  date
  + perito_deadline_date     date
  + perito_nomination_ref    text   (nº de nomeação / despacho)

case_quesitos (nova)
  id uuid pk, case_id uuid fk, source text (juizo|autor|reu|assistido),
  number int, question text, answer text null, created_at timestamptz
```

Tudo com GRANT padrão `authenticated` + `service_role`, RLS por `auth.uid()` (mesmo padrão das demais tabelas do projeto).

## Onboarding

Nova rota `/_authenticated/onboarding` exibida na primeira sessão (gate em `__root` ou redirect quando `onboarding_completed = false`):

1. Selecionar perfil (3 cards: Advogado / Perito Judicial / Assistente Técnico).
2. Para perito/AT: selecionar especialidade (chips + "outra").
3. Confirmar → grava em `profiles`, marca `onboarding_completed = true`.

Editável depois em Configurações → "Perfil profissional".

## Adaptação dos formulários e telas

**Vocabulário dinâmico** via util `usePracticeLabels(practiceType)`:

| Conceito | Advogado | Perito | Assistente Técnico |
|---|---|---|---|
| Entidade principal | Caso | Perícia | Assistência |
| Parte vinculada | Cliente | (sem cliente direto) | Parte assistida |
| Saída esperada | Petição | Laudo pericial | Parecer técnico |
| "Represento" | Represento | — | Assisto |

**`cases.new.tsx`**: blocos condicionais por `matter_kind`.

- `processo` (advogado): formulário atual + validação já implementada.
- `pericia`: troca "Cliente" por "Órgão nomeante" (vara), exibe campos de honorários, data de nomeação, prazo do laudo, e card de **Quesitos** (juízo / autor / réu).
- `assistencia_tecnica`: campo "Parte assistida" obrigatório, card de **Quesitos** (assistido + impugnações ao laudo oficial), upload sugerido do laudo oficial.

A validação inline existente é estendida para os campos novos quando aplicáveis.

**Lista de casos** (`cases.tsx`): filtro adicional por `matter_kind`, ícone distinto e badge ("Perícia", "Assistência"). Título do menu lateral muda para "Casos e perícias" quando o perfil não é exclusivamente advogado.

**Detalhe do caso** (`cases.$caseId.tsx`): aba extra "Quesitos" quando `matter_kind ≠ processo`. Resumo JurisMind do caso passa a usar o vocabulário do perfil.

## Extração JurisMind adaptada

`extractCaseDataFromDocument` ganha parâmetro `matter_kind` e roteia para um prompt específico:

- Processo: prompt atual.
- Perícia: extrai também nº de nomeação, prazo, quesitos por origem, honorários quando aparecem no despacho.
- Assistência técnica: extrai laudo oficial (conclusões), quesitos da parte assistida, pontos de impugnação sugeridos.

A revisão visual amber/vermelha já implementada continua valendo para qualquer um dos perfis.

## Templates de saída (gerador de documentos)

`proposal.tsx` vira "Gerador de documentos" com seleção do tipo conforme perfil:

- Advogado: petição inicial, contestação, recurso, proposta de honorários.
- Perito: laudo pericial estruturado (identificação, metodologia, resposta aos quesitos, conclusão, anexos).
- Assistente técnico: parecer técnico, impugnação ao laudo oficial, quesitos suplementares.

Mesmo pipeline RAG + prompt-template por tipo. Saída em markdown + export DOCX/PDF (reaproveita o que já existe).

## Plano de execução (ordem)

1. **Migração** + GRANTs/RLS para colunas e tabela `case_quesitos`.
2. **Onboarding** + edição em Configurações + gate no root.
3. **`usePracticeLabels`** e troca de vocabulário em menu, listas e detalhe.
4. **`cases.new.tsx`**: seletor de `matter_kind`, blocos condicionais, validação estendida, card de quesitos.
5. **`cases.$caseId.tsx`**: aba de quesitos, labels adaptados.
6. **Extração JurisMind** por `matter_kind` (prompts dedicados).
7. **Gerador de documentos** com templates por perfil.
8. Ajustes de copy na landing (`index.tsx`) — "para advogados, peritos e assistentes técnicos".

## Riscos e mitigações

- **Formulário inchado** → blocos condicionais com `Collapsible` por seção; nunca mostrar campos de outro perfil.
- **Confusão de vocabulário** → util central `usePracticeLabels`; nenhum texto hard-coded de "cliente"/"caso" em telas multi-perfil.
- **Migração de dados existentes** → todo caso atual recebe `matter_kind = 'processo'` por default; usuários existentes recebem `practice_type = 'advogado'` e `onboarding_completed = true` para não ver o onboarding.
- **Escopo grande** → entregar em etapas 1–4 primeiro (já dá produto utilizável pelos três perfis); 5–8 numa segunda passada.
