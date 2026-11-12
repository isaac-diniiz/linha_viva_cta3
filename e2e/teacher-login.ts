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
}
