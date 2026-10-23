import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { demoLinks } from "./links";
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
const server = createServer(async (request, response) => {
  try {
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

const { teacherKey, code } = attachDemoServer(server, {
  publicMode: true,
  teacherKey: process.env.DEMO_TEACHER_KEY,
});
const port = Number(process.env.PORT ?? 4173);
server.listen(port, "0.0.0.0", () => {
  const links = demoLinks({ env: process.env, port, teacherKey, code });
  console.log(`Professor: ${links.teacher}`);
  console.log(`Alunos: ${links.students}`);
  if (process.env.RENDER_EXTERNAL_URL && !process.env.DEMO_TEACHER_KEY)
    console.warn(
      "DEMO_TEACHER_KEY não definida: o link do professor muda a cada reinício.",
    );
});
