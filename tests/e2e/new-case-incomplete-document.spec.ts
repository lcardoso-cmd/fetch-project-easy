import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * E2E: PDF incompleto -> a tela de revisão precisa listar warnings/missing
 * e o botão "Criar caso" só pode ser habilitado depois que o usuário marca
 * a confirmação. Submeter sem confirmar não pode criar o caso.
 */

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/incomplete-case.pdf",
);

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.beforeAll(() => {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `Fixture ausente: ${FIXTURE_PATH}. Rode: python3 tests/fixtures/generate-incomplete-pdf.py`,
    );
  }
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Defina E2E_EMAIL e E2E_PASSWORD para rodar os testes E2E.",
    );
  }
});

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("PDF incompleto: tela de revisão mostra warnings e exige confirmação", async ({
  page,
}) => {
  await login(page);

  await page.goto("/cases/new");
  await expect(page.getByRole("heading", { name: "Novo caso" })).toBeVisible();

  // Aguarda a resposta do server fn de extração antes de validar a UI
  const extractionResponse = page.waitForResponse(
    (res) =>
      /extractCaseDataFromDocument/i.test(res.url()) &&
      res.request().method() === "POST",
    { timeout: 120_000 },
  );

  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);

  const extracting = page.getByText("Lendo documento e extraindo dados...");
  await expect(extracting).toBeVisible({ timeout: 15_000 });

  const extractRes = await extractionResponse;
  expect(extractRes.ok()).toBe(true);
  const payload = await extractRes.json().catch(() => ({}) as unknown);
  // O backend deve sinalizar pelo menos um campo ausente para esse PDF vago.
  const missing = (payload as { missing?: string[] })?.missing ?? [];
  expect(
    missing.length,
    `esperado missing.length > 0 no retorno da extração — recebido: ${JSON.stringify(missing)}`,
  ).toBeGreaterThan(0);

  await expect(extracting).toBeHidden({ timeout: 90_000 });

  // 1. Painel de revisão deve aparecer
  const reviewPanel = page.getByTestId("extraction-review");
  await expect(reviewPanel).toBeVisible({ timeout: 15_000 });
  await expect(
    reviewPanel.getByRole("heading", { name: /Revise os dados extraídos/i }),
  ).toBeVisible();

  // Lista de campos faltantes deve estar presente
  const missingList = page.getByTestId("review-missing");
  await expect(missingList).toBeVisible();

  // Os campos esperados como ausentes para esse fixture devem aparecer no painel.
  // Aceitamos qualquer subset razoável — exigimos cliente E número do processo,
  // que esse PDF deliberadamente não traz.
  await expect(missingList).toContainText(/cliente/i);
  await expect(missingList).toContainText(/número do processo/i);

  // 2. Checkbox de confirmação visível e desmarcado; botão "Criar caso" desabilitado
  const confirm = page.locator("#confirm-review");
  await expect(confirm).toBeVisible();
  await expect(confirm).not.toBeChecked();

  // Título é obrigatório — garantimos preenchido para isolar a regra de revisão
  const title = page.getByLabel("Título *");
  if ((await title.inputValue()).trim() === "") {
    await title.fill("Caso de teste — revisão obrigatória");
  }

  const submit = page.getByRole("button", { name: /Criar caso/i });
  await expect(submit).toBeDisabled();

  // 3. Tentar submeter sem confirmar (via Enter no título) não pode criar o caso.
  //    Capturamos qualquer POST para createCase pra garantir que NÃO aconteceu.
  let createCalled = false;
  const onReq = (req: import("@playwright/test").Request) => {
    if (/createCase/i.test(req.url()) && req.method() === "POST") {
      createCalled = true;
    }
  };
  page.on("request", onReq);

  await title.focus();
  await title.press("Enter");
  // Toast de erro do client-side
  await expect(
    page.getByText(/Revise os avisos da extração e confirme/i),
  ).toBeVisible({ timeout: 5_000 });

  // Pequena janela para garantir que nenhuma chamada vazou
  await page.waitForTimeout(1_500);
  expect(
    createCalled,
    "createCase não pode ser chamado enquanto a revisão não for confirmada",
  ).toBe(false);
  page.off("request", onReq);

  // URL não pode ter mudado
  expect(page.url()).toContain("/cases/new");

  // 4. Marcar confirmação habilita o botão e permite criar o caso
  await confirm.check();
  await expect(confirm).toBeChecked();
  await expect(submit).toBeEnabled();

  const createCaseResp = page.waitForResponse(
    (r) => /createCase/i.test(r.url()) && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await submit.click();
  const createRes = await createCaseResp;
  expect(createRes.ok()).toBe(true);

  await page.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 30_000 });
});
