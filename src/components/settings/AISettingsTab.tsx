import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sparkles, Loader2, ShieldAlert, AlertTriangle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useAISettings,
  useUpdateAISettings,
  type AIProvider,
  type AIFeatures,
  type AISettingsUpdate,
} from '@/hooks/useAISettings';
import { testApiKey } from '@/lib/ai/testApiKey';

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
];

const MODELOS: Record<AIProvider, string[]> = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'o3'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

const FEATURE_OPTIONS: { key: keyof AIFeatures; label: string; description: string }[] = [
  {
    key: 'resumo_demandas',
    label: 'Resumo automático de demandas',
    description: 'Gera um resumo curto da demanda assim que ela é criada.',
  },
  {
    key: 'sugestao_acoes',
    label: 'Sugestão de próximas ações em contatos',
    description: 'Sugere o próximo passo para cada contato com base no histórico.',
  },
  {
    key: 'analise_risco',
    label: 'Análise de risco de eleitores',
    description: 'Classifica o risco de evasão ou desengajamento dos contatos.',
  },
];

const DEFAULT_FEATURES: AIFeatures = {
  resumo_demandas: false,
  sugestao_acoes: false,
  analise_risco: false,
};

export function AISettingsTab() {
  const { isAdmin } = useUserRole();
  const { data: settings, isLoading } = useAISettings();
  const updateMutation = useUpdateAISettings();

  // Estado local controlado
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [model, setModel] = useState<string>(MODELOS.anthropic[0]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [features, setFeatures] = useState<AIFeatures>(DEFAULT_FEATURES);
  const [testing, setTesting] = useState(false);

  // Hidrata o estado local quando settings carrega/atualiza
  useEffect(() => {
    if (!settings) return;
    const nextProvider = (settings.provider ?? 'anthropic') as AIProvider;
    setProvider(nextProvider);
    setModel(settings.model ?? MODELOS[nextProvider][0]);
    setAiEnabled(settings.ai_enabled);
    setFeatures(settings.features);
    // apiKeyInput permanece vazio: chave nunca é hidratada (só mascarada)
  }, [settings]);

  // Quando o admin muda de provider, reseta o modelo para o primeiro disponível
  // (se o atual não pertence ao novo provider)
  useEffect(() => {
    if (!MODELOS[provider].includes(model)) {
      setModel(MODELOS[provider][0]);
    }
  }, [provider, model]);

  const handleToggleFeature = (key: keyof AIFeatures, checked: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: checked }));
  };

  const handleTest = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Cole a chave antes de testar');
      return;
    }
    setTesting(true);
    try {
      const result = await testApiKey({ provider, apiKey: apiKeyInput.trim() });
      if (result.ok === true) {
        toast.success('Chave válida — provider respondeu com sucesso');
      } else {
        toast.error(`Falha: ${result.error}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    const patch: AISettingsUpdate = {
      provider,
      model,
      ai_enabled: aiEnabled,
      features,
    };

    // Só inclui api_key se o admin digitou algo novo (input não vazio).
    // Vazio = manter chave existente.
    const trimmed = apiKeyInput.trim();
    if (trimmed.length > 0) {
      patch.api_key = trimmed;
    }

    try {
      await updateMutation.mutateAsync({ id: settings.id, patch });
      // Limpa o input para evitar reenviar a chave em saves seguintes
      setApiKeyInput('');
    } catch {
      // toast já disparado no hook
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Central de IA</h1>
        </div>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Apenas administradores podem visualizar e alterar a configuração de IA.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuração não encontrada</AlertTitle>
          <AlertDescription>
            A linha de configuração de IA não foi encontrada no banco. Verifique se a migration
            016 foi aplicada.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isSaving = updateMutation.isPending;
  const modelOptions = MODELOS[provider];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Central de IA</h1>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Como a chave é armazenada</AlertTitle>
        <AlertDescription>
          A chave API fica no banco de dados protegida por RLS — somente administradores ativos
          podem lê-la. As chamadas reais ao provedor de IA acontecem no servidor, nunca no
          navegador. Não compartilhe o acesso de admin com terceiros.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>Escolha o fornecedor do modelo de IA.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo</CardTitle>
          <CardDescription>Versão específica do modelo a usar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Chave API
          </CardTitle>
          <CardDescription>
            {settings.api_key_set
              ? `Chave atual: ${settings.api_key ?? '••••••••'} — deixe em branco para mantê-la.`
              : 'Nenhuma chave salva ainda. Cole a chave do provider escolhido.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ai-api-key" className="sr-only">
              Chave API
            </Label>
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              placeholder={settings.api_key_set ? 'Cole uma nova chave para substituir' : 'sk-...'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!apiKeyInput.trim() || testing}
            >
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Testar chave
            </Button>
            <p className="text-xs text-muted-foreground">
              Faz uma chamada de leitura ao endpoint de modelos do provider para validar a chave.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <Label htmlFor="ai-enabled" className="text-base font-medium">
              IA ativa na organização
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando desligada, nenhuma feature de IA é executada — independente das checkboxes
              abaixo.
            </p>
          </div>
          <Switch id="ai-enabled" checked={aiEnabled} onCheckedChange={setAiEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features disponíveis</CardTitle>
          <CardDescription>
            Selecione quais features de IA estarão disponíveis na aplicação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_OPTIONS.map((feature) => (
            <div key={feature.key} className="flex items-start gap-3">
              <Checkbox
                id={`ai-feature-${feature.key}`}
                checked={features[feature.key]}
                onCheckedChange={(checked) => handleToggleFeature(feature.key, checked === true)}
                disabled={!aiEnabled}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={`ai-feature-${feature.key}`}
                  className="text-sm font-medium leading-none"
                >
                  {feature.label}
                </Label>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground border-t pt-3">
            Nenhuma feature está conectada ao motor de IA ainda — esta tela é apenas configuração.
            A integração real será feita em uma futura iteração via Edge Function.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
