import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, Check, User, Plug, Cpu, DollarSign } from 'lucide-react';
import { useAgentSettings, isFullAgentSettings } from '@/hooks/useAgentSettings';
import { useUpsertAgentSettings } from '@/hooks/useAgentSettingsMutation';
import { BudgetStripSticky } from './agent/BudgetStripSticky';
import { IdentityStep } from './agent/IdentityStep';
import { ConnectionsStep } from './agent/ConnectionsStep';
import { ModelsStep } from './agent/ModelsStep';
import { BudgetStep } from './agent/BudgetStep';
import { identitySchema, type AgentIdentityForm } from './agent/formSchema';
import { cn } from '@/lib/utils';

// ============================================================================
// Config dos steps
// ============================================================================

const STEPS = [
  { index: 0, label: 'Identidade', icon: User },
  { index: 1, label: 'Conexões', icon: Plug },
  { index: 2, label: 'Modelos', icon: Cpu },
  { index: 3, label: 'Orçamento', icon: DollarSign },
] as const;

// ============================================================================
// Componente
// ============================================================================

export function AgentSettingsTab() {
  const [activeStep, setActiveStep] = useState(0);

  const { data: agentData, isLoading } = useAgentSettings();
  const upsertMutation = useUpsertAgentSettings();

  const agent = isFullAgentSettings(agentData) ? agentData : null;

  const form = useForm<AgentIdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      is_active: agent?.is_active ?? false,
      name: agent?.name ?? '',
      system_prompt: agent?.system_prompt ?? '',
      text_only_mode: agent?.text_only_mode ?? false,
    },
    values: agent
      ? {
          is_active: agent.is_active,
          name: agent.name,
          system_prompt: agent.system_prompt ?? '',
          text_only_mode: agent.text_only_mode,
        }
      : undefined,
  });

  const { isDirty, isValid } = form.formState;

  const handleSaveIdentity = async () => {
    if (!agent) return;
    const values = form.getValues();
    await upsertMutation.mutateAsync({
      id: agent.id,
      data: {
        name: values.name,
        system_prompt: values.system_prompt ?? null,
        is_active: values.is_active,
        text_only_mode: values.text_only_mode,
      },
    });
    form.reset(values);
  };

  const handleNext = async () => {
    // Se está no step de identidade e há mudanças, salva antes de avançar
    if (activeStep === 0 && isDirty) {
      const valid = await form.trigger(['name', 'is_active', 'text_only_mode']);
      if (!valid) return;
      await handleSaveIdentity();
    }
    setActiveStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePrev = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  // ============================================================================
  // Loading / erro / sem agente
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center space-y-2">
        <p className="font-semibold text-foreground">Agente não configurado</p>
        <p>A linha singleton de <code>ai_agents</code> não foi encontrada. Verifique se as migrations da Onda 1 foram aplicadas.</p>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  const stepLabels = ['Passo 1 de 4', 'Passo 2 de 4', 'Passo 3 de 4', 'Passo 4 de 4 · Tudo pronto!'];
  const nextLabels = ['Próximo: Conexões', 'Próximo: Modelos', 'Próximo: Orçamento', ''];
  const isLastStep = activeStep === 3;

  return (
    <FormProvider {...form}>
      <div className="space-y-4">

        {/* Budget strip sticky */}
        <BudgetStripSticky
          agentData={agent}
          onAdjust={() => setActiveStep(3)}
        />

        {/* Stepper visual (sub-tabs) */}
        <div className="flex bg-card border border-border rounded-xl p-1 gap-0.5 overflow-x-auto">
          {STEPS.map((step) => {
            const isDone = step.index < activeStep;
            const isActive = step.index === activeStep;
            const Icon = step.icon;

            return (
              <button
                key={step.index}
                type="button"
                onClick={() => setActiveStep(step.index)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg flex-1 justify-center transition-all duration-150 whitespace-nowrap text-sm font-medium',
                  isActive && 'bg-primary text-white',
                  isDone && !isActive && 'text-muted-foreground hover:bg-muted',
                  !isActive && !isDone && 'text-muted-foreground hover:bg-muted'
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Passo ${step.index + 1}: ${step.label}`}
              >
                {/* Badge numérico */}
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                    isActive ? 'bg-[hsl(40,62%,55%)] text-foreground' : '',
                    isDone ? 'bg-green-100 text-green-700' : '',
                    !isActive && !isDone ? 'bg-muted text-muted-foreground' : ''
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : step.index + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
                <Icon className="h-3.5 w-3.5 sm:hidden" aria-hidden />
              </button>
            );
          })}
        </div>

        {/* Panels */}
        {activeStep === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <IdentityStep agentData={agent} />
          </div>
        )}
        {activeStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <ConnectionsStep />
          </div>
        )}
        {activeStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <ModelsStep agentData={agent} />
          </div>
        )}
        {activeStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <BudgetStep />
          </div>
        )}

        {/* Navegação entre steps */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          {activeStep > 0 ? (
            <Button type="button" variant="outline" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          ) : (
            <div />
          )}

          <span className="text-xs text-muted-foreground flex-1 text-center hidden sm:block">
            {stepLabels[activeStep]}
          </span>

          {!isLastStep ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={upsertMutation.isPending}
              className="ml-auto"
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              {nextLabels[activeStep]}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSaveIdentity}
              disabled={upsertMutation.isPending || !isDirty}
              className="ml-auto"
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Salvar configuração
            </Button>
          )}
        </div>

        {/* Save bar sticky */}
        {isDirty && activeStep === 0 && (
          <div className="sticky bottom-2 bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <p className="flex-1 text-xs text-muted-foreground">
              Alterações não salvas em{' '}
              <strong className="text-foreground">Identidade</strong>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => form.reset()}
            >
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveIdentity}
              disabled={upsertMutation.isPending || !isValid}
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </div>
        )}

      </div>
    </FormProvider>
  );
}
