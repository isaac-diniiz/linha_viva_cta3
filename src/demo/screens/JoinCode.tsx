import { useState } from "react";
import { Header } from "../shared";

/** Código como o servidor compara: sem espaços e em maiúsculas. */
function normalize(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

function goToSession(code: string) {
  window.location.assign(`/demo/aluno/${encodeURIComponent(code)}`);
}

export function JoinCode({
  error,
  onJoin = goToSession,
}: {
  error?: string;
  onJoin?: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const normalized = normalize(code);
  return (
    <main className="app-shell student-shell demo-shell">
      <Header role="ALUNO" />
      {error && (
        <div className="notice error" role="alert">
          {error} Confira o código mostrado na projeção e tente de novo.
        </div>
      )}
      <section className="panel narrow-panel">
        <form
          className="join-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (normalized) onJoin(normalized);
          }}
        >
          <label htmlFor="demo-session-code">Digite o código da turma</label>
          <div className="join-row">
            <input
              id="demo-session-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={12}
              placeholder="Código na projeção"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              className="button primary"
              disabled={!normalized}
            >
              Entrar na atividade <span>→</span>
            </button>
          </div>
        </form>
        <p className="small-help">
          Você também pode apontar a câmera do celular para o QR Code da
          projeção.
        </p>
      </section>
    </main>
  );
}
