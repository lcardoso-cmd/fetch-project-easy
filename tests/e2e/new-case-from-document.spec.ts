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

  // Captura a resposta do server fn de extração pra ter certeza que o backend
  // terminou de processar antes de validar os campos no DOM.
  const extractionResponse = page.waitForResponse(
    (res) =>
      /extractCaseDataFromDocument/i.test(res.url()) &&
      res.request().method() === "POST",
    { timeout: 120_000 },
  );

  await fileInput.setInputFiles(FIXTURE_PATH);

  // 3. Aguarda indicador de extração aparecer e desaparecer
  const extracting = page.getByText("Lendo documento e extraindo dados...");
  await expect(extracting).toBeVisible({ timeout: 15_000 });

  const extractRes = await extractionResponse;
  expect(extractRes.ok(), "server fn de extração deve responder 2xx").toBe(true);

  await expect(extracting).toBeHidden({ timeout: 90_000 });

  // Badge "Anexado" + nome do arquivo confirmam que o upload já está persistido
  await expect(page.getByText("Anexado")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("sample-case.pdf")).toBeVisible();

  // 4. Validar que TODOS os campos foram preenchidos a partir do documento
  const title = page.getByLabel("Título *");
  const client = page.getByLabel("Cliente");
  const caseNumber = page.getByLabel("Número do processo");
  const jurisdiction = page.getByLabel(/Vara/);
  const description = page.getByLabel(/Descrição/);

  // Espera o React commitar os valores extraídos antes de afirmar conteúdo.
  // toHaveValue com timeout faz polling — evita race com o setState pós-fetch.
  await expect(title).not.toHaveValue("", { timeout: 15_000 });
  await expect(client).not.toHaveValue("", { timeout: 15_000 });
  await expect(caseNumber).not.toHaveValue("", { timeout: 15_000 });
  await expect(jurisdiction).not.toHaveValue("", { timeout: 15_000 });
  await expect(description).not.toHaveValue("", { timeout: 15_000 });

  // Valores devem refletir o conteúdo do PDF de fixture
  await expect(client).toHaveValue(/Maria/i, { timeout: 10_000 });
  await expect(caseNumber).toHaveValue(/1023456-78\.2025\.8\.26\.0100/, {
    timeout: 10_000,
  });
  await expect(jurisdiction).toHaveValue(/Vara|TJSP|São Paulo/i, {
    timeout: 10_000,
  });
  await expect(description).toHaveValue(/(dano|indeniza|consumo|crédito)/i, {
    timeout: 10_000,
  });

  // Tipo do caso (Select shadcn): o trigger mostra o valor selecionado
  const typeTrigger = page.locator("#case_type");
  await expect(typeTrigger).not.toHaveText(/Selecione/, { timeout: 10_000 });
  await expect(typeTrigger).toContainText(/Cível|Consumidor/i);

  // Partes: pelo menos uma linha (autor e réu) deve ter sido extraída
  const partyNames = page.getByPlaceholder("Nome");
  await expect(partyNames.first()).not.toHaveValue("", { timeout: 10_000 });
  expect(await partyNames.count()).toBeGreaterThanOrEqual(1);

  // 5. Submeter o formulário — captura as chamadas de criação, anexo e indexação
  const createCaseResp = page.waitForResponse(
    (r) => /createCase/i.test(r.url()) && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  const attachResp = page.waitForResponse(
    (r) =>
      /attachDocumentToCase/i.test(r.url()) && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  const indexResp = page.waitForResponse(
    (r) => /indexDocument/i.test(r.url()) && r.request().method() === "POST",
    { timeout: 120_000 },
  );

  await page.getByRole("button", { name: /Criar caso|Salvar/i }).click();

  const createRes = await createCaseResp;
  expect(createRes.ok(), "createCase deve responder 2xx").toBe(true);

  const attachRes = await attachResp;
  expect(attachRes.ok(), "attachDocumentToCase deve responder 2xx").toBe(true);

  // A indexação dispara após o anexo — esperamos ela terminar antes de afirmar
  // que o documento está disponível na página do caso.
  const idxRes = await indexResp;
  expect(idxRes.ok(), "indexDocument deve responder 2xx").toBe(true);

  // Deve navegar para /cases/<uuid>
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // 6. Validar que o documento foi anexado ao caso e está visível na lista.
  // Espera explicitamente o card "Documentos" e o nome do arquivo.
  await expect(
    page.getByRole("heading", { name: "Documentos" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("sample-case.pdf")).toBeVisible({
    timeout: 30_000,
  });

  // Aguarda o status de indexação refletir "indexado" / sumir o "processando".
  // Se a UI mostrar um badge "Processando", esperamos ele desaparecer; se
  // mostrar "Indexado", esperamos ele aparecer. Qualquer um dos dois resolve.
  const processing = page.getByText(/Processando|Indexando/i).first();
  if (await processing.isVisible().catch(() => false)) {
    await expect(processing).toBeHidden({ timeout: 60_000 });
  }
});

