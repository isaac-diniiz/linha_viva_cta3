import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgtap } from "@electric-sql/pglite-pgtap";

const db = new PGlite({ extensions: { pgtap } });
const bootstrap = `
  create role authenticated;
  create role anon;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
  $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid(), auth.jwt() to authenticated;
  create schema realtime;
  create table realtime.messages (topic text not null, extension text not null);
  alter table realtime.messages enable row level security;
  grant usage on schema realtime to authenticated;
  grant select, insert on realtime.messages to authenticated;
  create function realtime.topic() returns text language sql stable as $$
    select current_setting('realtime.topic', true)
  $$;
  grant execute on function realtime.topic() to authenticated;
  create schema extensions;
  grant usage on schema extensions to authenticated;
  create publication supabase_realtime;
`;

try {
  await db.exec(bootstrap);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).sort())
    if (file.endsWith(".sql"))
      await db.exec(await readFile(new URL(file, migrations), "utf8"));
  await db.exec("create extension pgtap with schema extensions");
  const assertions = (
    await readFile(
      new URL("../supabase/tests/database/session.test.sql", import.meta.url),
      "utf8",
    )
  ).replace(
    /^begin;\s*create extension if not exists pgtap with schema extensions;/i,
    "",
  );
  await db.exec("begin; set local search_path = public, extensions;");
  const results = await db.exec(assertions);
  const lines = results.flatMap((result) =>
    result.rows.flatMap((row) => Object.values(row)),
  );
  for (const line of lines)
    if (typeof line === "string" && /^(not ok|ok |1\.\.|#)/.test(line))
      console.log(line);
  if (
    lines.some(
      (line) =>
        typeof line === "string" && /not ok|Failed \d+ tests?/.test(line),
    )
  )
    process.exitCode = 1;
  else console.log("Migração e pgTAP concluídos no PostgreSQL em WASM.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
