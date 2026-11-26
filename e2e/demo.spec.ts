import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { slotPoint, newRound } from "./teacher-login";

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
  const reset = teacher.getByRole("button", { name: "Nova rodada" });
  await expect(reset).toBeEnabled();
  await newRound(teacher);
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
  // quem chega atrasado ainda vê o código da turma
  const code = (await studentLink.getAttribute("href"))?.split("/").at(-1);
  await expect(
    projection.getByRole("region", { name: "Entrar na turma" }),
  ).toContainText(code ?? "");
  await expect(
    projection.getByRole("status", { name: "Estado da atividade" }),
  ).toHaveText("Em construção");
  await projection.close();
  await teacher.close();
});

test("a referência revelada cabe na tela da projeção", async ({ browser }) => {
  const teacher = await browser.newPage();
  await teacher.goto("/demo/professor");
  const reset = teacher.getByRole("button", { name: "Nova rodada" });
  await expect(reset).toBeEnabled();
  await newRound(teacher);
  const projection = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await projection.goto("/demo/projetor");
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await teacher.getByRole("button", { name: "Revelar referência" }).click();
  const reference = projection.getByRole("region", {
    name: "Sequência de referência",
  });
  await expect(reference).toBeInViewport({ ratio: 1 });
  // o tema depende de testes anteriores (reiniciar preserva o tema): só confere que há etapas
  await expect(reference.getByRole("listitem").first()).toBeVisible();
  await expect(reference.getByRole("listitem").last()).toBeInViewport();
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
  const reset = teacher.getByRole("button", { name: "Nova rodada" });
  await expect(reset).toBeEnabled();
  await newRound(teacher);
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
    await student.goto("/demo/aluno/DEMO1234");
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
  await newRound(page);
  // 3 cartões por pessoa: a trilha do Ciclo da água fica com 3 casas
  const perParticipant = page.getByLabel("Cartões por participante");
  try {
    await perParticipant.selectOption("3");
    await expect(perParticipant).toHaveValue("3");
    const projection = await browser.newPage();
    await projection.goto("/demo/projetor");
    const student = await browser.newPage();
    await student.goto("/demo/aluno/DEMO1234");
    const card = student.locator(".drag-card").first();
    await expect(card).toBeDisabled();
    await page.getByRole("button", { name: "Iniciar atividade" }).click();
    await expect(card).toBeEnabled();
    const start = await card.boundingBox();
    if (!start) throw new Error("Cartão não encontrado.");
    await student.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await student.mouse.down();
    const second = await slotPoint(student, 1);
    await student.mouse.move(second.x, second.y, { steps: 8 });
    // a projeção recebe a posição na trilha antes de o aluno soltar
    const preview = projection.locator(".preview-card");
    await expect(preview).toBeVisible();
    await expect(projection.locator(".confirmed-card")).toHaveCount(0);
    await expect
      .poll(async () => Number(await preview.getAttribute("data-position")))
      .toBeCloseTo(0.5, 2);
    await student.waitForTimeout(180);
    const third = await slotPoint(student, 2);
    await student.mouse.move(third.x, third.y, { steps: 1 });
    await expect
      .poll(async () => Number(await preview.getAttribute("data-position")))
      .toBeCloseTo(5 / 6, 2);
    await student.mouse.up();
    // ao soltar, o cartão encaixa na 3ª casa e a prévia some
    await expect(projection.locator(".confirmed-card")).toHaveCount(1);
    await expect(projection.locator(".confirmed-card")).toHaveAttribute(
      "data-slot",
      "2",
    );
    await expect(projection.locator(".preview-card")).toHaveCount(0);
    await projection.close();
    await student.close();
  } finally {
    // reiniciar preserva a quantidade: devolve um cartão por participante
    await newRound(page);
    await perParticipant.selectOption("1");
    await expect(perParticipant).toHaveValue("1");
  }
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
    teacher.getByRole("button", { name: "Nova rodada" }),
  ).toBeEnabled();
  await newRound(teacher);
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await page.goto("/demo/aluno/DEMO1234");
  const card = page.locator(".drag-card");
  await expect(card).toBeEnabled();
  // professor e aluno têm Evaporação: a trilha tem uma casa
  const slider = page.getByRole("slider", {
    name: /Outra forma de posicionar/,
  });
  await slider.fill("1");
  await expect(page.getByText("Casa 1 de 1")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar posição escolhida" })
    .click();
  await expect(page.getByText("Seu voto foi registrado.")).toBeVisible();
  await expect(page.locator(".confirmed-card")).toHaveAttribute(
    "data-slot",
    "0",
  );
  // a marca de confirmado fica fora do cartão, sem cobrir o nome dele
  const mark = page.locator(".own-cards .placed-mark");
  await expect(mark).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const markBox = (await mark.boundingBox())!;
  expect(markBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
  // ao revelar, o aluno vê no próprio celular onde o cartão dele ficou
  await teacher.getByRole("button", { name: "Revelar referência" }).click();
  await expect(
    page.getByRole("region", { name: "Seu cartão na resposta" }),
  ).toContainText("Evaporação: ✓ na casa certa (1).");
  // a comparação de todos os cartões fica na projeção, não na trilha do celular
  await expect(page.locator(".confirmed-card")).not.toContainText("casa certa");
  await teacher.close();
});

test("no celular em pé, caixas confirmadas próximas não se cobrem", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Executar no projeto mobile.");
  const teacher = await browser.newPage();
  await teacher.goto("/demo/professor");
  const reset = teacher.getByRole("button", { name: "Nova rodada" });
  await expect(reset).toBeEnabled();
  await newRound(teacher);
  const perParticipant = teacher.getByLabel("Cartões por participante");
  try {
    await perParticipant.selectOption("3");
    await expect(perParticipant).toHaveValue("3");
    await page.goto("/demo/aluno/DEMO1234");
    await expect(page.locator(".drag-card")).toHaveCount(3);
    await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
    const chooser = page.getByLabel("Cartão para posicionar");
    const labels = await chooser.locator("option").allTextContents();
    // os três cartões são soltos na mesma casa: cada um empurra o anterior
    for (const [index, label] of labels.entries()) {
      await chooser.selectOption({ label });
      await page
        .getByRole("slider", { name: /Outra forma de posicionar/ })
        .fill("2");
      await page
        .getByRole("button", { name: "Confirmar posição escolhida" })
        .click();
      await expect(page.getByText("✓ na linha")).toHaveCount(index + 1);
    }
    const cards = page.locator(".confirmed-card");
    await expect(cards).toHaveCount(3);
    // cada cartão numa casa diferente da trilha
    await expect
      .poll(async () =>
        (
          await Promise.all(
            (await cards.all()).map((card) => card.getAttribute("data-slot")),
          )
        ).sort(),
      )
      .toEqual(["0", "1", "2"]);
    // espera as faixas se acomodarem antes de medir
    await expect
      .poll(async () => {
        const boxes = await Promise.all(
          (await cards.all()).map((card) => card.boundingBox()),
        );
        let overlaps = 0;
        for (const [i, a] of boxes.entries())
          for (const b of boxes.slice(i + 1))
            if (
              a &&
              b &&
              a.x < b.x + b.width &&
              b.x < a.x + a.width &&
              a.y < b.y + b.height &&
              b.y < a.y + a.height
            )
              overlaps++;
        return overlaps;
      })
      .toBe(0);
  } finally {
    // devolve um cartão por participante: reiniciar preserva a quantidade
    await newRound(teacher);
    await perParticipant.selectOption("1");
    await expect(perParticipant).toHaveValue("1");
    await teacher.close();
  }
});
