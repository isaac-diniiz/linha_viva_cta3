import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DEMO_MODE,
  "Executar com DEMO_MODE=1 e servidor npm run demo.",
);

test("projeção mostra a instrução da atividade", async ({ page }) => {
  await page.goto("/demo/projetor");
  const instruction =
    "Organize as etapas do ciclo da água na sequência correta.";
  await expect(page.getByText(instruction)).toBeVisible();
});

test("projeção mostra QR de entrada até a atividade começar", async ({
  browser,
}) => {
  const teacher = await browser.newPage();
  await teacher.goto("/demo/professor");
  // a sessão é única no servidor; outro teste pode tê-la deixado iniciada
  const reset = teacher.getByRole("button", { name: "Reiniciar demonstração" });
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(
    teacher.getByRole("button", { name: "Iniciar atividade" }),
  ).toBeEnabled();
  const projection = await browser.newPage();
  await projection.goto("/demo/projetor");
  const studentLink = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  const qr = projection.getByRole("img", {
    name: "QR Code para alunos entrarem",
  });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute(
    "data-join-url",
    new RegExp(`${await studentLink.getAttribute("href")}$`),
  );
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);

  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await expect(qr).toHaveCount(0);
  await projection.close();
  await teacher.close();
});

test("professor escolhe a atividade por disciplina e os alunos recebem cartões dela", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "A escolha da atividade é feita no painel do professor.");
  const narrative = JSON.parse(
    readFileSync("atividades/narrativa-viva.json", "utf8"),
  ) as { titulo: string; cartoes: { texto: string }[] };
  const teacher = await browser.newPage();
  await teacher.goto("/demo/professor");
  const reset = teacher.getByRole("button", { name: "Reiniciar demonstração" });
  await expect(reset).toBeEnabled();
  await reset.click();
  const portuguese = teacher.getByRole("group", { name: "Língua Portuguesa" });
  try {
    // o rádio só fica marcado quando o servidor confirma a troca
    const option = portuguese.getByRole("radio", { name: /Narrativa Viva/ });
    await option.click();
    await expect(option).toBeChecked();
    await expect(teacher.getByRole("heading", { level: 1 })).toHaveText(
      narrative.titulo,
    );
    const projection = await browser.newPage();
    await projection.goto("/demo/projetor");
    await expect(projection.getByRole("heading", { level: 1 })).toHaveText(
      narrative.titulo,
    );
    const student = await browser.newPage();
    await student.goto("/demo/aluno");
    const card = student.locator(".drag-card > span");
    await expect(card).toHaveText(
      new RegExp(
        `^(${narrative.cartoes
          .map(({ texto }) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})$`,
      ),
    );
    await student.close();
    await projection.close();
  } finally {
    // devolve o tema inicial, usado pelos demais testes da sessão única
    const initial = teacher
      .getByRole("group", { name: "Ciências" })
      .getByRole("radio", { name: /Ciclo da água/ });
    await initial.click();
    await expect(initial).toBeChecked();
    await teacher.close();
  }
});

test("professor, aluno e projeção compartilham o movimento antes da confirmação", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(isMobile, "O percurso de arraste é executado no projeto desktop.");
  await page.goto("/");
  await page.getByRole("link", { name: "Professor" }).click();
  await expect(page.getByText("CÓDIGO DA TURMA · DEMO1234")).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar demonstração" }).click();

  const projection = await browser.newPage();
  await projection.goto("/demo/projetor");
  const student = await browser.newPage();
  await student.goto("/demo/aluno");
  const card = student.locator(".drag-card");
  await expect(card).toBeDisabled();
  await page.getByRole("button", { name: "Iniciar atividade" }).click();
  await expect(card).toBeEnabled();
  const start = await card.boundingBox();
  const board = await student.getByTestId("board-track").boundingBox();
  if (!start || !board) throw new Error("Caixa ou eixo não encontrado.");
  await student.mouse.move(
    start.x + start.width / 2,
    start.y + start.height / 2,
  );
  await student.mouse.down();
  await student.mouse.move(
    board.x + board.width * 0.25,
    board.y + board.height * 0.3,
    { steps: 8 },
  );
  await expect(projection.locator(".preview-card")).toBeVisible();
  await expect(projection.locator(".confirmed-card")).toHaveCount(0);
  await student.waitForTimeout(180);
  await student.mouse.move(
    board.x + board.width * 0.7,
    board.y + board.height * 0.6,
    { steps: 1 },
  );
  await expect
    .poll(async () =>
      projection.locator(".preview-card").getAttribute("data-x"),
    )
    .toBe("0.7");
  await student.mouse.up();
  await expect(projection.locator(".confirmed-card")).toBeVisible();
  await expect(projection.locator(".confirmed-card")).toHaveAttribute(
    "style",
    /left: 70%/,
  );
  await expect(projection.locator(".preview-card")).toHaveCount(0);
  await projection.close();
  await student.close();
});

test("aluno no celular pode posicionar pela alternativa ao arraste", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Executar no projeto mobile.");
  const teacher = await browser.newPage();
  await teacher.goto("/demo/professor");
  await expect(
    teacher.getByRole("button", { name: "Reiniciar demonstração" }),
  ).toBeEnabled();
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await page.goto("/demo/aluno");
  const card = page.locator(".drag-card");
  await expect(card).toBeEnabled();
  await page
    .getByRole("slider", { name: /Outra forma de posicionar/ })
    .fill("80");
  await page
    .getByRole("button", { name: "Confirmar posição escolhida" })
    .click();
  await expect(page.getByText("Seu voto foi registrado.")).toBeVisible();
  await expect(page.locator(".confirmed-card")).toHaveAttribute(
    "style",
    /left: 80%/,
  );
  await teacher.close();
});
