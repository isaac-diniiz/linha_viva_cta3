import { expect, test } from "@playwright/test";

test.skip(!process.env.PUBLIC_DEMO_MODE, "Executar com PUBLIC_DEMO_MODE=1.");

test("QR da projeção acompanha o novo código após reiniciar", async ({
  browser,
}) => {
  const teacher = await browser.newPage();
  await teacher.goto(
    `/demo/professor?key=${process.env.DEMO_TEACHER_KEY ?? "teste-professor"}`,
  );
  const studentLink = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  await expect(studentLink).toBeVisible();
  // a sessão é única no servidor; outro teste pode tê-la deixado iniciada
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await expect(
    teacher.getByRole("button", { name: "Iniciar atividade" }),
  ).toBeEnabled();
  const projectionLink = teacher.getByRole("link", {
    name: "Abrir projeção ↗",
  });
  const projection = await browser.newPage();
  await projection.goto((await projectionLink.getAttribute("href")) ?? "");
  const qr = projection.getByRole("img", {
    name: "QR Code para alunos entrarem",
  });
  await expect(qr).toBeVisible();
  const oldUrl = await qr.getAttribute("data-join-url");
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await expect(qr).not.toHaveAttribute("data-join-url", oldUrl ?? "");
  await expect(qr).toHaveAttribute(
    "data-join-url",
    new URL((await studentLink.getAttribute("href")) ?? "", projection.url())
      .href,
  );
  await projection.close();
  await teacher.close();
});

test("participantes independentes recebem cartões, inclusive repetições, e confirmam ao vivo", async ({
  browser,
}) => {
  const teacher = await browser.newPage();
  await teacher.goto(
    `/demo/professor?key=${process.env.DEMO_TEACHER_KEY ?? "teste-professor"}`,
  );
  await expect(
    teacher.getByRole("button", { name: "Reiniciar demonstração" }),
  ).toBeEnabled();
  const share = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  await expect(share).toBeVisible();
  const oldStudentUrl = await share.getAttribute("href");
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await expect(share).not.toHaveAttribute("href", oldStudentUrl ?? "");
  const studentUrl = await share.getAttribute("href");
  if (!studentUrl) throw new Error("Link do aluno ausente");
  const projectionLink = teacher.getByRole("link", {
    name: "Abrir projeção ↗",
  });
  const projectionUrl = await projectionLink.getAttribute("href");
  if (!projectionUrl) throw new Error("Link da projeção ausente");
  const projection = await browser.newPage();
  await projection.goto(projectionUrl);
  const qr = projection.getByRole("img", {
    name: "QR Code para alunos entrarem",
  });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute(
    "data-join-url",
    `${new URL(studentUrl, projection.url()).href}`,
  );
  const students = [];
  const labels = [];
  for (let index = 0; index < 4; index++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(studentUrl);
    await expect(page.locator(".drag-card")).toBeVisible();
    students.push({ context, page });
    labels.push(await page.locator(".drag-card span").textContent());
  }
  expect(labels).toEqual([
    "Evaporação",
    "Condensação",
    "Precipitação",
    "Evaporação",
  ]);
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await expect(qr).toHaveCount(0);
  const firstStudent = students[0].page;
  await expect(firstStudent.locator(".drag-card")).toBeEnabled();
  const cardBox = await firstStudent.locator(".drag-card").boundingBox();
  const boardBox = await firstStudent.getByTestId("board-track").boundingBox();
  if (!cardBox || !boardBox) throw new Error("Cartão ou eixo ausente");
  await firstStudent.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2,
  );
  await firstStudent.mouse.down();
  await firstStudent.mouse.move(
    boardBox.x + boardBox.width * 0.45,
    boardBox.y + boardBox.height * 0.4,
    { steps: 8 },
  );
  await expect(projection.locator(".preview-card")).toBeVisible();
  await expect(projection.locator(".confirmed-card")).toHaveCount(0);
  await firstStudent.mouse.up();
  await expect(projection.locator(".confirmed-card")).toHaveCount(1);
  for (const [index, { page }] of students.entries()) {
    await page
      .getByRole("slider", { name: /Outra forma de posicionar/ })
      .fill(String(15 + index * 20));
    await page
      .getByRole("button", { name: "Confirmar posição escolhida" })
      .click();
    // Evaporação (alunos 0 e 3, mais o professor) é votada; os outros cartões são únicos
    await expect(
      page.getByText(
        index === 0 || index === 3
          ? "Seu voto foi registrado."
          : "Sua caixa foi colocada na linha coletiva.",
      ),
    ).toBeVisible();
    // cartões repetidos dividem uma só caixa na linha
    await expect(projection.locator(".confirmed-card")).toHaveCount(
      Math.min(index + 1, 3),
    );
  }
  await expect(projection.getByTestId("confirmed-evaporacao")).toContainText(
    "2 de 3 votaram",
  );
  await expect(teacher.locator(".confirmed-card")).toHaveCount(3);
  await students[1].page.reload();
  await expect(students[1].page.locator(".drag-card span")).toHaveText(
    labels[1] ?? "",
  );
  await expect(students[1].page.locator(".confirmed-card")).toHaveCount(3);
  await teacher.locator(".drag-card").scrollIntoViewIfNeeded();
  const teacherCard = await teacher.locator(".drag-card").boundingBox();
  const teacherBoard = await teacher.getByTestId("board-track").boundingBox();
  if (!teacherCard || !teacherBoard)
    throw new Error("Cartão do professor ausente");
  await teacher.mouse.move(
    teacherCard.x + teacherCard.width / 2,
    teacherCard.y + teacherCard.height / 2,
  );
  await teacher.mouse.down();
  await teacher.mouse.move(
    teacherBoard.x + teacherBoard.width * 0.9,
    teacherBoard.y + teacherBoard.height * 0.5,
    { steps: 8 },
  );
  await expect(projection.locator(".preview-card")).toBeVisible();
  await teacher.mouse.up();
  // o voto do professor completa o grupo e a linha continua com três caixas
  await expect(projection.getByTestId("confirmed-evaporacao")).toContainText(
    "3 de 3 votaram",
  );
  await expect(projection.locator(".confirmed-card")).toHaveCount(3);
  for (const { context } of students) await context.close();
  await projection.close();
  await teacher.close();
});

test("aluno entra pela página inicial digitando o código da turma", async ({
  browser,
  page,
}) => {
  const teacher = await browser.newPage();
  await teacher.goto(
    `/demo/professor?key=${process.env.DEMO_TEACHER_KEY ?? "teste-professor"}`,
  );
  const share = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  await expect(share).toBeVisible();
  const code = (await share.getAttribute("href"))!.split("/").pop()!;

  await page.goto("/");
  await page.getByRole("link", { name: "Aluno" }).click();
  const input = page.getByLabel(/código da turma/i);
  await expect(input).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await input.fill("ERRADO99");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Código da turma inválido",
  );
  await page.getByLabel(/código da turma/i).fill(code.toLowerCase());
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/aluno/${code}$`));
  await expect(page.locator(".drag-card")).toBeVisible();
  await teacher.close();
});

test("link sem chave não controla o professor nem lê a projeção", async ({
  browser,
}) => {
  const impostor = await browser.newPage();
  await impostor.goto("/demo/professor");
  await expect(impostor.getByRole("alert")).toContainText(
    "Chave do professor inválida",
  );
  await expect(
    impostor.getByRole("button", { name: "Iniciar atividade" }),
  ).toBeDisabled();
  const projection = await browser.newPage();
  await projection.goto("/demo/projetor");
  await expect(projection.getByRole("alert")).toContainText(
    "Chave da projeção inválida",
  );
  await expect(projection.locator(".confirmed-card")).toHaveCount(0);
  await projection.close();
  await impostor.close();
});

test("celular em navegador independente confirma pela alternativa ao arraste", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Executar no projeto mobile.");
  const teacher = await browser.newPage();
  await teacher.goto(
    `/demo/professor?key=${process.env.DEMO_TEACHER_KEY ?? "teste-professor"}`,
  );
  const share = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  await expect(share).toBeVisible();
  const oldStudentUrl = await share.getAttribute("href");
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await expect(share).not.toHaveAttribute("href", oldStudentUrl ?? "");
  const studentUrl = await share.getAttribute("href");
  if (!studentUrl) throw new Error("Link do aluno ausente");
  await page.goto(studentUrl);
  await expect(page.locator(".drag-card")).toBeVisible();
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await expect(page.locator(".drag-card")).toBeEnabled();
  await page
    .getByRole("slider", { name: /Outra forma de posicionar/ })
    .fill("65");
  await page
    .getByRole("button", { name: "Confirmar posição escolhida" })
    .click();
  await expect(page.getByText("Seu voto foi registrado.")).toBeVisible();
  await expect(teacher.locator(".confirmed-card")).toHaveCount(1);
  await teacher.close();
});
