import { describe, it, expect } from "vitest";
import { agruparTarefasPorDia } from "../agruparPorDia";

function tarefaFake(
  data: string | null,
  concluida = false,
  id = Math.random().toString()
) {
  return { id, data_agendada: data, concluida };
}

function emDias(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  // Meio-dia para evitar virada de fuso
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe("agruparTarefasPorDia", () => {
  it("separa atrasadas, hoje, amanhã, esta semana e próximas", () => {
    const grupos = agruparTarefasPorDia([
      tarefaFake(emDias(-2), false, "atrasada"),
      tarefaFake(emDias(0), false, "hoje"),
      tarefaFake(emDias(1), false, "amanha"),
      tarefaFake(emDias(30), false, "proxima"),
    ]);

    expect(grupos.atrasadas.map((t) => t.id)).toContain("atrasada");
    expect(grupos.hoje.map((t) => t.id)).toContain("hoje");
    expect(grupos.amanha.map((t) => t.id)).toContain("amanha");
    expect(grupos.proximas.map((t) => t.id)).toContain("proxima");
  });

  it("tarefas concluídas não entram em atrasadas", () => {
    const grupos = agruparTarefasPorDia([
      tarefaFake(emDias(-5), true, "atrasada-concluida"),
    ]);

    expect(grupos.atrasadas).toHaveLength(0);
  });

  it("tarefas sem data vão para o grupo semData", () => {
    const grupos = agruparTarefasPorDia([
      tarefaFake(null, false, "sem-data-1"),
      tarefaFake(null, false, "sem-data-2"),
    ]);

    expect(grupos.semData).toHaveLength(2);
  });

  it("lista vazia retorna todos os grupos vazios", () => {
    const grupos = agruparTarefasPorDia([]);

    expect(grupos.atrasadas).toHaveLength(0);
    expect(grupos.hoje).toHaveLength(0);
    expect(grupos.amanha).toHaveLength(0);
    expect(grupos.estaSemana).toHaveLength(0);
    expect(grupos.proximas).toHaveLength(0);
    expect(grupos.semData).toHaveLength(0);
  });
});
