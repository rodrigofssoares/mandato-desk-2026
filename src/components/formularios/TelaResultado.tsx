// EM054 — Telas de resultado da página pública (sucesso, encerrado, limite, etc.)
import { CheckCircle2, Lock, Clock, AlertCircle, FileX2 } from 'lucide-react';
import { type AgradecimentoFormulario } from '@/types/formularios';

// ── Props ──────────────────────────────────────────────────────────────────

interface TelaBaseProps {
  corPrimaria: string;
  raio: string;
}

export interface TelaAgradecimentoProps extends TelaBaseProps {
  agradecimento: AgradecimentoFormulario;
}

export interface TelaEncerradoProps extends TelaBaseProps {
  titulo?: string;
}

export interface TelaNaoIniciadoProps extends TelaBaseProps {
  abreEm?: string;
}

export interface TelaLimiteProps extends TelaBaseProps {}

export interface TelaNotFoundProps extends TelaBaseProps {}

// ── Wrapper visual compartilhado ──────────────────────────────────────────

function TelaWrapper({
  children,
  raio,
}: {
  children: React.ReactNode;
  raio: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-16 gap-5"
      style={{ borderRadius: raio }}
    >
      {children}
    </div>
  );
}

// ── Tela de Agradecimento ────────────────────────────────────────────────

export function TelaAgradecimento({ agradecimento, corPrimaria, raio }: TelaAgradecimentoProps) {
  return (
    <TelaWrapper raio={raio}>
      <div
        className="flex items-center justify-center w-20 h-20 rounded-full"
        style={{ backgroundColor: '#22c55e' }}
      >
        <CheckCircle2 className="w-10 h-10 text-white" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold" style={{ color: corPrimaria }}>
          {agradecimento.titulo || 'Obrigado pela sua participação!'}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {agradecimento.mensagem || 'Sua resposta foi registrada com sucesso.'}
        </p>
      </div>
    </TelaWrapper>
  );
}

// ── Tela de Encerrado ────────────────────────────────────────────────────

export function TelaEncerrado({ titulo, raio }: TelaEncerradoProps) {
  return (
    <TelaWrapper raio={raio}>
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
        <Lock className="w-9 h-9 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold">
          {titulo ?? 'Formulário encerrado'}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          O prazo para participação terminou. Obrigado pelo interesse!
          Fique de olho nos próximos formulários do mandato.
        </p>
      </div>
    </TelaWrapper>
  );
}

// ── Tela Não iniciado ────────────────────────────────────────────────────

export function TelaNaoIniciado({ abreEm, raio }: TelaNaoIniciadoProps) {
  const dataFormatada = abreEm
    ? new Date(abreEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <TelaWrapper raio={raio}>
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100">
        <Clock className="w-9 h-9 text-amber-600" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold">Ainda não disponível</h2>
        {dataFormatada ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este formulário abrirá em <strong>{dataFormatada}</strong>.
            Volte nessa data!
          </p>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este formulário ainda não está disponível. Tente novamente mais tarde.
          </p>
        )}
      </div>
    </TelaWrapper>
  );
}

// ── Tela Limite atingido ─────────────────────────────────────────────────

export function TelaLimite({ raio }: TelaLimiteProps) {
  return (
    <TelaWrapper raio={raio}>
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-orange-100">
        <AlertCircle className="w-9 h-9 text-orange-600" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold">Limite de respostas atingido</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Este formulário já recebeu o número máximo de respostas permitidas.
          Obrigado pelo interesse!
        </p>
      </div>
    </TelaWrapper>
  );
}

// ── Tela 404 ─────────────────────────────────────────────────────────────

export function TelaNotFound({ raio }: TelaNotFoundProps) {
  return (
    <TelaWrapper raio={raio}>
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
        <FileX2 className="w-9 h-9 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold">Formulário não encontrado</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          O link que você acessou não existe ou foi removido.
          Verifique o endereço e tente novamente.
        </p>
      </div>
    </TelaWrapper>
  );
}
