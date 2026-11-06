import { useEffect, useState } from "react";
import { Header } from "../shared";
import { Teacher } from "./Teacher";
import { TeacherLogin } from "./TeacherLogin";

type Access =
  | { status: "checking" }
  | { status: "login" }
  /** email null: modo local, sem login. */
  | { status: "in"; email: string | null };

/**
 * Decide entre a entrada do professor e o painel. O painel só conecta à turma
 * depois que o servidor reconhece a sessão; no modo local não há login.
 */
export function TeacherGate() {
  const [access, setAccess] = useState<Access>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    void fetch("/demo/api/eu")
      .then(async (response) => {
        const data = response.ok ? await response.json() : null;
        if (!alive) return;
        setAccess(
          data
            ? { status: "in", email: data.email ?? null }
            : { status: "login" },
        );
      })
      .catch(() => alive && setAccess({ status: "login" }));
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
          setAccess({ status: "login" });
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
          onSignedIn={(email) => setAccess({ status: "in", email })}
        />
      )}
    </main>
  );
}
