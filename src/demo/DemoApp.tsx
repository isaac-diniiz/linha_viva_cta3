import { Home } from "./screens/Home";
import { JoinCode } from "./screens/JoinCode";
import { Projection } from "./screens/Projection";
import { Student } from "./screens/Student";
import { Teacher } from "./screens/Teacher";

export function DemoApp() {
  const path = window.location.pathname;
  if (path === "/demo/professor") return <Teacher />;
  if (path === "/demo/projetor") return <Projection />;
  if (path === "/demo/aluno" || path.startsWith("/demo/aluno/")) {
    const code = decodeURIComponent(path.split("/")[3] ?? "");
    return code ? <Student code={code} /> : <JoinCode />;
  }
  return <Home />;
}
