import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { teacherAccounts } from "./accounts";
import { createAuthHandler } from "./auth";
import { demoLinks } from "./links";
import { customLineStore } from "./lineStore";
import { attachDemoServer } from "./server";

const root = resolve(process.cwd(), "dist");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
const accounts = teacherAccounts(process.env);
const handleAuth = createAuthHandler({
  directory: accounts.directory,
  secret: accounts.secret,
  invite: accounts.invite,
});
const server = createServer(async (request, response) => {
  try {
    if (await handleAuth(request, response)) return;
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const target = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (target !== root && !target.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const file = (await stat(target).catch(() => null))?.isFile()
      ? target
      : join(root, "index.html");
    const extension = file.slice(file.lastIndexOf("."));
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": mime[extension] ?? "application/octet-stream",
      "cache-control": file.endsWith("index.html")
        ? "no-store"
        : "public, max-age=3600",
    });
    response.end(body);
  } catch {
    response.writeHead(500).end("Erro ao carregar a demonstração.");
  }
});

const activitiesDir =
  process.env.LINHA_VIVA_ATIVIDADES ?? resolve(process.cwd(), "atividades");
// onde ficam as linhas criadas pelo professor: Supabase (como as contas) ou arquivos
const lines = customLineStore(process.env, activitiesDir);
const { code } = attachDemoServer(server, {
  publicMode: true,
  sessionSecret: accounts.secret,
  activitiesDir,
  lines: lines.store,
});
const port = Number(process.env.PORT ?? 4173);
server.listen(port, "0.0.0.0", () => {
  const links = demoLinks({ env: process.env, port, code });
  console.log(`Professor: ${links.teacher}`);
  console.log(`Alunos: ${links.students}`);
  console.log(`Contas de professor: ${accounts.source}`);
  console.log(`Linhas criadas: ${lines.store.source}`);
  for (const warning of [...accounts.warnings, ...lines.warnings])
    console.warn(warning);
});
