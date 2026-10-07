import { WebSocket } from "ws";

const url = process.env.DEMO_URL;
if (!url) throw new Error("Defina DEMO_URL com o link do aluno.");
const page = await fetch(url);
if (!page.ok) throw new Error(`Página HTTP ${page.status}`);
const parsed = new URL(url);
const code = parsed.pathname.split("/").at(-1);
const socket = new WebSocket(
  `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}/demo-ws`,
);
const timeout = setTimeout(() => socket.terminate(), 10_000);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
socket.send(
  JSON.stringify({
    type: "join",
    role: "student",
    code,
    token: `verificacao-${crypto.randomUUID()}`,
  }),
);
const state = await new Promise((resolve, reject) => {
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.type === "snapshot") resolve(message.state);
    if (message.type === "error") reject(new Error(message.message));
  });
  socket.once("error", reject);
  socket.once("close", () =>
    reject(new Error("WebSocket encerrado antes do estado.")),
  );
});
clearTimeout(timeout);
socket.close();
if (
  !state.ownItemId ||
  !state.items.some((item) => item.id === state.ownItemId)
)
  throw new Error("Aluno sem cartão atribuído.");
console.log(
  `HTTP ${page.status}; WebSocket conectado; cartão atribuído; versão ${state.version}.`,
);
