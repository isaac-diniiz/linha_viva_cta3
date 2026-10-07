import { useState } from "react";
import { configured } from "./lib/supabase";
import { TeacherPage } from "./pages/TeacherPage";
import { StudentPage } from "./pages/StudentPage";
import { ProjectorPage } from "./pages/ProjectorPage";
import { DemoApp } from "./demo/DemoApp";

function HomePage() {
  const [code, setCode] = useState("");
  return (
    <main className="home-shell">
      <header className="site-header">
        <a href="/" className="logo">
          <span className="logo-mark">L</span>
          <span>Linha Viva</span>
        </a>
        <a href="/professor" className="header-link">
          Área do professor <span>↗</span>
        </a>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> APRENDER É CONSTRUIR JUNTO
          </div>
          <h1>
            Uma ideia de cada vez.
            <br />
            <em>Uma linha feita por todos.</em>
          </h1>
          <p>
            Uma atividade coletiva em que cada aluno coloca sua parte na
            sequência. As ideias ganham lugar, se movem e se encontram ao vivo
            na tela da sala.
          </p>
          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim())
                window.location.href = `/entrar/${encodeURIComponent(code.trim().toUpperCase())}`;
            }}
          >
            <label htmlFor="session-code">
              Você recebeu um código da turma?
            </label>
            <div className="join-row">
              <input
                id="session-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={8}
                placeholder="Digite o código"
                autoComplete="off"
              />
              <button type="submit" className="button primary">
                Entrar na atividade <span>→</span>
              </button>
            </div>
          </form>
          {!configured && (
            <div className="config-note" role="status">
              Ambiente de demonstração ainda não conectado ao Supabase.
              Configure as variáveis do arquivo <code>.env.local</code> para
              ativar as sessões.
            </div>
          )}
        </div>
        <div className="home-logo-panel">
          <img src="/linha-viva-logo.png" alt="Logo da Linha Viva" />
        </div>
      </section>
      <footer className="home-footer">
        <span>SEM PONTOS. SEM PRESSA. COM CONVERSA.</span>
        <span>Feito para aprender em conjunto.</span>
      </footer>
    </main>
  );
}

export function App() {
  if (import.meta.env.MODE === "demo") return <DemoApp />;
  const path = decodeURIComponent(window.location.pathname);
  if (path === "/professor") return <TeacherPage />;
  if (path.startsWith("/entrar/"))
    return <StudentPage code={path.slice("/entrar/".length).toUpperCase()} />;
  if (path.startsWith("/projetor/"))
    return <ProjectorPage sessionId={path.slice("/projetor/".length)} />;
  return <HomePage />;
}
