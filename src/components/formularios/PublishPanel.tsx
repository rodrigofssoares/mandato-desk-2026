// EM054 — Aba Pública do editor de formulários
import { useState } from 'react';
import { Link2, Copy, ShieldCheck, CalendarClock, FileText, PartyPopper, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useUpdateFormulario } from '@/hooks/useFormularios';
import { formatarDataLonga } from './formularioUtils';
import { AgradecimentoPanel } from './AgradecimentoPanel';
import type { Formulario } from '@/types/formularios';

interface PublishPanelProps {
  formulario: Formulario;
}

type PreviewEstado = 'formulario' | 'agradecimento' | 'encerrado';

function MiniPreview({
  formulario,
  estado,
}: {
  formulario: Formulario;
  estado: PreviewEstado;
}) {
  const cor = formulario.tema?.cor ?? 'hsl(var(--primary))';

  if (estado === 'agradecimento') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--success, 142 76% 36%))' }}
        >
          <span className="text-white text-3xl">✓</span>
        </div>
        <div>
          <h3 className="font-bold text-lg">{formulario.agradecimento?.titulo || 'Obrigado!'}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {formulario.agradecimento?.mensagem || 'Sua resposta foi registrada com sucesso.'}
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'encerrado') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Formulário encerrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            O prazo para participação terminou
            {formulario.encerra_em
              ? ` em ${formatarDataLonga(formulario.encerra_em)}`
              : ''}
            . Obrigado pelo interesse!
          </p>
        </div>
      </div>
    );
  }

  // Estado: formulário
  return (
    <div className="max-w-sm mx-auto">
      <div
        className="h-20 rounded-t-xl flex items-end p-3"
        style={{ backgroundColor: cor }}
      >
        <h3 className="text-white font-bold text-base">{formulario.titulo}</h3>
      </div>
      <div className="border border-t-0 rounded-b-xl p-4 bg-card space-y-3">
        {formulario.descricao && (
          <p className="text-xs text-muted-foreground">{formulario.descricao}</p>
        )}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome completo *</Label>
            <div className="mt-1 h-9 border rounded-lg bg-muted/40 px-3 flex items-center text-xs text-muted-foreground">
              Resposta de texto
            </div>
          </div>
          <div>
            <Label className="text-xs">WhatsApp *</Label>
            <div className="mt-1 h-9 border rounded-lg bg-muted/40 px-3 flex items-center text-xs text-muted-foreground">
              (00) 0 0000-0000
            </div>
          </div>
        </div>
        <Button className="w-full text-xs h-9" style={{ backgroundColor: cor }}>
          Enviar resposta
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          Dados tratados conforme a LGPD.
        </p>
      </div>
    </div>
  );
}

export function PublishPanel({ formulario }: PublishPanelProps) {
  const updateMutation = useUpdateFormulario();
  const [previewEstado, setPreviewEstado] = useState<PreviewEstado>('formulario');

  const linkPublico = `${window.location.origin}/f/${formulario.slug}`;

  async function copiarLink() {
    await navigator.clipboard.writeText(linkPublico);
    toast.success('Link copiado!');
  }

  function handleDateChange(campo: 'abre_em' | 'encerra_em', valor: string) {
    updateMutation.mutate({
      id: formulario.id,
      patch: { [campo]: valor || null },
    });
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkPublico)}`;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Banner de segurança */}
      <div className="flex items-start gap-3 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-sm">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-800 dark:text-emerald-400">Página pública isolada.</strong>
          <p className="text-muted-foreground text-xs mt-0.5">
            Sem sessão, sem leitura de contatos, sem acesso a outros formulários.
            Só grava o envio — RLS bloqueia qualquer SELECT.
          </p>
        </div>
      </div>

      {/* Link e QR */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Link público</h3>
        <div className="flex items-center gap-2 bg-muted/40 border rounded-lg px-3 py-2">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <code className="text-xs text-primary flex-1 truncate font-mono">{linkPublico}</code>
          {formulario.encerra_em && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-semibold whitespace-nowrap">
              Fecha {formatarDataLonga(formulario.encerra_em)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={copiarLink}
            aria-label="Copiar link do formulário"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        </div>

        {/* QR Code */}
        <div className="flex items-center gap-4">
          <img
            src={qrUrl}
            alt={`QR Code do formulário ${formulario.titulo}`}
            className="w-24 h-24 rounded-lg border"
            loading="lazy"
          />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">QR Code</p>
            <p>Compartilhe o QR Code para acesso rápido pelo celular.</p>
            <a
              href={qrUrl}
              download={`qr-${formulario.slug}.png`}
              className="text-primary underline mt-1 inline-block"
            >
              Baixar imagem
            </a>
          </div>
        </div>
      </div>

      <Separator />

      {/* Datas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Janela de atividade
        </h3>
        <p className="text-xs text-muted-foreground">
          Quando o prazo termina, o link fecha automaticamente e exibe "formulário encerrado"
          — sem precisar desativar manualmente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="abre_em" className="text-xs">Abre em</Label>
            <Input
              id="abre_em"
              type="datetime-local"
              className="text-xs"
              defaultValue={formulario.abre_em?.slice(0, 16) ?? ''}
              onBlur={(e) => handleDateChange('abre_em', e.target.value)}
              aria-label="Data e hora de abertura do formulário"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="encerra_em" className="text-xs">Encerra em</Label>
            <Input
              id="encerra_em"
              type="datetime-local"
              className="text-xs"
              defaultValue={formulario.encerra_em?.slice(0, 16) ?? ''}
              onBlur={(e) => handleDateChange('encerra_em', e.target.value)}
              aria-label="Data e hora de encerramento do formulário"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Preview dos 3 estados */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Prévia dos estados</h3>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: 'formulario', label: 'Formulário', Icon: FileText },
              { id: 'agradecimento', label: 'Agradecimento', Icon: PartyPopper },
              { id: 'encerrado', label: 'Encerrado', Icon: Lock },
            ] as const
          ).map(({ id, label, Icon }) => (
            <Button
              key={id}
              variant={previewEstado === id ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setPreviewEstado(id)}
              aria-pressed={previewEstado === id}
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {label}
            </Button>
          ))}
        </div>

        <div className="border rounded-xl p-4 bg-gradient-to-br from-muted/30 to-background">
          <MiniPreview formulario={formulario} estado={previewEstado} />
        </div>
      </div>

      <Separator />

      {/* Tela de agradecimento */}
      <AgradecimentoPanel formulario={formulario} />

      <Separator />

      {/* Segurança */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Segurança (informativo)</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          {[
            { label: 'Rate limit', desc: 'Antiflood no link público — máx. 5 envios por IP / 10 min.' },
            { label: 'Captcha', desc: 'Honeypot invisível + validação comportamental.' },
            { label: 'Deduplicação', desc: `Configurada na aba Mapeamento (campo: ${formulario.dedup_campo}, ação: ${formulario.dedup_acao}).` },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2 p-2.5 border rounded-lg bg-card">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">{item.label}</strong>
                <p className="text-[11px] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
