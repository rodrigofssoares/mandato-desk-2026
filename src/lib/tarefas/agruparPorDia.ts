import {
  isBefore,
  isToday,
  isTomorrow,
  isThisWeek,
  startOfDay,
} from "date-fns";

export interface TarefaAgrupavel {
  id: string;
  data_agendada: string | null;
  concluida: boolean;
  [key: string]: unknown;
}

export interface GruposTarefas<T extends TarefaAgrupavel> {
  atrasadas: T[];
  hoje: T[];
  amanha: T[];
  estaSemana: T[];
  proximas: T[];
  semData: T[];
}

/**
 * Agrupa tarefas em 6 categorias temporais para exibição na listagem.
 *
 * Regras:
 * - `concluida = true` nunca vai para "atrasadas" (conclusão cura o atraso)
 * - `data_agendada = null` vai para "semData"
 * - Ordem de prioridade: atrasadas > hoje > amanhã > semana > próximas
 */
export function agruparTarefasPorDia<T extends TarefaAgrupavel>(
  tarefas: T[]
): GruposTarefas<T> {
  const grupos: GruposTarefas<T> = {
    atrasadas: [],
    hoje: [],
    amanha: [],
    estaSemana: [],
    proximas: [],
    semData: [],
  };

  const agora = startOfDay(new Date());

  for (const t of tarefas) {
    if (!t.data_agendada) {
      grupos.semData.push(t);
      continue;
    }

    const data = new Date(t.data_agendada);

    if (isToday(data)) {
      grupos.hoje.push(t);
      continue;
    }

    if (isTomorrow(data)) {
      grupos.amanha.push(t);
      continue;
    }

    if (isBefore(startOfDay(data), agora)) {
      if (!t.concluida) {
        grupos.atrasadas.push(t);
      }
      continue;
    }

    if (isThisWeek(data, { weekStartsOn: 1 })) {
      grupos.estaSemana.push(t);
      continue;
    }

    grupos.proximas.push(t);
  }

  return grupos;
}
