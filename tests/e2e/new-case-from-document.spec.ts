import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * E2E: criar Novo caso a partir de um documento (PDF).
 *
 * Fluxo testado:
 *  1. Login com e-mail/senha (E2E_EMAIL / E2E_PASSWORD).
 *  2. Abrir /cases/new.
 *  3. Enviar tests/fixtures/sample-case.pdf na área "Importar documento".
 *  4. Aguardar extração da IA e validar que TODOS os campos foram preenchidos
 *     com valores plausíveis vindos do documento.
 *  5. Salvar e validar que:
 *     - navegamos para /cases/:id
 *     - o PDF aparece anexado na seção "Documentos" do caso.
 */

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/sample-case.pdf",
);

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.beforeAll(() => {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `Fixture PDF não encontrado em ${FIXTURE_PATH}. Gere com o script descrito no README dos testes.`,
    );
  }
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Defina E2E_EMAIL e E2E_PASSWORD com credenciais de um usuário existente do projeto.",
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

test("novo caso a partir de PDF: IA preenche campos e anexa o arquivo", async ({
  page,
}) => {
  await login(page);

  // 1. Abrir formulário de novo caso
  await page.goto("/cases/new");
  await expect(
    page.getByRole("heading", { name: "Novo caso" }),
  ).toBeVisible();

  // 2. Enviar o PDF — o input está oculto, então usamos setInputFiles direto
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE_PATH);

  // 3. Aguarda indicador de extração aparecer e desaparecer
  const extracting = page.getByText("Lendo documento e extraindo dados...");
  await expect(extracting).toBeVisible({ timeout: 15_000 });
  await expect(extracting).toBeHidden({ timeout: 90_000 });

  // Badge "Anexado" deve aparecer
  await expect(page.getByText("Anexado")).toBeVisible();
  await expect(page.getByText("sample-case.pdf")).toBeVisible();

  // 4. Validar que TODOS os campos foram preenchidos a partir do documento
  const title = page.getByLabel("Título *");
  const client = page.getByLabel("Cliente");
  const caseNumber = page.getByLabel("Número do processo");
  const jurisdiction = page.getByLabel(/Vara/);
  const description = page.getByLabel(/Descrição/);

  await expect(title).not.toHaveValue("");
  await expect(client).not.toHaveValue("");
  await expect(caseNumber).not.toHaveValue("");
  await expect(jurisdiction).not.toHaveValue("");
  await expect(description).not.toHaveValue("");

  // Valores devem refletir o conteúdo do PDF de fixture
  await expect(client).toHaveValue(/Maria/i);
  await expect(caseNumber).toHaveValue(/1023456-78\.2025\.8\.26\.0100/);
  await expect(jurisdiction).toHaveValue(/Vara|TJSP|São Paulo/i);
  await expect(description).toHaveValue(/(dano|indeniza|consumo|crédito)/i);

  // Tipo do caso (Select shadcn): o trigger mostra o valor selecionado
  const typeTrigger = page.locator("#case_type");
  await expect(typeTrigger).not.toHaveText(/Selecione/);
  await expect(typeTrigger).toContainText(/Cível|Consumidor/i);

  // Partes: pelo menos uma linha (autor e réu) deve ter sido extraída
  const partyNames = page.getByPlaceholder("Nome");
  await expect(partyNames.first()).not.toHaveValue("");
  expect(await partyNames.count()).toBeGreaterThanOrEqual(1);

  // 5. Submeter o formulário
  await page.getByRole("button", { name: /Criar caso|Salvar/i }).click();

  // Deve navegar para /cases/<uuid>
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // 6. Validar que o documento foi anexado ao caso
  await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  await expect(page.getByText("sample-case.pdf")).toBeVisible();
});
