// Componente: PanelLockScreen
//
// Tela de cadeado exibida na aba Conversas quando o usuário seleciona uma
// conta Z-API e ainda não validou a senha daquela conta.
//
// Exibe:
//   - Campo de senha (input type=password, submit via Enter ou botão)
//   - Feedback inline de erro (senha errada, rate-limit)
//   - Countdown de rate-limit (atualiza a cada segundo)
//   - Spinner durante validação
//
// Admin nunca chega aqui — useZapiPanelSession retorna isUnlocked=true pra admin.
//
// Reference: RAQ-MAND-EM078 — T3 (frontend cadeado)

import { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { ZapiPanelSessionState } from '@/hooks/useZapiPanelSession';

interface PanelLockScreenProps {
  accountName: string;
  session: ZapiPanelSessionState;
}

export function PanelLockScreen({ accountName, session }: PanelLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Foca o input ao montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown de rate-limit
  useEffect(() => {
    if (session.rateLimitRetryAfter > 0) {
      setCountdown(session.rateLimitRetryAfter);
    }
  }, [session.rateLimitRetryAfter]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || session.loading || countdown > 0) return;

    const success = await session.unlock(password);
    if (success) {
      toast.success(`Acesso liberado — ${accountName}`);
      setPassword('');
    } else {
      // Limpa a senha após erro para segurança
      setPassword('');
      inputRef.current?.focus();
    }
  }

  const isRateLimited = countdown > 0;
  const canSubmit = !session.loading && !isRateLimited && password.trim().length > 0;

  function formatCountdown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}min ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        {/* Ícone */}
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold mb-1">Acesso protegido</h2>
          <p className="text-sm text-muted-foreground">
            Digite a senha para acessar as conversas de{' '}
            <strong className="text-foreground">{accountName}</strong>.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="panel-password">Senha do painel</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="panel-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                autoComplete="current-password"
                disabled={session.loading || isRateLimited}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye className="h-4 w-4" />
                }
              </button>
            </div>
          </div>

          {/* Erro inline */}
          {session.error && !isRateLimited && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <ShieldOff className="h-3.5 w-3.5 shrink-0" />
              {session.error}
            </p>
          )}

          {/* Rate-limit countdown */}
          {isRateLimited && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-center">
              <p className="text-xs text-warning font-medium">
                Muitas tentativas incorretas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tente novamente em{' '}
                <span className="font-mono font-semibold text-foreground">
                  {formatCountdown(countdown)}
                </span>
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
          >
            {session.loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : isRateLimited ? (
              `Aguarde ${formatCountdown(countdown)}`
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Acessar conversas
              </>
            )}
          </Button>
        </form>

        {/* Nota de segurança */}
        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Acesso liberado por 8 horas após validação. Recarregar a página solicita a senha novamente.
        </p>
      </div>
    </div>
  );
}
