import { expect, test } from "@playwright/test";

test("página inicial orienta entrada por código", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Uma ideia de cada vez/ }),
  ).toBeVisible();
  await page.getByLabel("Você recebeu um código da turma?").fill("abcd1234");
  await page.getByRole("button", { name: /Entrar na atividade/ }).click();
  await expect(page).toHaveURL(/\/entrar\/ABCD1234$/);
});

test("professor, alunos e projeção acompanham o gesto antes da confirmação", async ({
  browser,
  page,
  request,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "O fluxo colaborativo roda uma vez com contextos independentes",
  );
  test.skip(
    !process.env.E2E_LOCAL_SUPABASE,
    "Requer Supabase local iniciado e .env.local configurado",
  );
  const email = `teacher-${Date.now()}@example.com`;
  await page.goto("/professor");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: /Enviar código/ }).click();

  let token = "";
  await expect
    .poll(async () => {
      const list = (await (
        await request.get("http://127.0.0.1:54324/api/v1/messages")
      ).json()) as { messages: { ID: string; To: { Address: string }[] }[] };
      const message = list.messages?.find((entry) =>
        entry.To?.some((to) => to.Address === email),
      );
      if (!message) return "";
      const detail = (await (
        await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)
      ).json()) as { Text?: string; HTML?: string };
      token = (detail.Text ?? detail.HTML ?? "").match(/\b\d{6}\b/)?.[0] ?? "";
      return token;
    })
    .not.toBe("");

  await page.getByLabel("Código recebido").fill(token);
  await page.getByRole("button", { name: /^Entrar/ }).click();
  await expect(page.getByText("Prepare a linha da turma.")).toBeVisible();
  await page
    .getByRole("button", { name: /Criar atividade e abrir sessão/ })
    .click();
  const code = (await page.locator(".session-code").textContent())!.trim();
  const projectionLink = page.getByRole("link", { name: /Abrir projeção/ });
  await expect(projectionLink).toHaveAttribute("href", /key=/);
  const projection = await page.context().newPage();
  await projection.goto((await projectionLink.getAttribute("href"))!);
  await expect(
    projection.getByRole("heading", { name: "Ciclo da água" }),
  ).toBeVisible();

  const students = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext();
    const student = await context.newPage();
    await student.goto(`/entrar/${code}`);
    await expect(
      student.getByRole("button", { name: /Arrastar/ }),
    ).toBeVisible();
    await expect(
      student.getByRole("button", { name: /Arrastar/ }),
    ).toBeDisabled();
    students.push({ context, page: student });
  }

  await page.getByRole("button", { name: "Iniciar movimentos" }).click();
  await expect(
    projection.getByText("As caixas se movem junto com a turma."),
  ).toBeVisible();
  await Promise.all(
    students.map(({ page: studentPage }) =>
      expect(
        studentPage.getByRole("button", { name: /Arrastar/ }),
      ).toBeEnabled(),
    ),
  );

  const student = students[0].page;
  const card = (await student
    .getByRole("button", { name: /Arrastar/ })
    .boundingBox())!;
  const board = (await student.getByLabel("Eixo compartilhado").boundingBox())!;
  await student.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await student.mouse.down();
  await student.mouse.move(
    board.x + board.width * 0.3,
    board.y + board.height * 0.25,
    { steps: 12 },
  );
  await student.waitForTimeout(200);
  await student.mouse.move(
    board.x + board.width * 0.7,
    board.y + board.height * 0.25,
  );
  await expect(projection.locator('[data-testid^="preview-"]')).toBeVisible();
  await expect(projection.locator('[data-testid^="preview-"]')).toHaveAttribute(
    "style",
    /left: 70%/,
  );
  await expect(projection.locator('[data-testid^="confirmed-"]')).toHaveCount(
    0,
  );
  await student.mouse.up();
  await expect(projection.locator('[data-testid^="confirmed-"]')).toHaveCount(
    1,
  );

  const movingStudents = students.slice(1);
  await Promise.all(
    movingStudents.map(({ page: studentPage }) =>
      expect(studentPage.locator('[data-testid^="confirmed-"]')).toHaveCount(1),
    ),
  );
  await Promise.all(
    movingStudents.map(async ({ page: studentPage }, index) => {
      const ownCard = (await studentPage
        .getByRole("button", { name: /Arrastar/ })
        .boundingBox())!;
      await studentPage.mouse.move(
        ownCard.x + ownCard.width / 2,
        ownCard.y + ownCard.height / 2,
      );
      await studentPage.mouse.down();
      const ownBoard = (await studentPage
        .getByLabel("Eixo compartilhado")
        .boundingBox())!;
      await studentPage.mouse.move(
        ownBoard.x + ownBoard.width * (index ? 0.8 : 0.2),
        ownBoard.y + ownBoard.height * 0.3,
      );
    }),
  );
  await expect(projection.locator('[data-testid^="preview-"]')).toHaveCount(2);
  await Promise.all(
    movingStudents.map(({ page: studentPage }) => studentPage.mouse.up()),
  );
  await expect(projection.locator('[data-testid^="confirmed-"]')).toHaveCount(
    2,
  );
  await expect
    .poll(
      async () =>
        (
          await Promise.all(
            movingStudents.map(({ page: studentPage }) =>
              studentPage.getByText(/posição mudou/).isVisible(),
            ),
          )
        ).filter(Boolean).length,
    )
    .toBe(1);
  const retryIndex = (
    await Promise.all(
      movingStudents.map(({ page: studentPage }) =>
        studentPage.getByText(/posição mudou/).isVisible(),
      ),
    )
  ).findIndex(Boolean);
  await movingStudents[retryIndex].page
    .getByRole("button", { name: "Confirmar posição escolhida" })
    .click();
  await expect(projection.locator('[data-testid^="confirmed-"]')).toHaveCount(
    3,
  );

  for (const entry of students) await entry.context.close();
});
