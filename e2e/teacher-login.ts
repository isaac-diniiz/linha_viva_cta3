import { expect, type Page } from "@playwright/test";

/** Conta de teste do servidor (PROFESSOR_TESTE="email:senha"), como na CI. */
export const testTeacher = (() => {
  const [email, ...password] = (
    process.env.PROFESSOR_TESTE ?? "professor@teste.br:senha-de-teste"
  ).split(":");
  return { email, password: password.join(":") };
})();

/**
 * Código de convite do servidor de teste (CONVITE_PROFESSOR). A CI não define
 * nenhum: o cadastro fica aberto e a tela não pede o código.
 */
export const testInvite = process.env.CONVITE_PROFESSOR || undefined;

/** Abre o painel do professor, entrando com a conta de teste. */
export async function openTeacher(page: Page) {
  await page.goto("/demo/professor");
  await page.getByLabel(/^E-mail/).fill(testTeacher.email);
  await page.getByLabel(/^Senha/).fill(testTeacher.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Conectado como/)).toBeVisible();
  await restoreDefaults(page);
}

/**
 * Recomeça a sessão com as escolhas padrão (Ciclo da água, 1 cartão por
 * participante, professor participando). O servidor tem uma única turma e
 * "Reiniciar" preserva essas escolhas, então um teste anterior pode tê-las mudado.
 */
export async function restoreDefaults(page: Page) {
  const reset = page.getByRole("button", { name: "Nova rodada" });
  await expect(reset).toBeEnabled();
  await newRound(page);
  await expect(
    page.getByRole("button", { name: "Iniciar atividade" }),
  ).toBeEnabled();
  const water = page.getByRole("radio", { name: /Ciclo da água/ });
  if (!(await water.isChecked())) {
    await water.click();
    await expect(water).toBeChecked();
  }
  const perParticipant = page.getByLabel("Cartões por participante");
  if ((await perParticipant.inputValue()) !== "1") {
    await perParticipant.selectOption("1");
    await expect(perParticipant).toHaveValue("1");
  }
  const plays = page.getByRole("checkbox", { name: "Participar com cartões" });
  if (!(await plays.isChecked())) {
    await plays.click();
    await expect(plays).toBeChecked();
  }
}

/** Ponto da tela no centro de uma casa da trilha (a primeira é 0). */
export async function slotPoint(page: Page, slot: number) {
  const track = page.getByTestId("board-track");
  const box = await track.boundingBox();
  const data = await track.evaluate((element: HTMLElement) => ({
    columns: Number(element.dataset.columns),
    top: Number(element.dataset.top),
    rowHeight: Number(element.dataset.rowHeight),
  }));
  if (!box) throw new Error("Trilha ausente");
  const row = Math.floor(slot / data.columns);
  const offset = slot % data.columns;
  const col = row % 2 === 0 ? offset : data.columns - 1 - offset;
  return {
    x: box.x + ((col + 0.5) * box.width) / data.columns,
    y: box.y + data.top + (row + 0.5) * data.rowHeight,
  };
}

/**
 * Começa uma nova rodada e confirma. Com `newCode`, encerra antes, para a turma
 * receber outro código (a nova rodada de uma atividade aberta mantém o código).
 */
export async function newRound(page: Page, { newCode = false } = {}) {
  if (newCode) {
    const end = page.getByRole("button", { name: "Encerrar" });
    if (await end.isEnabled()) {
      await end.click();
      await page.getByRole("button", { name: "Sim, encerrar" }).click();
      await expect(end).toBeDisabled();
    }
  }
  await page.getByRole("button", { name: "Nova rodada" }).click();
  await page.getByRole("button", { name: "Sim, nova rodada" }).click();
}
