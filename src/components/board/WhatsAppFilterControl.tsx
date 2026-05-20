/**
 * WhatsAppFilterControl.tsx
 *
 * Controle de filtro de aceite WhatsApp para a toolbar do funil.
 *
 * Renderiza inline:
 * - WhatsAppSegmentedControl (tri-state)
 * - Quando filtro ativo (!= 'all'): seletor "a partir de:" + badge de etapas protegidas
 * - Contador "Visíveis: X de Y" quando filtro ativo (T04)
 *
 * Props:
 *   value / onChange — modo tri-state
 *   stageFromIndex / onStageFromChange — índice da etapa de início do filtro
 *   stages — lista de etapas do funil ativo
 *   visibleCount / totalCount — para exibir o contador (T04)
 */

import { ShieldCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WhatsAppSegmentedControl } from '@/components/common/WhatsAppSegmentedControl';
import type { WhatsAppFilterMode } from '@/lib/boardFilterStorage';
import type { BoardStage } from '@/hooks/useBoardStages';

interface WhatsAppFilterControlProps {
  value: WhatsAppFilterMode;
  onChange: (value: WhatsAppFilterMode) => void;
  stageFromIndex: number;
  onStageFromChange: (index: number) => void;
  stages: BoardStage[];
  visibleCount: number;
  totalCount: number;
}

export function WhatsAppFilterControl({
  value,
  onChange,
  stageFromIndex,
  onStageFromChange,
  stages,
  visibleCount,
  totalCount,
}: WhatsAppFilterControlProps) {
  if (stages.length === 0) return null;

  const filtroAtivo = value !== 'all';
  const qtdProtegidas = filtroAtivo ? stageFromIndex : 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Segmented control tri-state */}
      <WhatsAppSegmentedControl value={value} onChange={onChange} />

      {/* Seletor "a partir de:" — só aparece quando filtro ativo */}
      {filtroAtivo && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground whitespace-nowrap">a partir de:</span>

          <Select
            value={String(stageFromIndex)}
            onValueChange={(v) => onStageFromChange(Number(v))}
          >
            <SelectTrigger className="h-7 px-2.5 text-xs w-auto min-w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage, idx) => (
                <SelectItem key={stage.id} value={String(idx)} className="text-xs">
                  {`Etapa ${idx + 1} — ${stage.nome}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Badge de etapas protegidas */}
          {qtdProtegidas > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 whitespace-nowrap">
              <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {qtdProtegidas === 1
                ? 'etapa 1 protegida'
                : `etapas 1–${qtdProtegidas} protegidas`}
            </span>
          )}
        </div>
      )}

      {/* Contador "Visíveis: X de Y" — T04 */}
      {filtroAtivo && (
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
          Visíveis:{' '}
          <span className="font-bold text-foreground">{visibleCount}</span>
          {' de '}
          {totalCount}
        </span>
      )}
    </div>
  );
}
