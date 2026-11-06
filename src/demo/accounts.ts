import { randomBytes } from "node:crypto";
import { AccountExistsError, type TeacherDirectory } from "./auth";
import { serverSupabase, supabaseDirectory } from "./supabaseDirectory";

export type AccountsConfig = {
  source: "supabase" | "teste" | "nenhuma";
  directory: TeacherDirectory;
  invite: string | undefined;
  secret: string;
  warnings: string[];
};

const MIN_SECRET = 32;

/** Contas só na memória do processo, para CI e testes locais. */
function memoryDirectory(seed: [string, string][]): TeacherDirectory {
  const accounts = new Map(seed);
  return {
    async create(email, password) {
      if (accounts.has(email)) throw new AccountExistsError();
      accounts.set(email, password);
    },
    async verify(email, password) {
      return accounts.get(email) === password;
    },
  };
}

const closedDirectory: TeacherDirectory = {
  async create() {
    throw new Error("Nenhum armazenamento de contas configurado.");
  },
  async verify() {
    return false;
  },
};

/**
 * Escolhe onde ficam as contas de professor a partir das variáveis de ambiente:
 * Supabase em produção; PROFESSOR_TESTE ("email:senha") para CI e uso local;
 * sem nenhuma das duas, ninguém entra como professor.
 */
export function teacherAccounts(
  env: Record<string, string | undefined>,
): AccountsConfig {
  const warnings: string[] = [];
  let source: AccountsConfig["source"];
  let directory: TeacherDirectory;
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    source = "supabase";
    directory = supabaseDirectory(
      serverSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    );
  } else if (env.PROFESSOR_TESTE?.includes(":")) {
    source = "teste";
    const [email, ...password] = env.PROFESSOR_TESTE.split(":");
    directory = memoryDirectory([
      [email.trim().toLowerCase(), password.join(":")],
    ]);
  } else {
    source = "nenhuma";
    directory = closedDirectory;
    warnings.push(
      "Sem contas de professor: defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou PROFESSOR_TESTE para testes).",
    );
  }
  let secret = env.SESSAO_SEGREDO ?? "";
  if (secret.length < MIN_SECRET) {
    secret = randomBytes(32).toString("hex");
    warnings.push(
      `SESSAO_SEGREDO ausente ou com menos de ${MIN_SECRET} caracteres: os logins valem só até o servidor reiniciar.`,
    );
  }
  const invite = env.CONVITE_PROFESSOR || undefined;
  if (!invite)
    warnings.push(
      "CONVITE_PROFESSOR não definido: o cadastro de novos professores fica fechado.",
    );
  return { source, directory, invite, secret, warnings };
}
