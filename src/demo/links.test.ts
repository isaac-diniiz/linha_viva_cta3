import { describe, expect, it } from "vitest";
import { demoLinks } from "./links";

describe("links impressos pelo servidor da demonstração", () => {
  it("usa o endereço público configurado", () => {
    expect(
      demoLinks({
        env: { DEMO_PUBLIC_URL: "https://linha-viva.exemplo.org" },
        port: 4173,
        teacherKey: "abc123",
        code: "1A2B3C4D",
      }),
    ).toEqual({
      teacher: "https://linha-viva.exemplo.org/demo/professor?key=abc123",
      students: "https://linha-viva.exemplo.org/demo/aluno/1A2B3C4D",
    });
  });

  it("usa o endereço que o Render informa quando não há um configurado", () => {
    const links = demoLinks({
      env: { RENDER_EXTERNAL_URL: "https://linha-viva.onrender.com" },
      port: 10000,
      teacherKey: "abc",
      code: "CODE",
    });
    expect(links.students).toBe(
      "https://linha-viva.onrender.com/demo/aluno/CODE",
    );
  });

  it("cai para o computador local sem endereço público", () => {
    expect(
      demoLinks({ env: {}, port: 4173, teacherKey: "k", code: "C" }).teacher,
    ).toBe("http://localhost:4173/demo/professor?key=k");
  });

  it("codifica a chave, para + e / não se perderem no navegador", () => {
    const { teacher } = demoLinks({
      env: { DEMO_PUBLIC_URL: "https://x.org/" },
      port: 1,
      teacherKey: "a+b/c=",
      code: "C",
    });
    expect(teacher).toBe("https://x.org/demo/professor?key=a%2Bb%2Fc%3D");
    expect(new URL(teacher).searchParams.get("key")).toBe("a+b/c=");
  });
});
