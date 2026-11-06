import { useState, type FormEvent } from "react";

type Mode = "entrar" | "cadastro";

/** Envia os dados à API de conta e devolve o e-mail ou a mensagem de erro. */
async function submit(
  mode: Mode,
  body: Record<string, string>,
): Promise<{ email?: string; erro?: string }> {
  try {
    const response = await fetch(`/demo/api/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      email?: string;
      erro?: string;
    };
    if (response.ok && data.email) return { email: data.email };
    return { erro: data.erro ?? "Não foi possível entrar agora." };
  } catch {
    return {
      erro: "Sem conexão com o servidor. Confira a internet e tente de novo.",
    };
  }
}

export function TeacherLogin({
  onSignedIn,
}: {
  onSignedIn: (email: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "cadastro";

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await submit(mode, {
      email,
      senha: password,
      ...(signup ? { convite: invite } : {}),
    });
    setBusy(false);
    if (result.email) onSignedIn(result.email);
    else setError(result.erro ?? "");
  }

  return (
    <section className="panel narrow-panel teacher-login">
      <h1>{signup ? "Criar conta de professor" : "Entrar como professor"}</h1>
      <p>
        {signup
          ? "Use o código de convite que a equipe da Linha Viva passou para você."
          : "Entre para abrir a turma, escolher a atividade e conduzir a linha."}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={(event) => void send(event)}>
        <label>
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {signup ? "Senha (pelo menos 8 caracteres)" : "Senha"}
          <input
            type="password"
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {signup && (
          <label>
            Código de convite
            <input
              required
              autoComplete="off"
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
            />
          </label>
        )}
        <button className="button primary full" disabled={busy}>
          {signup ? "Criar conta e entrar" : "Entrar"}
        </button>
      </form>
      <button
        type="button"
        className="button subtle full"
        onClick={() => {
          setMode(signup ? "entrar" : "cadastro");
          setError("");
        }}
      >
        {signup ? "Já tenho conta" : "Criar conta"}
      </button>
    </section>
  );
}
