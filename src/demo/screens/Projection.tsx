import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { TrackBoard } from "../../components/TrackBoard";
import { useLocalDemo } from "../client";
import {
  boardData,
  Connection,
  Header,
  ReferencePanel,
  StatusBadge,
} from "../shared";

function JoinQr({ code }: { code: string }) {
  const url = `${location.origin}/demo/aluno/${encodeURIComponent(code)}`;
  const [image, setImage] = useState("");

  useEffect(() => {
    let current = true;
    setImage("");
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 3,
      width: 320,
    }).then((data) => {
      if (current) setImage(data);
    });
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <aside className="demo-join-qr">
      <div>
        <div className="section-label">ENTRE NA ATIVIDADE</div>
        <p>Aponte a câmera do celular para o QR Code.</p>
        <strong>Código: {code}</strong>
      </div>
      {image && (
        <img
          src={image}
          alt="QR Code para alunos entrarem"
          data-join-url={url}
          width="240"
          height="240"
        />
      )}
    </aside>
  );
}

/** Depois de iniciar, o QR sai, mas quem chega atrasado ainda vê como entrar. */
function JoinStrip({ code }: { code: string }) {
  return (
    <section className="demo-join-strip" aria-label="Entrar na turma">
      <span>Chegou agora? Entre em</span>
      <strong>{location.host}/demo/aluno</strong>
      <span>e digite o código</span>
      <strong className="join-code">{code}</strong>
    </section>
  );
}

export function Projection() {
  const { state, connected, error } = useLocalDemo("projection");
  return (
    <main className="app-shell demo-shell">
      <Header role="PROJEÇÃO" />
      <Connection connected={connected} error={error} />
      <section className="demo-heading">
        <div>
          <h1>{state?.title ?? "Aguardando…"}</h1>
          <p>{state?.instruction}</p>
        </div>
        {state && <StatusBadge status={state.status} />}
      </section>
      {connected && state?.status === "waiting" && <JoinQr code={state.code} />}
      {connected &&
        (state?.status === "active" || state?.status === "paused") && (
          <JoinStrip code={state.code} />
        )}
      {state?.status === "ended" && (
        <section className="closing-panel" aria-label="Fechamento">
          <h2>Linha final da turma</h2>
          <p>
            Obrigado pela participação! Agora vamos conversar sobre as escolhas
            da turma.
          </p>
        </section>
      )}
      {/* acima da trilha: embaixo, a referência ficava fora da tela do projetor */}
      {state?.revealed && state.reference && (
        <ReferencePanel labels={state.reference} />
      )}
      <TrackBoard
        {...boardData(state)}
        previews={state?.previews ?? {}}
        className="demo-projection-board"
      />
    </main>
  );
}
