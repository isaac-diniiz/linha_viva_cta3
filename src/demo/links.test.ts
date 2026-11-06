import { describe, expect, it } from "vitest";
import { demoLinks } from "./links";

describe("links impressos pelo servidor da demonstração", () => {
  it("usa o endereço público configurado", () => {
    expect(
      demoLinks({
        env: { DEMO_PUBLIC_URL: "https://linha-viva.exemplo.org" },
        port: 4173,
        code: "1A2B3C4D",
      }),
    ).toEqual({
      teacher: "https://linha-viva.exemplo.org/demo/professor",
      students: "https://linha-viva.exemplo.org/demo/aluno/1A2B3C4D",
    });
  });

  it("usa o endereço que o Render informa quando não há um configurado", () => {
    const links = demoLinks({
      env: { RENDER_EXTERNAL_URL: "https://linha-viva.onrender.com" },
      port: 10000,
      code: "CODE",
    });
    expect(links.students).toBe(
      "https://linha-viva.onrender.com/demo/aluno/CODE",
    );
  });

  it("cai para o computador local sem endereço público", () => {
    expect(demoLinks({ env: {}, port: 4173, code: "C" }).teacher).toBe(
      "http://localhost:4173/demo/professor",
    );
  });

  it("não põe chave no link do professor: o acesso é pelo login", () => {
    const { teacher } = demoLinks({
      env: { DEMO_PUBLIC_URL: "https://x.org/" },
      port: 1,
      code: "C",
    });
    expect(new URL(teacher).search).toBe("");
  });
});
