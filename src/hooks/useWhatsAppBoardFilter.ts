/**
 * useWhatsAppBoardFilter.ts
 *
 * Hook que gerencia o estado de filtro tri-state "Aceite WhatsApp" para um funil
 * específico, com persistência via localStorage.
 *
 * - mode: 'all' | 'yes' | 'no'
 * - stageFromIndex: índice no array de `stages` a partir do qual o filtro se aplica
 *   (etapas antes do índice são "protegidas" — mostram todos os cards)
 *
 * Internamente salva/lê o `id` da etapa (não o índice) para ser robusto contra
 * reordenações. O índice é derivado do array de stages a cada render.
 *
 * Fallback quando o stage salvo não existe mais: Math.floor(stages.length / 2)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardStage } from '@/hooks/useBoardStages';
import {
  getFilter,
  setFilter,
  type WhatsAppFilterMode,
} from '@/lib/boardFilterStorage';

interface WhatsAppBoardFilterResult {
  mode: WhatsAppFilterMode;
  stageFromIndex: number;
  setMode: (mode: WhatsAppFilterMode) => void;
  setStageFromIndex: (index: number) => void;
}

function defaultIndex(stages: BoardStage[]): number {
  return Math.floor(stages.length / 2);
}

export function useWhatsAppBoardFilter(
  boardId: string | null | undefined,
  stages: BoardStage[],
): WhatsAppBoardFilterResult {
  const [mode, setModeState] = useState<WhatsAppFilterMode>('all');
  const [stageFromIndex, setStageFromIndexState] = useState<number>(0);

  // Evita persistir no mount (sobrescreveria dado salvo no ciclo inicial)
  const hasMounted = useRef(false);
  // Rastreia qual boardId foi carregado para detectar troca de funil
  const loadedBoardId = useRef<string | null>(null);

  // Carrega preferência salva sempre que o boardId ou o array de stages muda.
  // A persistência do funil anterior já é feita pelo effect abaixo a cada
  // mudança de mode/stageFromIndex, então ao trocar de funil basta carregar o novo.
  useEffect(() => {
    if (!boardId || stages.length === 0) return;

    const saved = getFilter(boardId);
    const idx = (() => {
      if (!saved || !saved.stageFromId) return defaultIndex(stages);
      const found = stages.findIndex((s) => s.id === saved.stageFromId);
      return found >= 0 ? found : defaultIndex(stages);
    })();

    setModeState(saved?.mode ?? 'all');
    setStageFromIndexState(idx);
    loadedBoardId.current = boardId;
    hasMounted.current = true;
  // stages.length é a assinatura estável — useQuery pode recriar o array
  // a cada render mesmo sem mudança real de dados.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, stages.length]);

  // Persiste sempre que mode ou stageFromIndex muda, mas só após o mount.
  // Mesma razão do effect acima pra não listar `stages` direto.
  useEffect(() => {
    if (!hasMounted.current || !boardId || stages.length === 0) return;
    const stageFromId = stages[stageFromIndex]?.id ?? null;
    setFilter(boardId, { mode, stageFromId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stageFromIndex, boardId, stages.length]);

  const setMode = useCallback((newMode: WhatsAppFilterMode) => {
    setModeState(newMode);
  }, []);

  const setStageFromIndex = useCallback((index: number) => {
    setStageFromIndexState(index);
  }, []);

  return { mode, stageFromIndex, setMode, setStageFromIndex };
}
