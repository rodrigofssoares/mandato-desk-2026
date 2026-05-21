import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Star, Trash2, Type } from 'lucide-react';
import { useAgentPresets, PRESET_LABELS, PRESET_ICONS, type AgentPreset, type AgentModel, type PresetKey } from '@/hooks/useAgentPresets';
import {
  useSetActivePreset,
  useToggleModelInPreset,
  useSetDefaultModelInPreset,
  useAddModelToPreset,
  useRemoveModelFromPreset,
} from '@/hooks/useAgentPresetsMutation';
import type { AgentIdentityForm } from './formSchema';
import type { AgentSettings } from '@/hooks/useAgentSettings';
import { cn } from '@/lib/utils';


// ============================================================================
// Modelos disponíveis para adicionar
// ============================================================================

interface AvailableModel {
  model_id: string;
  provider: string;
  label: string;
  price: string;
  multimodal?: boolean;
}

const AVAILABLE_MODELS: AvailableModel[] = [
  { model_id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', price: '$2.50/$10' },
  { model_id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini', price: '$0.15/$0.60' },
  { model_id: 'o3-mini', provider: 'openai', label: 'o3-mini reasoning', price: '$1.10/$4.40' },
  { model_id: 'claude-3-5-sonnet', provider: 'anthropic', label: 'Claude 3.5 Sonnet', price: '$3/$15' },
  { model_id: 'claude-3-5-haiku', provider: 'anthropic', label: 'Claude 3.5 Haiku', price: '$0.80/$4' },
  { model_id: 'claude-opus-4', provider: 'anthropic', label: 'Claude Opus 4', price: '$15/$75' },
  { model_id: 'llama-3.3-70b', provider: 'openrouter', label: 'Llama 3.3 70B', price: '$0.13/$0.40' },
  { model_id: 'deepseek-chat', provider: 'openrouter', label: 'DeepSeek Chat', price: '$0.14/$0.28' },
  { model_id: 'gemini-2.5-pro', provider: 'openrouter', label: 'Gemini 2.5 Pro', price: '$1.25/$10', multimodal: true },
  { model_id: 'qwen-2.5-72b', provider: 'openrouter', label: 'Qwen 2.5 72B', price: '$0.40/$1.20' },
  { model_id: 'mistral-large', provider: 'openrouter', label: 'Mistral Large', price: '$2/$6' },
];

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-[#10A37F]',
  anthropic: 'bg-[#D77655]',
  openrouter: 'bg-primary',
};

const PRESET_COLORS: Record<PresetKey, string> = {
  econ: 'bg-green-500',
  bal: 'bg-blue-500',
  pre: 'bg-primary',
  custom: 'bg-muted-foreground',
};

// ============================================================================
// AddModelPicker (dropdown popup com busca)
// ============================================================================

interface AddModelPickerProps {
  preset: AgentPreset;
  textOnlyMode: boolean;
  open: boolean;
  onClose: () => void;
}

function AddModelPicker({ preset, textOnlyMode, open, onClose }: AddModelPickerProps) {
  const [search, setSearch] = useState('');
  const addMutation = useAddModelToPreset();

  const existingIds = preset.models.map((m) => m.model_id);
  const filtered = AVAILABLE_MODELS.filter((m) => {
    if (existingIds.includes(m.model_id)) return false;
    if (textOnlyMode && m.multimodal) return false;
    return m.label.toLowerCase().includes(search.toLowerCase());
  });

  if (!open) return null;

  return (
    <div
      className="border border-border rounded-xl bg-card shadow-lg mx-3 mb-3 overflow-hidden"
      role="dialog"
      aria-label="Adicionar modelo ao preset"
    >
      <div className="p-2 border-b border-border">
        <Input
          autoFocus
          placeholder="Buscar modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
          aria-label="Buscar modelo para adicionar"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum modelo disponível
          </p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.model_id}
              type="button"
              onClick={async () => {
                await addMutation.mutateAsync({
                  preset_id: preset.id,
                  provider: m.provider,
                  model_id: m.model_id,
                });
                onClose();
              }}
              disabled={addMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-sm flex-shrink-0',
                  PROVIDER_COLORS[m.provider] ?? 'bg-muted'
                )}
              />
              <span className="flex-1 text-xs font-medium">{m.label}</span>
              <span className="text-[10px] text-muted-foreground">{m.price}</span>
              {m.multimodal && (
                <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 rounded">
                  multi
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ModelRow
// ============================================================================

interface ModelRowProps {
  model: AgentModel;
  preset: AgentPreset;
  textOnlyMode: boolean;
}

function ModelRow({ model, preset, textOnlyMode }: ModelRowProps) {
  const toggleMutation = useToggleModelInPreset();
  const setDefaultMutation = useSetDefaultModelInPreset();
  const removeMutation = useRemoveModelFromPreset();

  const isMultimodal = AVAILABLE_MODELS.find((m) => m.model_id === model.model_id)?.multimodal;
  const disabledByTextOnly = textOnlyMode && !!isMultimodal;
  const effectiveEnabled = model.enabled && !disabledByTextOnly;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border border-border bg-background transition-all',
        !effectiveEnabled && 'opacity-50',
        disabledByTextOnly && 'bg-yellow-50/50 border-yellow-200/50'
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-sm flex-shrink-0',
          PROVIDER_COLORS[model.provider] ?? 'bg-muted'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold truncate">{model.model_id}</span>
          {model.is_default && (
            <Star className="h-2.5 w-2.5 text-yellow-500 flex-shrink-0" aria-label="Modelo padrão" />
          )}
          {disabledByTextOnly && (
            <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1 rounded">
              multi
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">{model.provider}</p>
      </div>

      <button
        type="button"
        onClick={() =>
          setDefaultMutation.mutate({ preset_id: preset.id, model_id: model.id })
        }
        disabled={setDefaultMutation.isPending || !effectiveEnabled}
        className={cn(
          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors',
          model.is_default
            ? 'border-yellow-400/60 bg-yellow-100/60 text-yellow-700'
            : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
        )}
        aria-label={model.is_default ? 'Modelo padrão atual' : 'Definir como padrão'}
        aria-pressed={model.is_default}
      >
        Padrão
      </button>

      <Switch
        checked={effectiveEnabled}
        onCheckedChange={(checked) =>
          toggleMutation.mutate({ model_id: model.id, enabled: checked })
        }
        disabled={toggleMutation.isPending || disabledByTextOnly}
        aria-label={`${effectiveEnabled ? 'Desativar' : 'Ativar'} modelo ${model.model_id}`}
        className="scale-75 origin-right"
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            aria-label={`Remover modelo ${model.model_id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo <strong>{model.model_id}</strong> será removido do preset{' '}
              <strong>{PRESET_LABELS[preset.preset_key]}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate(model.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// PresetBox
// ============================================================================

interface PresetBoxProps {
  preset: AgentPreset;
  agentId: string;
  textOnlyMode: boolean;
}

function PresetBox({ preset, agentId, textOnlyMode }: PresetBoxProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const setActiveMutation = useSetActivePreset();

  const activeModels = preset.models.filter((m) => m.enabled).length;
  const colorClass = PRESET_COLORS[preset.preset_key] ?? 'bg-muted';
  const isActive = preset.is_active_preset;

  return (
    <div
      className={cn(
        'bg-card border-2 rounded-xl overflow-hidden transition-all duration-200',
        isActive ? 'border-primary shadow-sm shadow-primary/10' : 'border-border'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'p-3.5 border-b border-border',
          `bg-${preset.preset_key === 'econ' ? 'green' : preset.preset_key === 'bal' ? 'blue' : 'primary'}-500/8`
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>
            {PRESET_ICONS[preset.preset_key]}
          </span>
          <span className="font-bold text-sm flex-1">{PRESET_LABELS[preset.preset_key]}</span>
          {isActive && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/15 px-2 py-0.5 rounded">
              em uso
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          {preset.preset_key === 'econ' && 'Modelos baratos e rápidos. Alto volume, perguntas simples.'}
          {preset.preset_key === 'bal' && 'Mistura rápidos e premium. Boa cobertura sem explodir custo.'}
          {preset.preset_key === 'pre' && 'Modelos topo de linha. Qualidade importa mais que custo.'}
          {preset.preset_key === 'custom' && 'Configuração personalizada.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-0 bg-muted/40 border-b border-border">
        <div className="p-2 text-center border-r border-border">
          <p className={cn('font-bold text-base', colorClass.replace('bg-', 'text-'))}>
            {activeModels}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">ativos</p>
        </div>
        <div className="p-2 text-center">
          <p className={cn('font-bold text-base', colorClass.replace('bg-', 'text-'))}>
            {preset.models.length}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">total</p>
        </div>
      </div>

      {/* Models list */}
      <div className="p-3 space-y-1.5">
        {preset.models.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum modelo neste preset
          </p>
        ) : (
          preset.models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              preset={preset}
              textOnlyMode={textOnlyMode}
            />
          ))
        )}
      </div>

      {/* Picker popup */}
      <AddModelPicker
        preset={preset}
        textOnlyMode={textOnlyMode}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />

      {/* Actions */}
      <div className="flex gap-2 p-3 pt-0 border-t border-border">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex-1 flex items-center justify-center gap-1 border border-dashed border-border rounded-lg py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
        <button
          type="button"
          disabled={isActive || setActiveMutation.isPending}
          onClick={() =>
            setActiveMutation.mutate({ agent_id: agentId, preset_key: preset.preset_key })
          }
          className={cn(
            'flex-1 flex items-center justify-center gap-1 border rounded-lg py-2 text-xs font-medium transition-colors',
            isActive
              ? 'border-primary/30 bg-primary/8 text-primary cursor-default'
              : 'border-border hover:border-primary hover:text-primary text-muted-foreground'
          )}
        >
          {setActiveMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isActive ? (
            '✓ Em uso'
          ) : (
            'Usar este preset'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ModelsStep
// ============================================================================

interface ModelsStepProps {
  agentData: AgentSettings;
}

export function ModelsStep({ agentData }: ModelsStepProps) {
  const { control } = useFormContext<AgentIdentityForm>();
  const { data: presets = [], isLoading } = useAgentPresets();

  return (
    <div className="space-y-4">
      {/* Master rule: texto apenas */}
      <Controller
        name="text_only_mode"
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200/60 rounded-xl">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Type className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Apenas modelos de texto</p>
              <p className="text-xs text-blue-700 mt-0.5 leading-snug">
                Multimodais (visão/áudio) ficam bloqueados — destacados em amarelo. Vision custa
                5–15× mais por consulta.
              </p>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Ativar modo apenas modelos de texto"
            />
          </div>
        )}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground flex-1 min-w-0">
          Escolha um preset como ponto de partida e ajuste modelos individualmente.{' '}
          <Star className="h-3 w-3 inline text-yellow-500" aria-hidden /> = padrão (usado quando o usuário não seleciona).
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <PresetBox
              key={preset.id}
              preset={preset}
              agentId={agentData.id}
              textOnlyMode={control._formValues.text_only_mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
