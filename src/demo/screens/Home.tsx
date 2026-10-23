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
            Alunos entram pelo QR Code da projeção ou digitando o código da
            turma. Os dados ficam só na memória do servidor e são apagados
            quando ele reinicia.
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
