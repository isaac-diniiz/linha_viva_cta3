import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Board } from "../../components/Board";
import { useLocalDemo } from "../client";
import { boardData, Connection, Header } from "../shared";

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
        <span className="header-tag">
          {state?.status === "active"
            ? "EM CONSTRUÇÃO"
            : state?.status === "paused"
              ? "PAUSADA"
              : state?.status === "ended"
                ? "ENCERRADA"
                : "AGUARDANDO"}
        </span>
      </section>
      {connected && state?.status === "waiting" && <JoinQr code={state.code} />}
      <Board
        {...boardData(state)}
        previews={state?.previews ?? {}}
        className="demo-projection-board"
      />
      {state?.revealed && (
        <div className="notice" role="status">
          Sequência de referência: {state.reference?.join(" → ")}
        </div>
      )}
    </main>
  );
}
