import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteActivity, replaceActivity, saveActivity } from "./catalog";
import { serverSupabase } from "./supabaseDirectory";

/** Tabela do Supabase onde ficam as linhas criadas pelo painel do professor. */
export const LINES_TABLE = "demo_lines";

export type LinesClient = Pick<SupabaseClient, "from">;

/** Linha guardada e o e-mail de quem a criou (nulo quando não se sabe). */
export type StoredLine = { activity: unknown; owner: string | null };

/** Onde ficam as linhas que o professor cria (Supabase em produção). */
export type LineStore = {
  source: "supabase" | "arquivos";
  /**
   * Linhas já salvas que o catálogo ainda não conhece. Os arquivos da pasta
   * `atividades/` o catálogo já lê junto das atividades prontas, então o
   * armazenamento em arquivos devolve lista vazia.
   */
  load(): Promise<StoredLine[]>;
  /**
   * Grava a linha nova. Devolve `false` quando ela só vale até o servidor
   * reiniciar (a pasta não aceitou a gravação); lança erro se o armazenamento
   * recusar, e nesse caso a linha não deve ser criada.
   */
  create(id: string, raw: unknown, owner: string | null): Promise<boolean>;
  /** Regrava a linha editada; mesmas regras de `create`. */
  replace(id: string, raw: unknown, owner: string | null): Promise<boolean>;
  /** Apaga a linha; apagar o que já não existe não é erro. */
  remove(id: string): Promise<void>;
};

type Failure = { code?: string; status?: number };

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const UNIQUE_VIOLATION = "23505";

/** Erro em português, sem expor o texto bruto do serviço. */
function refuse(action: string, error: Failure, id?: string): never {
  if (error.code && MISSING_TABLE.has(error.code))
    throw new Error(
      `A tabela ${LINES_TABLE} não existe no Supabase. Aplique a migração (supabase/migrations) e tente de novo.`,
    );
  if (error.code === UNIQUE_VIOLATION)
    throw new Error(
      `Outra linha já existe com o mesmo identificador (${id}). Tente de novo.`,
    );
  throw new Error(`${action} (${error.code ?? error.status}). Tente de novo.`);
}

/**
 * Linhas no Supabase. Usa a chave secreta, só no servidor: a tabela tem RLS
 * ligada e nenhuma política, então navegador algum lê ou grava nela.
 */
export function supabaseLineStore(client: LinesClient): LineStore {
  const insert = async (id: string, raw: unknown, owner: string | null) => {
    const { error } = await client
      .from(LINES_TABLE)
      .insert({ id, owner_email: owner, activity: raw });
    if (error) refuse("Não foi possível salvar a linha no Supabase", error, id);
    return true;
  };
  return {
    source: "supabase",
    async load() {
      const { data, error } = await client
        .from(LINES_TABLE)
        .select("id, activity, owner_email")
        .order("created_at", { ascending: true });
      if (error) refuse("Não foi possível ler as linhas do Supabase", error);
      return (data ?? []).map(
        (row: { activity: unknown; owner_email: string | null }) => ({
          activity: row.activity,
          owner: row.owner_email ?? null,
        }),
      );
    },
    create: insert,
    async replace(id, raw, owner) {
      const { data, error } = await client
        .from(LINES_TABLE)
        .update({ activity: raw, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error)
        refuse("Não foi possível salvar a linha no Supabase", error, id);
      // a linha pode ter nascido antes da tabela existir (ou em outro servidor)
      return data && data.length > 0 ? true : insert(id, raw, owner);
    },
    async remove(id) {
      const { error } = await client.from(LINES_TABLE).delete().eq("id", id);
      if (error)
        refuse("Não foi possível apagar a linha no Supabase", error, id);
    },
  };
}

/** Linhas em arquivos `atividades/criada-*.json`, como antes do Supabase. */
export function fileLineStore(dir: string): LineStore {
  return {
    source: "arquivos",
    async load() {
      return [];
    },
    async create(id, raw) {
      return saveActivity(dir, id, raw);
    },
    async replace(id, raw) {
      return replaceActivity(dir, id, raw) || saveActivity(dir, id, raw);
    },
    async remove(id) {
      deleteActivity(dir, id);
    },
  };
}

/**
 * Escolhe onde ficam as linhas criadas a partir das variáveis de ambiente, como
 * as contas de professor: Supabase quando `SUPABASE_URL` e `SUPABASE_SECRET_KEY`
 * estão definidas; senão, arquivos da pasta de atividades.
 */
export function customLineStore(
  env: Record<string, string | undefined>,
  dir: string,
): { store: LineStore; warnings: string[] } {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = env;
  if (url && key)
    return {
      store: supabaseLineStore(serverSupabase(url, key)),
      warnings: [],
    };
  const warning =
    url || key
      ? `Para guardar as linhas criadas no Supabase, defina também ${url ? "SUPABASE_SECRET_KEY" : "SUPABASE_URL"}; por enquanto elas ficam em arquivos.`
      : "Sem SUPABASE_URL e SUPABASE_SECRET_KEY, as linhas criadas ficam só em arquivos da pasta atividades (o disco é temporário em hospedagem gratuita: elas somem ao reiniciar o servidor).";
  return { store: fileLineStore(dir), warnings: [warning] };
}
