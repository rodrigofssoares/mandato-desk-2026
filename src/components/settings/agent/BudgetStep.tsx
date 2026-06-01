import { useState, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import { useAgentBudget } from '@/hooks/useAgentBudget';
import { useUpdateBudget } from '@/hooks/useAgentBudgetMutation';
import { cn } from '@/lib/utils';

// ============================================================================
// Cenários do simulador
// ============================================================================

interface Scenario {
  key: string;
  label: string;
  subLabel: string;
  msgsPerDay: number;
  costPerMsg: number;
}

const SCENARIOS: Scenario[] = [
  { key: 'conservador', label: 'Conservador', subLabel: '10 msg/dia', msgsPerDay: 10, costPerMsg: 0.08 },
  { key: 'real', label: 'Real (atual)', subLabel: '30 msg/dia', msgsPerDay: 30, costPerMsg: 0.08 },
  { key: 'pico', label: 'Pico', subLabel: '60 msg/dia', msgsPerDay: 60, costPerMsg: 0.09 },
  { key: 'crise', label: 'Crise', subLabel: '120 msg/dia', msgsPerDay: 120, costPerMsg: 0.10 },
];

function calcMonthlyCost(s: Scenario) {
  return Math.round(s.msgsPerDay * s.costPerMsg * 30);
}

// ============================================================================
// BudgetStep
// ============================================================================

export function BudgetStep() {
  const { data: budget, isLoading } = useAgentBudget();
  const updateMutation = useUpdateBudget();

  // Estado local controlado pelos sliders/switches
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [maxMsgsPerDay, setMaxMsgsPerDay] = useState<number | null>(null);
  const [maxBrlPerUser, setMaxBrlPerUser] = useState<number | null>(null);
  // MF-2: yellowEnabled/redEnabled hidratam do banco — NULL = desabilitado
  const [yellowEnabled, setYellowEnabled] = useState(true);
  const [redEnabled, setRedEnabled] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);

  const [activeScenario, setActiveScenario] = useState('real');
  const [isDirty, setIsDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // SF-3: hidrata estado local quando budget carrega ou muda (ex: invalidação de cache)
  useEffect(() => {
    if (!budget) return;

    setMonthlyLimit(budget.monthly_limit_brl);
    setMaxTokens(budget.max_tokens_per_response);
    setMaxMsgsPerDay(budget.max_messages_per_user_per_day);
    setMaxBrlPerUser(budget.max_brl_per_user_per_month);
    // NULL no banco = toggle desabilitado
    setYellowEnabled(budget.threshold_yellow_pct != null);
    setRedEnabled(budget.threshold_red_pct != null);
    setAutoBlock(budget.auto_block_at_100);
    setHydrated(true);
    setIsDirty(false);
  }, [budget]);

  // Valores efetivos — fallback seguro enquanto não hidratou
  const effectiveLimit = monthlyLimit ?? 50;
  const effectiveTokens = maxTokens ?? 2048;
  const effectiveMsgsDay = maxMsgsPerDay ?? 50;
  const effectiveBrlUser = maxBrlPerUser ?? 25;
  const effectiveAutoBlock = autoBlock;

  const projectedCost = SCENARIOS.find((s) => s.key === activeScenario)
    ? calcMonthlyCost(SCENARIOS.find((s) => s.key === activeScenario)!)
    : 0;

  const projPct = (projectedCost / effectiveLimit) * 100;
  const projStatus =
    projPct > 100 ? 'over' : projPct > 90 ? 'red' : projPct > 70 ? 'yellow' : 'ok';

  const markDirty = useCallback(() => setIsDirty(true), []);

  // MF-2: threshold NULL quando toggle off — persistência correta no banco
  const handleSave = async () => {
    if (!budget) return;
    await updateMutation.mutateAsync({
      id: budget.id,
      data: {
        monthly_limit_brl: effectiveLimit,
        threshold_yellow_pct: yellowEnabled ? 70 : null,
        threshold_red_pct: redEnabled ? 90 : null,
        auto_block_at_100: effectiveAutoBlock,
        max_tokens_per_response: effectiveTokens,
        max_messages_per_user_per_day: effectiveMsgsDay,
        max_brl_per_user_per_month: effectiveBrlUser,
      },
    });
    setIsDirty(false);
  };

  if (isLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Grid 2 colunas: Alertas + Limites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Alertas de gasto */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Alertas de gasto</h3>
          <p className="text-xs text-muted-foreground mb-4">Quando avisar e quando suspender o agente.</p>

          <div className="space-y-0 divide-y divide-border">
            {/* Aviso amarelo */}
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 bg-yellow-100 text-yellow-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">Aviso amarelo</p>
                <p className="text-[11px] text-muted-foreground">E-mail ao admin</p>
              </div>
              <span className={cn('font-bold text-sm font-mono', yellowEnabled ? 'text-primary' : 'text-muted-foreground/40')}>
                70%
              </span>
              <Switch
                checked={yellowEnabled}
                onCheckedChange={(v) => { setYellowEnabled(v); markDirty(); }}
                aria-label="Ativar aviso amarelo em 70%"
              />
            </div>

            {/* Aviso vermelho */}
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 bg-red-100 text-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">Aviso vermelho</p>
                <p className="text-[11px] text-muted-foreground">Push + modal</p>
              </div>
              <span className={cn('font-bold text-sm font-mono', redEnabled ? 'text-primary' : 'text-muted-foreground/40')}>
                90%
              </span>
              <Switch
                checked={redEnabled}
                onCheckedChange={(v) => { setRedEnabled(v); markDirty(); }}
                aria-label="Ativar aviso vermelho em 90%"
              />
            </div>

            {/* Bloqueio */}
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 bg-red-100 text-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">✕</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">Bloqueio automático</p>
                <p className="text-[11px] text-muted-foreground">Agente para</p>
              </div>
              <span className="font-bold text-sm font-mono text-primary">100%</span>
              <Switch
                checked={effectiveAutoBlock}
                onCheckedChange={(v) => { setAutoBlock(v); markDirty(); }}
                aria-label="Ativar bloqueio automático em 100%"
              />
            </div>
          </div>
        </div>

        {/* Limites de uso */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Limites de uso</h3>
          <p className="text-xs text-muted-foreground mb-4">Caps por usuário e por mensagem.</p>

          <div className="space-y-4">
            {/* Tokens max */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <Label className="text-xs font-medium">Tokens máx/resposta</Label>
                <span className="font-bold text-sm text-primary font-mono">
                  {effectiveTokens.toLocaleString('pt-BR')} tok
                </span>
              </div>
              <Slider
                value={[effectiveTokens]}
                min={512}
                max={8192}
                step={256}
                onValueChange={([v]) => { setMaxTokens(v); markDirty(); }}
                aria-label="Tokens máximos por resposta"
              />
            </div>

            {/* Msgs por dia */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <Label className="text-xs font-medium">Mensagens/usuário/dia</Label>
                <span className="font-bold text-sm text-primary font-mono">
                  {effectiveMsgsDay} /dia
                </span>
              </div>
              <Slider
                value={[effectiveMsgsDay]}
                min={10}
                max={500}
                step={10}
                onValueChange={([v]) => { setMaxMsgsPerDay(v); markDirty(); }}
                aria-label="Mensagens por usuário por dia"
              />
            </div>

            {/* Custo por usuário */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <Label className="text-xs font-medium">Custo máx/usuário/mês</Label>
                <span className="font-bold text-sm text-primary font-mono">
                  R$ {effectiveBrlUser}
                </span>
              </div>
              <Slider
                value={[effectiveBrlUser]}
                min={5}
                max={100}
                step={5}
                onValueChange={([v]) => { setMaxBrlPerUser(v); markDirty(); }}
                aria-label="Custo máximo por usuário por mês em reais"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Orçamento mensal */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-1">Orçamento mensal</h3>
        <p className="text-xs text-muted-foreground mb-4">Reset automático todo dia 1º.</p>

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <Label className="text-xs font-medium">Limite mensal</Label>
            <span className="font-bold text-lg text-primary font-mono">
              R$ {effectiveLimit}/mês
            </span>
          </div>
          <Slider
            value={[effectiveLimit]}
            min={20}
            max={500}
            step={10}
            onValueChange={([v]) => { setMonthlyLimit(v); markDirty(); }}
            aria-label="Limite mensal de orçamento em reais"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Mínimo R$ 20 · sugestão para gabinete pequeno: R$ 50–100
          </p>
        </div>
      </div>

      {/* Simulador */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm flex-1">Simulador — quanto vai gastar?</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
          {/* Resultado */}
          <div
            className={cn(
              'rounded-xl p-4 text-center bg-muted/50',
              projStatus === 'over' && 'bg-red-50',
              projStatus === 'red' && 'bg-red-50',
              projStatus === 'yellow' && 'bg-yellow-50'
            )}
          >
            <p
              className={cn(
                'font-bold text-3xl font-mono',
                projStatus === 'over' || projStatus === 'red'
                  ? 'text-destructive'
                  : projStatus === 'yellow'
                  ? 'text-yellow-600'
                  : 'text-primary'
              )}
            >
              R$ {projectedCost}
            </p>
            <p className="text-xs text-muted-foreground mt-1">projeção mensal</p>

            {/* Mini barra */}
            <div className="h-1.5 bg-border rounded-full overflow-hidden mt-3">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  projStatus === 'over' || projStatus === 'red'
                    ? 'bg-destructive'
                    : projStatus === 'yellow'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                )}
                style={{ width: `${Math.min(projPct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {Math.round(projPct)}% do orçamento
            </p>
          </div>

          {/* Cenários */}
          <div className="space-y-1.5">
            {SCENARIOS.map((sc) => {
              const cost = calcMonthlyCost(sc);
              const isActive = activeScenario === sc.key;
              return (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => setActiveScenario(sc.key)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left',
                    isActive
                      ? 'bg-primary/8 border-primary/30'
                      : 'border-border hover:bg-muted/50'
                  )}
                  aria-pressed={isActive}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                  <span className="flex-1 text-xs font-medium">{sc.label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{sc.subLabel}</span>
                  <span className="font-bold text-sm font-mono">R$ {cost}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botão salvar orçamento */}
      {isDirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Salvar orçamento
          </button>
        </div>
      )}
    </div>
  );
}
