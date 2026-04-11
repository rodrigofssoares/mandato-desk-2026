import { describe, it, expect } from "vitest";

describe("infra de testes", () => {
  it("vitest + jsdom carregam", () => {
    expect(1 + 1).toBe(2);
  });

  it("matchMedia polyfill está disponível", () => {
    expect(typeof window.matchMedia).toBe("function");
    const mq = window.matchMedia("(min-width: 640px)");
    expect(mq.matches).toBe(false);
  });

  it("ResizeObserver polyfill está disponível", () => {
    expect(typeof global.ResizeObserver).toBe("function");
    const ro = new ResizeObserver(() => {});
    expect(typeof ro.observe).toBe("function");
  });
});
