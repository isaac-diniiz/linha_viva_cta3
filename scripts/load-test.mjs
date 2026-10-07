import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const localEnv = await readFile(
  new URL("../.env.local", import.meta.url),
  "utf8",
).catch(() => "");
const fromFile = Object.fromEntries(
  localEnv
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const split = line.indexOf("=");
      return [
        line.slice(0, split),
        line.slice(split + 1).replace(/^"|"$/g, ""),
      ];
    }),
);
const url = process.env.SUPABASE_URL ?? fromFile.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  fromFile.VITE_SUPABASE_PUBLISHABLE_KEY ??
  fromFile.VITE_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error(
    "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY ou .env.local",
  );

const teacher = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const projection = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email =
  process.env.LOAD_TEACHER_EMAIL ?? `load-${Date.now()}@example.com`;
const failures = [];
const delays = [];
const projectionChannels = [];
const students = [];
let sessionId;

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function otp() {
  unwrap(await teacher.auth.signInWithOtp({ email }));
  if (process.env.LOAD_TEACHER_OTP) return process.env.LOAD_TEACHER_OTP;
  const mailpit = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(`${mailpit}/api/v1/messages`).then((response) =>
      response.json(),
    );
    const message = list.messages?.find((entry) =>
      entry.To?.some((to) => to.Address === email),
    );
    if (message) {
      const detail = await fetch(
        `${mailpit}/api/v1/message/${message.ID}`,
      ).then((response) => response.json());
      const code = (detail.Text ?? detail.HTML ?? "").match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Código de e-mail não encontrado no Mailpit");
}

function subscribe(channel) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timeout no canal ${channel.topic}`)),
      20000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        failures.push(`${channel.topic}: ${status}`);
        clearTimeout(timeout);
        reject(new Error(`${channel.topic}: ${status}`));
      }
    });
  });
}

try {
  unwrap(
    await teacher.auth.verifyOtp({ email, token: await otp(), type: "email" }),
  );
  const labels = Array.from(
    { length: 40 },
    (_, index) => `Etapa ${String(index + 1).padStart(2, "0")}`,
  );
  const activityId = unwrap(
    await teacher.rpc("create_activity", {
      p_title: "Ensaio de carga",
      p_instruction: "Ordene os itens.",
      p_labels: labels,
    }),
  );
  sessionId = unwrap(
    await teacher.rpc("create_session", { p_activity_id: activityId }),
  );
  const session = unwrap(
    await teacher.from("sessions").select("code").eq("id", sessionId).single(),
  );
  const items = unwrap(
    await teacher
      .from("activity_items")
      .select("id")
      .eq("activity_id", activityId),
  );
  const projectionKey = unwrap(
    await teacher.rpc("get_projection_key", { p_session_id: sessionId }),
  );
  unwrap(await projection.auth.signInAnonymously());
  unwrap(
    await projection.rpc("join_projection", {
      p_session_id: sessionId,
      p_secret: projectionKey,
    }),
  );

  for (const item of items) {
    const channel = projection
      .channel(`drag:${sessionId}:${item.id}`, { config: { private: true } })
      .on("broadcast", { event: "move" }, ({ payload }) =>
        delays.push(Date.now() - Number(payload.sentAt)),
      );
    projectionChannels.push(channel);
    await subscribe(channel);
  }

  unwrap(
    await teacher.rpc("set_session_status", {
      p_session_id: sessionId,
      p_status: "active",
    }),
  );

  for (let index = 0; index < 40; index++) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    unwrap(await client.auth.signInAnonymously());
    const membership = unwrap(
      await client.rpc("join_session", { p_code: session.code }),
    )[0];
    const channel = client.channel(
      `drag:${membership.session_id}:${membership.item_id}`,
      { config: { private: true } },
    );
    await subscribe(channel);
    students.push({ client, channel, itemId: membership.item_id });
  }

  const active = students.slice(0, 5);
  const dragIds = active.map((_, index) => `load-${index}-${Date.now()}`);
  let sent = 0;
  for (let tick = 0; tick < 60; tick++) {
    await Promise.all(
      active.map(async ({ channel }, index) => {
        const result = await channel.send({
          type: "broadcast",
          event: "move",
          payload: {
            dragId: dragIds[index],
            seq: tick + 1,
            x: tick / 59,
            y: (index + 1) / 6,
            version: 1,
            sentAt: Date.now(),
            startedAt: Date.now(),
          },
        });
        if (result !== "ok") failures.push(`Envio ${index}/${tick}: ${result}`);
        sent++;
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 167));
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  delays.sort((a, b) => a - b);
  const p95 = delays[Math.ceil(delays.length * 0.95) - 1];
  console.log(
    JSON.stringify(
      {
        connectedStudents: students.length,
        simultaneousDrags: 5,
        sent,
        received: delays.length,
        p95Ms: p95,
        errors: failures,
      },
      null,
      2,
    ),
  );
  if (
    students.length !== 40 ||
    delays.length < sent * 0.95 ||
    p95 > 300 ||
    failures.length
  )
    process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const { client, channel } of students)
    await client.removeChannel(channel);
  for (const channel of projectionChannels)
    await projection.removeChannel(channel);
  if (sessionId)
    await teacher.rpc("delete_session", { p_session_id: sessionId });
}
