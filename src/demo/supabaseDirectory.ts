import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AccountExistsError, type TeacherDirectory } from "./auth";

export type AuthClient = Pick<SupabaseClient, "auth">;

/** Recusas de senha que não são falha do serviço. */
const WRONG_LOGIN = new Set(["invalid_credentials", "email_not_confirmed"]);

/**
 * Contas de professor no Supabase Auth. Usa a chave secreta, só no servidor:
 * o cadastro público fica desligado no projeto e as contas nascem aqui, depois
 * de o servidor conferir o código de convite.
 */
export function supabaseDirectory(client: AuthClient): TeacherDirectory {
  return {
    async create(email, password) {
      const { error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (!error) return;
      if (error.code === "email_exists") throw new AccountExistsError();
      throw new Error(
        `Supabase recusou o cadastro (${error.code ?? error.status}).`,
      );
    },
    async verify(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) return true;
      if (error.code && WRONG_LOGIN.has(error.code)) return false;
      throw new Error(`Supabase indisponível (${error.code ?? error.status}).`);
    },
  };
}

/** Cliente do Supabase para o servidor, sem guardar sessão em disco. */
export function serverSupabase(url: string, secretKey: string): AuthClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
