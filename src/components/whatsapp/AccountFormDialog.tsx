import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, BrainCircuit, Zap, Heart, Clock, Vote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';
import type { RecursosConfig } from '@/lib/featureFlags';
import { FEATURES_CATALOG } from '@/lib/featureFlags';
import { BusinessHoursTab } from './BusinessHoursTab';
import type { BusinessHoursConfig } from '@/hooks/useBusinessHours';

// ─── Schema ─────────────────────────────────────────────────────────────────

// Regex de formato para credenciais Z-API — espelha CHECK constraint do banco (migration 060).
// Impede que o usuário cadastre valores que poderiam causar SSRF nas Edge Functions.
const ZAPI_ALPHANUMERIC_REGEX = /^[A-Za-z0-9]+$/;

const schemaCreate = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  instance_id: z
    .string()
    .min(4, 'Instance ID deve ter ao menos 4 caracteres')
    .max(64, 'Instance ID deve ter no máximo 64 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números'),
  instance_token: z
    .string()
    .min(8, 'Token deve ter ao menos 8 caracteres')
    .max(128, 'Token deve ter no máximo 128 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números'),
  client_token: z
    .string()
    .min(8, 'Client Token deve ter ao menos 8 caracteres')
    .max(128, 'Client Token deve ter no máximo 128 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números'),
  panel_password: z
    .string()
    .max(100)
    .optional()
    .refine((v) => !v || v.length >= 8, 'Senha deve ter ao menos 8 caracteres'),
});

const schemaEdit = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  instance_id: z
    .string()
    .min(4, 'Instance ID deve ter ao menos 4 caracteres')
    .max(64, 'Instance ID deve ter no máximo 64 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números'),
  instance_token: z
    .string()
    .max(128, 'Token deve ter no máximo 128 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números')
    .optional()
    .or(z.literal('')),
  client_token: z
    .string()
    .max(128, 'Client Token deve ter no máximo 128 caracteres')
    .regex(ZAPI_ALPHANUMERIC_REGEX, 'Apenas letras e números')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schemaCreate>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se definido, estamos editando. Se null, estamos criando. */
  account: ZapiAccount | null;
  isLoading: boolean;
  onSubmit: (values: FormValues & { recursos_config?: RecursosConfig }) => void;
  /** T51: callback para salvar o horário de atendimento. */
  onSaveBusinessHours?: (config: BusinessHoursConfig | null) => void;
}

// ─── FeatureSwitch ────────────────────────────────────────────────────────────

interface FeatureSwitchProps {
  code: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function FeatureSwitch({ code, label, checked, onCheckedChange }: FeatureSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Label htmlFor={`feature-${code}`} className="flex-1 cursor-pointer text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={`feature-${code}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  isLoading,
  onSubmit,
  onSaveBusinessHours,
}: AccountFormDialogProps) {
  const isEditing = account !== null;
  const schema = isEditing ? schemaEdit : schemaCreate;

  // Estado local dos feature flags (somente em modo edição)
  const [recursosConfig, setRecursosConfig] = useState<RecursosConfig>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      instance_id: '',
      instance_token: '',
      client_token: '',
      panel_password: '',
    },
  });

  // Preenche form e flags ao abrir em modo edição
  useEffect(() => {
    if (open) {
      if (account) {
        reset({
          name: account.name,
          instance_id: account.instance_id,
          instance_token: '',
          client_token: '',
        });
        // Carrega a config atual da conta
        setRecursosConfig(account.recursos_config ?? {});
      } else {
        reset({
          name: '',
          instance_id: '',
          instance_token: '',
          client_token: '',
          panel_password: '',
        });
        setRecursosConfig({});
      }
    }
  }, [open, account, reset]);

  function toggleFeature(code: string, enabled: boolean) {
    setRecursosConfig((prev) => ({ ...prev, [code]: enabled }));
  }

  function handleFormSubmit(values: FormValues) {
    onSubmit({ ...values, ...(isEditing ? { recursos_config: recursosConfig } : {}) });
  }

  // Aba de conexão (formulário existente)
  const connectionTab = (
    <div className="space-y-4 pt-4">
      {/* Warning de segurança — tokens em texto puro no MVP */}
      <Alert className="border-warning/40 bg-warning-soft text-warning-soft-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-xs">
          Por enquanto, tokens ficam armazenados em texto puro. A criptografia
          AES-256-GCM sera aplicada quando a Edge Function{' '}
          <code className="font-mono">zapi-encrypt</code> estiver implementada.
          Use apenas instancias de TESTE ate la.
        </AlertDescription>
      </Alert>

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome da conta</Label>
        <Input
          id="name"
          placeholder="Ex: Conta Principal, Atendimento..."
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Instance ID */}
      <div className="space-y-1.5">
        <Label htmlFor="instance_id">Instance ID</Label>
        <Input
          id="instance_id"
          placeholder="ID da instancia Z-API"
          className="font-mono text-sm"
          {...register('instance_id')}
        />
        {errors.instance_id && (
          <p className="text-xs text-destructive">{errors.instance_id.message}</p>
        )}
      </div>

      {/* Instance Token */}
      <div className="space-y-1.5">
        <Label htmlFor="instance_token">
          Instance Token
          {isEditing && (
            <span className="ml-1.5 text-xs text-muted-foreground">(deixe em branco para manter)</span>
          )}
        </Label>
        <Input
          id="instance_token"
          type="password"
          autoComplete="off"
          placeholder={isEditing ? '••••••••' : 'Token da instancia Z-API'}
          className="font-mono text-sm"
          {...register('instance_token')}
        />
        {errors.instance_token && (
          <p className="text-xs text-destructive">{errors.instance_token.message}</p>
        )}
      </div>

      {/* Client Token */}
      <div className="space-y-1.5">
        <Label htmlFor="client_token">
          Client Token
          {isEditing && (
            <span className="ml-1.5 text-xs text-muted-foreground">(deixe em branco para manter)</span>
          )}
        </Label>
        <Input
          id="client_token"
          type="password"
          autoComplete="off"
          placeholder={isEditing ? '••••••••' : 'Client Token Z-API'}
          className="font-mono text-sm"
          {...register('client_token')}
        />
        {errors.client_token && (
          <p className="text-xs text-destructive">{errors.client_token.message}</p>
        )}
      </div>

      {/* Senha extra do painel — somente na criação */}
      {!isEditing && (
        <div className="space-y-1.5">
          <Label htmlFor="panel_password">
            Senha do painel{' '}
            <span className="text-xs text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="panel_password"
            type="password"
            autoComplete="new-password"
            placeholder="Senha para acessar as conversas (mínimo 8 caracteres)"
            {...register('panel_password')}
          />
          {errors.panel_password && (
            <p className="text-xs text-destructive">{errors.panel_password.message}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Senha armazenada em texto puro temporariamente. Bcrypt hash sera
            aplicado via Edge Function em sessao futura. Use senha de TESTE.
          </p>
        </div>
      )}
    </div>
  );

  // Aba de recursos (somente em modo edição)
  const resourcesTab = (
    <div className="space-y-5 pt-4">
      {/* Inteligência Artificial */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Inteligência Artificial</h4>
        </div>
        <Alert className="border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
            Recursos de IA consomem a integração de IA do projeto e podem ter
            custo por uso. Habilite apenas quando necessário.
          </AlertDescription>
        </Alert>
        {FEATURES_CATALOG.ia.map((f) => (
          <FeatureSwitch
            key={f.code}
            code={f.code}
            label={f.label}
            checked={recursosConfig[f.code] === true}
            onCheckedChange={(checked) => toggleFeature(f.code, checked)}
          />
        ))}
      </div>

      {/* Automação e Alcance */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Automação e Alcance</h4>
        </div>
        {FEATURES_CATALOG.automacao.map((f) => (
          <FeatureSwitch
            key={f.code}
            code={f.code}
            label={f.label}
            checked={recursosConfig[f.code] === true}
            onCheckedChange={(checked) => toggleFeature(f.code, checked)}
          />
        ))}
      </div>

      {/* Engajamento e Gestão */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Engajamento e Gestão</h4>
        </div>
        {FEATURES_CATALOG.engajamento.map((f) => (
          <FeatureSwitch
            key={f.code}
            code={f.code}
            label={f.label}
            checked={recursosConfig[f.code] === true}
            onCheckedChange={(checked) => toggleFeature(f.code, checked)}
          />
        ))}
      </div>

      {/* CRM Político (Fase 6) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Vote className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">CRM Político</h4>
        </div>

        {/* c24 — Opt-in LGPD (default true — conformidade) */}
        <div className="mb-2">
          <Alert className="border-blue-400/40 bg-blue-50 dark:bg-blue-950/20 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
              Requerido para broadcast. Ativar registra consentimento dos eleitores (LGPD).
            </AlertDescription>
          </Alert>
          <FeatureSwitch
            code="c24"
            label="Consentimento LGPD (opt-in)"
            checked={recursosConfig['c24'] !== false}
            onCheckedChange={(checked) => toggleFeature('c24', checked)}
          />
        </div>

        {/* c21 — Bairro/zona eleitoral (default true — sem risco) */}
        <FeatureSwitch
          code="c21"
          label="Bairro e zona eleitoral no painel"
          checked={recursosConfig['c21'] !== false}
          onCheckedChange={(checked) => toggleFeature('c21', checked)}
        />

        <FeatureSwitch
          code="c18"
          label="Protocolo de demanda com retorno automático"
          checked={recursosConfig['c18'] === true}
          onCheckedChange={(checked) => toggleFeature('c18', checked)}
        />

        <FeatureSwitch
          code="c19"
          label="Lembrete de aniversário do eleitor"
          checked={recursosConfig['c19'] === true}
          onCheckedChange={(checked) => toggleFeature('c19', checked)}
        />

        <FeatureSwitch
          code="c20"
          label="Convite a eventos e RSVP"
          checked={recursosConfig['c20'] === true}
          onCheckedChange={(checked) => toggleFeature('c20', checked)}
        />

        <FeatureSwitch
          code="c22"
          label="Régua de relacionamento automática"
          checked={recursosConfig['c22'] === true}
          onCheckedChange={(checked) => toggleFeature('c22', checked)}
        />

        <FeatureSwitch
          code="c23"
          label="Campanhas de pesquisa de opinião"
          checked={recursosConfig['c23'] === true}
          onCheckedChange={(checked) => toggleFeature('c23', checked)}
        />

        <FeatureSwitch
          code="c29"
          label="CSAT ao finalizar atendimento"
          checked={recursosConfig['c29'] === true}
          onCheckedChange={(checked) => toggleFeature('c29', checked)}
        />

        {/* c17 — Broadcast (risco de ban) */}
        <div className="mt-2">
          <Alert className="border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
              Broadcast usa Z-API não-oficial. Envio em excesso pode causar banimento do número.
              Use com responsabilidade.
            </AlertDescription>
          </Alert>
          <FeatureSwitch
            code="c17"
            label="Broadcast / Comunicados em massa"
            checked={recursosConfig['c17'] === true}
            onCheckedChange={(checked) => toggleFeature('c17', checked)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar conta Z-API' : 'Nova conta Z-API'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da instância Z-API. Deixe os campos de token em branco para manter os valores atuais.'
              : 'Configure uma nova instância Z-API para enviar e receber mensagens.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-1">
            {isEditing ? (
              <Tabs defaultValue="conexao">
                <TabsList className="w-full">
                  <TabsTrigger value="conexao" className="flex-1">Conexão</TabsTrigger>
                  <TabsTrigger value="recursos" className="flex-1">Recursos</TabsTrigger>
                  <TabsTrigger value="horario" className="flex-1 gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Horário
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="conexao">
                  {connectionTab}
                </TabsContent>
                <TabsContent value="recursos">
                  {resourcesTab}
                </TabsContent>
                <TabsContent value="horario">
                  {account && onSaveBusinessHours ? (
                    <BusinessHoursTab
                      account={account}
                      isSaving={isLoading}
                      onSave={onSaveBusinessHours}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground pt-4 text-center">
                      Configuração de horário disponível somente ao editar uma conta.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              connectionTab
            )}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-border/50 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
