import { useState } from 'react';
import { Loader2, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAdminProviderCredentials } from '@/hooks/useProviderCredentials';
import {
  useUpsertProviderCredential,
  useTestProviderKey,
} from '@/hooks/useProviderCredentialsMutation';
import type { AIProviderName } from '@/hooks/useProviderCredentials';
import { cn } from '@/lib/utils';

// ============================================================================
// Config dos providers
// ============================================================================

interface ProviderConfig {
  id: AIProviderName;
  name: string;
  abbr: string;
  description: string;
  color: string;
  borderColor: string;
  placeholder: string;
  docsUrl: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    abbr: 'AI',
    description: 'GPT-4o, GPT-4o mini, o3',
    color: '#10A37F',
    borderColor: '#10A37F',
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    abbr: 'C',
    description: 'Claude Sonnet, Haiku, Opus',
    color: '#D77655',
    borderColor: '#D77655',
    placeholder: 'sk-ant-api03-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    abbr: 'OR',
    description: '200+ modelos de múltiplos provedores',
    color: 'hsl(351, 61%, 30%)',
    borderColor: 'hsl(351, 61%, 30%)',
    placeholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
];

// ============================================================================
// ProviderCard
// ============================================================================

interface ProviderCardProps {
  config: ProviderConfig;
  isConnected: boolean;
}

function ProviderCard({ config, isConnected }: ProviderCardProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const upsertMutation = useUpsertProviderCredential();
  const testMutation = useTestProviderKey();

  const handleTest = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error('Cole a chave antes de testar');
      return;
    }

    setIsTesting(true);
    try {
      await testMutation.mutateAsync({ provider: config.id, api_key: trimmed });
      // Teste passou: salva a chave
      await upsertMutation.mutateAsync({
        provider: config.id,
        api_key: trimmed,
        is_active: true,
      });
      setApiKey('');
      toast.success('Chave válida — provider respondeu');
    } catch {
      // toast já disparado no hook de teste
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error('Cole a chave antes de salvar');
      return;
    }
    await upsertMutation.mutateAsync({
      provider: config.id,
      api_key: trimmed,
      is_active: true,
    });
    setApiKey('');
  };

  const isPending = isTesting || upsertMutation.isPending;

  return (
    <div
      className={cn(
        'bg-card border-2 rounded-xl overflow-hidden transition-all duration-200',
        isConnected ? 'border-[var(--ck-color)]' : 'border-border'
      )}
      style={
        isConnected
          ? ({ '--ck-color': config.borderColor } as React.CSSProperties)
          : undefined
      }
    >
      {/* Header */}
      <div
        className={cn(
          'p-3.5 flex items-center gap-3 border-b border-border',
          isConnected ? 'text-white' : 'bg-muted'
        )}
        style={isConnected ? { backgroundColor: config.color } : undefined}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{
            backgroundColor: isConnected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
          }}
        >
          {config.abbr}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{config.name}</p>
          <p className={cn('text-xs mt-0.5', isConnected ? 'opacity-80' : 'text-muted-foreground')}>
            {config.description}
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider',
            isConnected
              ? 'bg-white/20 text-white'
              : 'bg-muted-foreground/15 text-muted-foreground'
          )}
        >
          {isConnected ? (
            <><CheckCircle2 className="h-3 w-3" /> Conectado</>
          ) : (
            <><Circle className="h-3 w-3" /> Não conectado</>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs font-semibold mb-1.5 block">Chave API</Label>
          <PasswordInput
            placeholder={isConnected ? '••••••• (nova chave para substituir)' : config.placeholder}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            aria-label={`Chave API ${config.name}`}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending || !apiKey.trim()}
            aria-label={`Testar chave ${config.name}`}
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Testar
          </Button>

          {apiKey.trim() && !isTesting && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : null}
              Salvar sem testar
            </Button>
          )}

          <a
            href={config.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Gerar chave
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {config.id === 'openrouter' && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Acessa Llama, Gemini, DeepSeek, Mistral, Qwen e mais — uma chave só.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Componente principal
// ============================================================================

export function ConnectionsStep() {
  const { data: credentials = [], isLoading } = useAdminProviderCredentials();

  const isConnected = (provider: AIProviderName) =>
    credentials.find((c) => c.provider === provider)?.api_key_set ?? false;

  const hasAnyConnection = credentials.some((c) => c.api_key_set);

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-muted-foreground max-w-2xl leading-relaxed">
        Conecte uma ou mais contas para acessar os modelos. Você pode ativar múltiplos provedores —
        cada modelo usa a chave do seu próprio provedor.{' '}
        <strong>Recomendado:</strong> OpenRouter como ponto único — uma chave dá acesso a
        OpenAI + Anthropic + 200 outros modelos.
      </p>

      {!hasAnyConnection && !isLoading && (
        <Alert>
          <AlertDescription className="text-sm">
            Nenhum provider conectado. Configure ao menos uma chave API para usar o agente.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((cfg) => (
            <ProviderCard
              key={cfg.id}
              config={cfg}
              isConnected={isConnected(cfg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
