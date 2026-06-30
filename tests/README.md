# Testes End-to-End

## Setup

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

## Gerar o fixture PDF (uma vez)

Requer Python com `reportlab` instalado (`pip install reportlab`).

```bash
python3 tests/fixtures/generate-sample-pdf.py
```

O arquivo `tests/fixtures/sample-case.pdf` simula uma petição inicial com
número CNJ, vara, partes (autor/réu), tipo (cível/consumidor) e descrição —
material suficiente para a IA extrair todos os campos do Novo caso.

## Rodar

1. Crie (ou reuse) um usuário de QA no Lovable Cloud do projeto.
2. Suba a aplicação:

```bash
bun run dev
```

3. Exporte credenciais e rode:

```bash
export E2E_BASE_URL="http://localhost:8080"
export E2E_EMAIL="qa+jurismind@example.com"
export E2E_PASSWORD="••••••••"

bun run test:e2e
```

## O que o teste cobre

`tests/e2e/new-case-from-document.spec.ts`:

- Login com e-mail/senha.
- Upload do PDF na seção "Importar documento" do `/cases/new`.
- Aguarda extração da IA.
- Valida que **todos** os campos (título, cliente, número CNJ, vara, tipo,
  descrição e ao menos uma parte) foram preenchidos automaticamente e batem
  com o conteúdo do PDF.
- Submete e valida que o caso foi criado e o PDF aparece anexado em
  `/cases/:id`.
