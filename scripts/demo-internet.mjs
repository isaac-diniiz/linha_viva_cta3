import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// sem contas configuradas, cria uma conta temporária só para esta demonstração
const temporaryAccount =
  !process.env.SUPABASE_URL && !process.env.PROFESSOR_TESTE
    ? {
        email: "professor@demo.local",
        password: randomBytes(9).toString("base64url"),
      }
    : null;
const server = spawn(process.execPath, ["dist-server/standalone.js"], {
  stdio: ["ignore", "pipe", "inherit"],
  env: {
    ...process.env,
    PORT: "4173",
    ...(temporaryAccount && {
      PROFESSOR_TESTE: `${temporaryAccount.email}:${temporaryAccount.password}`,
    }),
  },
});
let teacherPath = "";
let studentPath = "";
let publicBase = "";
let tunnel;
let finished = false;
let serverOutput = "";
let tunnelOutput = "";

function stop(code = 0) {
  if (finished) return;
  finished = true;
  tunnel?.kill();
  server.kill();
  process.exitCode = code;
}

function showLinks() {
  if (!teacherPath || !studentPath || !publicBase) return;
  console.log(`\nProfessor: ${publicBase}${teacherPath}`);
  if (temporaryAccount)
    console.log(
      `  Entre com ${temporaryAccount.email} e a senha ${temporaryAccount.password} (não compartilhe; vale até Ctrl+C).`,
    );
  console.log(`Alunos (compartilhe): ${publicBase}${studentPath}`);
  console.log(
    "Abra a projeção pelo painel do professor. Ctrl+C encerra a demo.\n",
  );
}

server.stdout.on("data", (chunk) => {
  serverOutput += String(chunk);
  const teacher = serverOutput.match(
    /Professor: http:\/\/localhost:4173(\/demo\/professor)/,
  );
  const student = serverOutput.match(
    /Alunos: http:\/\/localhost:4173(\/demo\/aluno\/[A-Z0-9]+)/,
  );
  if (teacher) teacherPath = teacher[1];
  if (student) studentPath = student[1];
  showLinks();
  if (teacherPath && studentPath && !tunnel) {
    const localBinary = resolve(".tools/cloudflared.exe");
    const binary =
      process.env.CLOUDFLARED_PATH ||
      (existsSync(localBinary) ? localBinary : "cloudflared");
    tunnel = spawn(binary, ["tunnel", "--url", "http://localhost:4173"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capture = (data) => {
      tunnelOutput += String(data);
      const match = tunnelOutput.match(
        /https:\/\/(?!api\.)([a-z0-9-]+)\.trycloudflare\.com/,
      );
      if (match && !publicBase) {
        publicBase = match[0];
        showLinks();
      }
    };
    tunnel.stdout.on("data", capture);
    tunnel.stderr.on("data", capture);
    tunnel.on("error", (error) => {
      console.error(`Não foi possível iniciar cloudflared: ${error.message}`);
      stop(1);
    });
    tunnel.on("exit", (code) => {
      if (!finished) {
        console.error(`Túnel encerrado (${code}). ${tunnelOutput.slice(-600)}`);
        stop(1);
      }
    });
    setTimeout(() => {
      if (!publicBase && !finished) {
        console.error("O túnel não forneceu uma URL pública em 60 segundos.");
        stop(1);
      }
    }, 60_000).unref();
  }
});
server.on("error", (error) => {
  console.error(`Não foi possível iniciar a demo: ${error.message}`);
  stop(1);
});
server.on("exit", (code) => {
  if (!finished) {
    console.error(`Servidor encerrado (${code}).`);
    stop(1);
  }
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
