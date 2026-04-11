import { describe, it, expect } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
  it("normaliza acentos", () => {
    expect(slugify("Cargo Liderança")).toBe("cargo_lideranca");
    expect(slugify("Território Ativação")).toBe("territorio_ativacao");
    expect(slugify("Situação")).toBe("situacao");
  });

  it("troca caracteres especiais e números por _", () => {
    expect(slugify("Nº Dependentes")).toBe("n_dependentes");
    expect(slugify("E-mail")).toBe("e_mail");
    expect(slugify("Disponível p/ doar?")).toBe("disponivel_p_doar");
  });

  it("remove _ nas bordas e espaços", () => {
    expect(slugify("  espaços  ")).toBe("espacos");
    expect(slugify("_underscored_")).toBe("underscored");
  });

  it("lida com string vazia ou indefinida", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null as unknown as string)).toBe("");
    expect(slugify(undefined as unknown as string)).toBe("");
  });

  it("colapsa múltiplos separadores em um só", () => {
    expect(slugify("a   b   c")).toBe("a_b_c");
    expect(slugify("a---b---c")).toBe("a_b_c");
  });
});
