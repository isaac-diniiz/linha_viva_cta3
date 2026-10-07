import { expect, test, type Page } from "@playwright/test";

test.skip(
  !process.env.DEMO_MODE && !process.env.DEMO_PUBLIC_URL,
  "Executar com DEMO_MODE=1 ou DEMO_PUBLIC_URL.",
);

async function startDrag(page: Page, x: number, y: number) {
  await page.locator(".drag-card").scrollIntoViewIfNeeded();
  const card = await page.locator(".drag-card").boundingBox();
  const board = await page.getByTestId("board-track").boundingBox();
  if (!card || !board) throw new Error("Cartão ou eixo ausente.");
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width * x, board.y + board.height * y);
  return board;
}

test("duas prévias remotas avançam em vários frames entre mensagens", async ({
  browser,
}) => {
  const teacher = await browser.newPage();
  const key = process.env.DEMO_TEACHER_KEY;
  await teacher.goto(`/demo/professor${key ? `?key=${key}` : ""}`);
  const share = teacher.getByRole("link", { name: /\/demo\/aluno\// });
  await expect(share).toBeVisible();
  const oldStudentUrl = await share.getAttribute("href");
  await teacher.getByRole("button", { name: "Reiniciar demonstração" }).click();
  if (process.env.DEMO_PUBLIC_URL)
    await expect(share).not.toHaveAttribute("href", oldStudentUrl ?? "");
  const studentUrl = (await share.getAttribute("href")) ?? "/demo/aluno";
  const projectionUrl =
    (await teacher
      .getByRole("link", { name: "Abrir projeção ↗" })
      .getAttribute("href")) ?? "/demo/projetor";
  const projection = await browser.newPage();
  await projection.goto(projectionUrl);
  const first = await browser.newPage();
  const second = await browser.newPage();
  await first.goto(studentUrl);
  await second.goto(studentUrl);
  await teacher.getByRole("button", { name: "Iniciar atividade" }).click();
  await expect(first.locator(".drag-card")).toBeEnabled();
  await expect(second.locator(".drag-card")).toBeEnabled();

  const firstBoard = await startDrag(first, 0.2, 0.3);
  const secondBoard = await startDrag(second, 0.8, 0.7);
  await expect(projection.locator(".animated-preview")).toHaveCount(2);
  await first.waitForTimeout(250);
  const sampling = projection.evaluate(async () => {
    const cards = [
      ...document.querySelectorAll<HTMLElement>(".animated-preview"),
    ];
    (window as Window & { motionProbeReady?: boolean }).motionProbeReady = true;
    return Promise.all(
      cards.map(async (card) => {
        const before = card.dataset.x;
        await new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            if (card.dataset.x !== before) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(card, {
            attributes: true,
            attributeFilter: ["data-x"],
          });
        });
        const frames: string[] = [];
        for (let index = 0; index < 12; index++) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          frames.push(getComputedStyle(card).transform);
        }
        return new Set(frames).size;
      }),
    );
  });
  await expect
    .poll(() =>
      projection.evaluate(
        () =>
          (window as Window & { motionProbeReady?: boolean }).motionProbeReady,
      ),
    )
    .toBe(true);
  await Promise.all([
    first.mouse.move(
      firstBoard.x + firstBoard.width * 0.65,
      firstBoard.y + firstBoard.height * 0.45,
    ),
    second.mouse.move(
      secondBoard.x + secondBoard.width * 0.35,
      secondBoard.y + secondBoard.height * 0.55,
    ),
  ]);
  const frameCounts = await sampling;
  expect(frameCounts).toHaveLength(2);
  for (const count of frameCounts) expect(count).toBeGreaterThanOrEqual(9);
  await first.mouse.up();
  await expect(projection.locator(".confirmed-card")).toHaveCount(1);
  await expect(projection.locator(".animated-preview")).toHaveCount(1);
  const remaining = projection.locator(".animated-preview");
  const before = await remaining.getAttribute("data-x");
  await second.mouse.move(
    secondBoard.x + secondBoard.width * 0.55,
    secondBoard.y + secondBoard.height * 0.6,
  );
  await expect(remaining).not.toHaveAttribute("data-x", before ?? "");
  await second.mouse.up();
  await first.close();
  await second.close();
  await projection.close();
  await teacher.close();
});
