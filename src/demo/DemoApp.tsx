import { Home } from "./screens/Home";
import { Projection } from "./screens/Projection";
import { Student } from "./screens/Student";
import { Teacher } from "./screens/Teacher";

export function DemoApp() {
  const path = window.location.pathname;
  if (path === "/demo/professor") return <Teacher />;
  if (path === "/demo/projetor") return <Projection />;
  if (path === "/demo/aluno" || path.startsWith("/demo/aluno/"))
    return <Student code={path.split("/")[3] || "DEMO1234"} />;
  return <Home />;
}
