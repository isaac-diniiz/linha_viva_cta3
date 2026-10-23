import { Header } from "../shared";

export function Home() {
  return (
    <main className="app-shell demo-shell">
      <Header role="INÍCIO" />
      <section className="panel demo-welcome">
        <div className="demo-welcome-copy">
          <div className="eyebrow">APRENDER É CONSTRUIR JUNTO</div>
          <h1>Uma linha feita por todos.</h1>
          <p>
            Abra o painel do professor e compartilhe o link de entrada com a
            turma.
          </p>
          <div className="demo-links">
            <a className="button primary" href="/demo/professor">
              Professor
            </a>
            <a className="button secondary" href="/demo/projetor">
              Projeção
            </a>
            <a className="button secondary" href="/demo/aluno">
              Aluno
            </a>
          </div>
          <p className="small-help">
            Código de demonstração: <strong>DEMO1234</strong>. Os dados são
            apagados ao parar o servidor local.
          </p>
        </div>
        <img
          className="home-logo-image"
          src="/linha-viva-logo.png"
          alt="Logo da Linha Viva"
        />
      </section>
    </main>
  );
}
