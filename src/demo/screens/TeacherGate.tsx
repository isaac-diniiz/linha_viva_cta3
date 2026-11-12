import { useEffect, useState } from "react";
import { Header } from "../shared";
import { Teacher } from "./Teacher";
import { TeacherLogin } from "./TeacherLogin";

type Access =
  | { status: "checking" }
  /** inviteRequired false: o servidor aceita cadastro sem código de convite. */
  | { status: "login"; inviteRequired: boolean }
  /** email null: modo local, sem login. */
  | { status: "in"; email: string | null };

/** Pergunta ao servidor quem é o professor e, sem sessão, se o cadastro exige convite. */
async function askServer(): Promise<Access> {
  try {
    const response = await fetch("/demo/api/eu");
    const data = await response.json().catch(() => null);
    if (response.ok && data) return { status: "in", email: data.email ?? null };
    // na dúvida (servidor antigo, resposta estranha), pede o código
    return {
      status: "login",
      inviteRequired: data?.conviteObrigatorio !== false,
    };
  } catch {
    return { status: "login", inviteRequired: true };
  }
}

/**
 * Decide entre a entrada do professor e o painel. O painel só conecta à turma
 * depois que o servidor reconhece a sessão; no modo local não há login.
 */
export function TeacherGate() {
  const [access, setAccess] = useState<Access>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    void askServer().then((next) => alive && setAccess(next));
    return () => {
      alive = false;
    };
  }, []);

  if (access.status === "in")
    return (
      <Teacher
        account={access.email}
        onSignOut={async () => {
          await fetch("/demo/api/sair", { method: "POST" }).catch(() => {});
          // pergunta de novo: sem sessão, a resposta diz se o convite é exigido
          const next = await askServer();
          setAccess(
            next.status === "login"
              ? next
              : { status: "login", inviteRequired: true },
          );
        }}
      />
    );
  return (
    <main className="app-shell demo-shell">
      <Header role="PROFESSOR" />
      {access.status === "checking" ? (
        <div className="loading">Verificando acesso…</div>
      ) : (
        <TeacherLogin
          inviteRequired={access.inviteRequired}
          onSignedIn={(email) => setAccess({ status: "in", email })}
        />
      )}
    </main>
  );
}
