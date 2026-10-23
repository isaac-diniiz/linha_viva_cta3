/**
 * Links que o servidor imprime ao iniciar. O endereço vem de DEMO_PUBLIC_URL, do
 * RENDER_EXTERNAL_URL que o Render define no contêiner, ou do computador local.
 */
export function demoLinks({
  env,
  port,
  teacherKey,
  code,
}: {
  env: Record<string, string | undefined>;
  port: number;
  teacherKey: string;
  code: string;
}): { teacher: string; students: string } {
  const base = (
    env.DEMO_PUBLIC_URL ??
    env.RENDER_EXTERNAL_URL ??
    `http://localhost:${port}`
  ).replace(/\/+$/, "");
  return {
    teacher: `${base}/demo/professor?key=${encodeURIComponent(teacherKey)}`,
    students: `${base}/demo/aluno/${encodeURIComponent(code)}`,
  };
}
