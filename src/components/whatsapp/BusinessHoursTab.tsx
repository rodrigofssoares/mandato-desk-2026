// ─── BusinessHoursTab (T51 — C27) ────────────────────────────────────────────
// Aba "Horário" no AccountFormDialog: configura expediente da conta Z-API.
// Salva via useUpdateZapiAccount (sem nova EF).

import { useState, useEffect } from 'react';
import { Clock, Save, ToggleLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  type BusinessHoursConfig,
  type DayKey,
  DAY_ORDER,
  DAY_LABELS,
  buildDefaultConfig,
} from '@/hooks/useBusinessHours';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BusinessHoursTabProps {
  account: ZapiAccount;
  isSaving: boolean;
  onSave: (config: BusinessHoursConfig | null) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseExistingConfig(raw: unknown): BusinessHoursConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const allDays: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const result = {} as BusinessHoursConfig;
  for (const key of allDays) {
    const d = obj[key];
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const day = d as Record<string, unknown>;
    result[key] = {
      inicio: typeof day.inicio === 'string' ? day.inicio : '08:00',
      fim: typeof day.fim === 'string' ? day.fim : '18:00',
      ativo: typeof day.ativo === 'boolean' ? day.ativo : false,
    };
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BusinessHoursTab({ account, isSaving, onSave }: BusinessHoursTabProps) {
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<BusinessHoursConfig>(buildDefaultConfig);

  // Inicializa com a config existente da conta
  useEffect(() => {
    const existing = parseExistingConfig(account.horario_atendimento);
    if (existing) {
      setEnabled(true);
      setConfig(existing);
    } else {
      setEnabled(false);
      setConfig(buildDefaultConfig());
    }
  }, [account]);

  function updateDay(day: DayKey, field: 'inicio' | 'fim' | 'ativo', value: string | boolean) {
    setConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function handleSave() {
    onSave(enabled ? config : null);
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Header do toggle principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Horário de atendimento</p>
            <p className="text-xs text-muted-foreground">
              Exibe aviso quando a conversa estiver fora do expediente
            </p>
          </div>
        </div>
        <Switch
          id="horario-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {!enabled && (
        <Alert className="border-muted/50">
          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-xs text-muted-foreground">
            Horário desabilitado — nenhum aviso será exibido na conversa.
            Ative para configurar o expediente.
          </AlertDescription>
        </Alert>
      )}

      {enabled && (
        <>
          <Alert className="border-blue-200/50 bg-blue-50/50 dark:bg-blue-950/10">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              O aviso aparece no cabeçalho da conversa quando o horário atual
              está fora do expediente. O envio de mensagens não é bloqueado.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            {DAY_ORDER.map((day) => {
              const d = config[day];
              return (
                <div
                  key={day}
                  className={`grid grid-cols-[120px_1fr_1fr_40px] gap-2 items-center py-2 px-3 rounded-md border transition-colors ${
                    d.ativo
                      ? 'border-border bg-background'
                      : 'border-border/30 bg-muted/20 opacity-60'
                  }`}
                >
                  {/* Label do dia */}
                  <Label className="text-xs font-normal truncate">
                    {DAY_LABELS[day]}
                  </Label>

                  {/* Input de início */}
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Início</p>
                    <input
                      type="time"
                      value={d.inicio}
                      disabled={!d.ativo}
                      onChange={(e) => updateDay(day, 'inicio', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Input de fim */}
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Fim</p>
                    <input
                      type="time"
                      value={d.fim}
                      disabled={!d.ativo}
                      onChange={(e) => updateDay(day, 'fim', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Toggle ativo */}
                  <Switch
                    checked={d.ativo}
                    onCheckedChange={(v) => updateDay(day, 'ativo', v)}
                    className="h-4 w-7"
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="pt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Salvando...' : 'Salvar horário'}
        </Button>
      </div>
    </div>
  );
}
