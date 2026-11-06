/**
 * Links que o servidor imprime ao iniciar. O endereço vem de DEMO_PUBLIC_URL, do
 * RENDER_EXTERNAL_URL que o Render define no contêiner, ou do computador local.
 * O professor entra pelo login, sem chave no link.
 */
export function demoLinks({
  env,
  port,
  code,
}: {
  env: Record<string, string | undefined>;
  port: number;
  code: string;
}): { teacher: string; students: string } {
  const base = (
    env.DEMO_PUBLIC_URL ??
    env.RENDER_EXTERNAL_URL ??
    `http://localhost:${port}`
  ).replace(/\/+$/, "");
  return {
    teacher: `${base}/demo/professor`,
    students: `${base}/demo/aluno/${encodeURIComponent(code)}`,
  };
}
