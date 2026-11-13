// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  customLineStore,
  fileLineStore,
  LINES_TABLE,
  supabaseLineStore,
  type LinesClient,
} from "./lineStore";

type Row = { id: string; owner_email: string | null; activity: unknown };
type Failure = { code?: string; status?: number } | null;

/**
 * Banco de mentira com o formato das chamadas do supabase-js usadas pelo
 * servidor: select/order, insert, update/eq/select e delete/eq.
 */
function fakeClient(initial: Row[] = [], failure: Failure = null) {
  const rows = [...initial];
  const tables: string[] = [];
  const answer = <T>(data: T) =>
    failure ? { data: null, error: failure } : { data, error: null };
  const client = {
    from(table: string) {
      tables.push(table);
      return {
        select: () => ({
          order: async () => answer(rows.map((row) => ({ ...row }))),
        }),
        insert: async (row: Row) => {
          if (failure) return { data: null, error: failure };
          if (rows.some((existing) => existing.id === row.id))
            return { data: null, error: { code: "23505" } };
          rows.push({ ...row });
          return { data: null, error: null };
        },
        update: (patch: Partial<Row>) => ({
          eq: (_column: string, value: string) => ({
            select: async () => {
              if (failure) return { data: null, error: failure };
              const hit = rows.filter((row) => row.id === value);
              for (const row of hit) Object.assign(row, patch);
              return { data: hit.map(({ id }) => ({ id })), error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (_column: string, value: string) => {
            if (failure) return { data: null, error: failure };
            const keep = rows.filter((row) => row.id !== value);
            rows.splice(0, rows.length, ...keep);
            return { data: null, error: null };
          },
        }),
      };
    },
  } as unknown as LinesClient;
  return { client, rows, tables };
}

const activity = (title: string) => ({
  id: "criada-fases",
  titulo: title,
  cartoes: [],
});

describe("linhas criadas guardadas no Supabase", () => {
  it("lê as atividades salvas com o e-mail de quem criou, da mais antiga para a mais nova", async () => {
    const { client, tables } = fakeClient([
      { id: "criada-a", owner_email: "ana@escola.br", activity: activity("A") },
      { id: "criada-b", owner_email: null, activity: activity("B") },
    ]);
    const lines = await supabaseLineStore(client).load();
    expect(lines).toEqual([
      { activity: activity("A"), owner: "ana@escola.br" },
      { activity: activity("B"), owner: null },
    ]);
    expect(tables).toEqual([LINES_TABLE]);
  });

  it("grava a linha nova com o e-mail de quem a criou", async () => {
    const { client, rows } = fakeClient();
    const store = supabaseLineStore(client);
    expect(
      await store.create("criada-fases", activity("Fases"), "ana@escola.br"),
    ).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "criada-fases",
      owner_email: "ana@escola.br",
      activity: activity("Fases"),
    });
  });

  it("aceita linha criada sem professor identificado (uso local)", async () => {
    const { client, rows } = fakeClient();
    await supabaseLineStore(client).create(
      "criada-fases",
      activity("Fases"),
      null,
    );
    expect(rows[0].owner_email).toBe(null);
  });

  it("não sobrescreve outra linha com o mesmo identificador", async () => {
    const { client, rows } = fakeClient([
      {
        id: "criada-fases",
        owner_email: "ana@escola.br",
        activity: activity("Original"),
      },
    ]);
    await expect(
      supabaseLineStore(client).create(
        "criada-fases",
        activity("Outra"),
        "bia@escola.br",
      ),
    ).rejects.toThrow(/já existe/);
    expect(rows[0].activity).toEqual(activity("Original"));
  });

  it("regrava a atividade ao editar, sem trocar quem a criou", async () => {
    const { client, rows } = fakeClient([
      {
        id: "criada-fases",
        owner_email: "ana@escola.br",
        activity: activity("Antes"),
      },
    ]);
    const saved = await supabaseLineStore(client).replace(
      "criada-fases",
      activity("Depois"),
      "bia@escola.br",
    );
    expect(saved).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].activity).toEqual(activity("Depois"));
    expect(rows[0].owner_email).toBe("ana@escola.br");
  });

  it("ao editar uma linha que ainda não estava salva, cria o registro", async () => {
    const { client, rows } = fakeClient();
    await supabaseLineStore(client).replace(
      "criada-fases",
      activity("Nova"),
      "bia@escola.br",
    );
    expect(rows).toEqual([
      {
        id: "criada-fases",
        owner_email: "bia@escola.br",
        activity: activity("Nova"),
      },
    ]);
  });

  it("apaga a linha, e apagar o que já não existe não é erro", async () => {
    const { client, rows } = fakeClient([
      { id: "criada-fases", owner_email: null, activity: activity("A") },
    ]);
    const store = supabaseLineStore(client);
    await store.remove("criada-fases");
    expect(rows).toHaveLength(0);
    await store.remove("criada-fases");
  });

  it("explica a falha sem expor detalhes do serviço", async () => {
    const down = fakeClient([], { code: "XX000", status: 500 });
    const store = supabaseLineStore(down.client);
    await expect(store.create("criada-a", activity("A"), null)).rejects.toThrow(
      /Não foi possível salvar a linha.*XX000/,
    );
    await expect(
      store.replace("criada-a", activity("A"), null),
    ).rejects.toThrow(/Não foi possível salvar a linha/);
    await expect(store.remove("criada-a")).rejects.toThrow(
      /Não foi possível apagar a linha/,
    );
    await expect(store.load()).rejects.toThrow(
      /Não foi possível ler as linhas/,
    );
  });

  it("diz o que fazer quando a tabela ainda não foi criada", async () => {
    const missing = fakeClient([], { code: "PGRST205" });
    await expect(
      supabaseLineStore(missing.client).create("criada-a", activity("A"), null),
    ).rejects.toThrow(/demo_lines.*migra/i);
    const postgres = fakeClient([], { code: "42P01" });
    await expect(supabaseLineStore(postgres.client).load()).rejects.toThrow(
      /demo_lines.*migra/i,
    );
  });
});

describe("linhas criadas guardadas em arquivos", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });
  const folder = () => (dir = mkdtempSync(join(tmpdir(), "linha-viva-store-")));

  it("o catálogo já lê os arquivos junto das atividades prontas, então não há o que carregar", async () => {
    expect(await fileLineStore(folder()).load()).toEqual([]);
  });

  it("grava o arquivo da linha nova e não sobrescreve outro", async () => {
    const store = fileLineStore(folder());
    expect(await store.create("criada-fases", { a: 1 }, "ana@escola.br")).toBe(
      true,
    );
    expect(
      JSON.parse(readFileSync(join(dir, "criada-fases.json"), "utf8")),
    ).toEqual({ a: 1 });
    expect(await store.create("criada-fases", { a: 2 }, null)).toBe(false);
    expect(
      JSON.parse(readFileSync(join(dir, "criada-fases.json"), "utf8")),
    ).toEqual({ a: 1 });
  });

  it("regrava o arquivo ao editar, ou o cria se tinha sumido", async () => {
    const store = fileLineStore(folder());
    await store.create("criada-fases", { a: 1 }, null);
    expect(await store.replace("criada-fases", { a: 2 }, null)).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "criada-fases.json"), "utf8")),
    ).toEqual({ a: 2 });
    rmSync(join(dir, "criada-fases.json"));
    expect(await store.replace("criada-fases", { a: 3 }, null)).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "criada-fases.json"), "utf8")),
    ).toEqual({ a: 3 });
  });

  it("apaga o arquivo, sem erro se ele já não existe, e não toca em atividades prontas", async () => {
    const store = fileLineStore(folder());
    await store.create("criada-fases", { a: 1 }, null);
    writeFileSync(join(dir, "ciclo-da-agua.json"), "{}");
    await store.remove("criada-fases");
    await store.remove("criada-fases");
    await store.remove("ciclo-da-agua");
    expect(existsSync(join(dir, "criada-fases.json"))).toBe(false);
    expect(existsSync(join(dir, "ciclo-da-agua.json"))).toBe(true);
  });

  it("avisa com false, sem lançar erro, quando a pasta não aceita gravação", async () => {
    const store = fileLineStore(folder());
    writeFileSync(join(dir, "arquivo"), "x");
    const broken = fileLineStore(join(dir, "arquivo"));
    expect(await broken.create("criada-fases", { a: 1 }, null)).toBe(false);
    expect(await store.create("criada-ok", { a: 1 }, null)).toBe(true);
  });
});

describe("configuração do armazenamento das linhas", () => {
  it("usa o Supabase quando a URL e a chave secreta estão definidas", () => {
    const config = customLineStore(
      {
        SUPABASE_URL: "https://exemplo.supabase.co",
        SUPABASE_SECRET_KEY: "sb_secret_teste",
      },
      "atividades",
    );
    expect(config.store.source).toBe("supabase");
    expect(config.warnings).toEqual([]);
  });

  it("sem Supabase, usa arquivos e avisa que o disco pode ser temporário", () => {
    const config = customLineStore({}, "atividades");
    expect(config.store.source).toBe("arquivos");
    expect(config.warnings.join("\n")).toMatch(/SUPABASE_URL/);
    expect(config.warnings.join("\n")).toMatch(/reiniciar|temporário/i);
  });

  it("com só metade da configuração do Supabase, usa arquivos e diz o que falta", () => {
    const onlyUrl = customLineStore(
      { SUPABASE_URL: "https://x.supabase.co" },
      "atividades",
    );
    expect(onlyUrl.store.source).toBe("arquivos");
    expect(onlyUrl.warnings.join("\n")).toMatch(/SUPABASE_SECRET_KEY/);
    const onlyKey = customLineStore(
      { SUPABASE_SECRET_KEY: "sb_secret_x" },
      "atividades",
    );
    expect(onlyKey.store.source).toBe("arquivos");
    expect(onlyKey.warnings.join("\n")).toMatch(/SUPABASE_URL/);
  });
});
