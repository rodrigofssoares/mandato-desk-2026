// EM054 — Página pública do formulário (rota /f/:slug)
// ISOLADA: sem auth, sem AppLayout, sem usePermissions.
// Leitura → supabase.rpc('formulario_obter_publico', { _slug })
// Escrita → supabase.functions.invoke('formularios-public-submit', { body })

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CampoPublicoRender } from '@/components/formularios/CampoPublicoRender';
import {
  TelaAgradecimento,
  TelaEncerrado,
  TelaNaoIniciado,
  TelaLimite,
  TelaNotFound,
  TelaBloqueado,
} from '@/components/formularios/TelaResultado';
import {
  FIELD_TYPES_DECORATIVOS,
  type RetornoPublico,
  type FormularioPublico,
  type TemaFormulario,
  type AgradecimentoFormulario,
  type CampoPublico,
} from '@/types/formularios';

// ── Turnstile (captcha Cloudflare — opcional) ─────────────────────────────

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
        }
      ) => string;
      reset: (id: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

// ── Helpers de tema ───────────────────────────────────────────────────────

function raioParaCss(cantos: TemaFormulario['cantos']): string {
  if (cantos === 'reto') return '0px';
  if (cantos === 'pilula') return '24px';
  return '12px'; // arredondado (default)
}

function fundoParaEstilo(fundo: TemaFormulario['fundo'], cor: string): React.CSSProperties {
  if (fundo === 'branco') return { backgroundColor: '#ffffff' };
  if (fundo === 'degrade')
    return { background: `linear-gradient(160deg, ${cor}18 0%, #f5f5f5 100%)` };
  return { backgroundColor: '#FAF6F0' }; // bege
}

// ── Validação client-side ─────────────────────────────────────────────────

function validarCampo(campo: CampoPublico, valor: string | string[]): string | null {
  if (FIELD_TYPES_DECORATIVOS.includes(campo.tipo)) return null;

  const valorStr = typeof valor === 'string' ? valor.trim() : '';
  const valorArr = Array.isArray(valor) ? valor : [];

  if (campo.obrigatorio) {
    if (campo.tipo === 'checkboxes' && valorArr.length === 0)
      return 'Selecione ao menos uma opção.';
    if (campo.tipo !== 'checkboxes' && !valorStr)
      return 'Este campo é obrigatório.';
  }

  if (!valorStr && campo.tipo !== 'checkboxes') return null;

  if (campo.min_chars && valorStr.length < campo.min_chars)
    return `Mínimo de ${campo.min_chars} caracteres.`;
  if (campo.max_chars && valorStr.length > campo.max_chars)
    return `Máximo de ${campo.max_chars} caracteres.`;

  if (campo.validar_formato) {
    if (campo.tipo === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorStr))
        return 'Informe um e-mail válido.';
    }
    if (campo.tipo === 'cpf') {
      const d = valorStr.replace(/\D/g, '');
      if (d.length !== 11) return 'CPF inválido — informe 11 dígitos.';
      if (/^(\d)\1{10}$/.test(d)) return 'CPF inválido.';
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += parseInt(d[i]) * (10 - i);
      let r = (soma * 10) % 11;
      if (r === 10 || r === 11) r = 0;
      if (r !== parseInt(d[9])) return 'CPF inválido.';
      soma = 0;
      for (let i = 0; i < 10; i++) soma += parseInt(d[i]) * (11 - i);
      r = (soma * 10) % 11;
      if (r === 10 || r === 11) r = 0;
      if (r !== parseInt(d[10])) return 'CPF inválido.';
    }
    if (campo.tipo === 'telefone') {
      const d = valorStr.replace(/\D/g, '');
      if (d.length < 10 || d.length > 11)
        return 'Informe um telefone válido com DDD.';
    }
  }

  return null;
}

// ── Skeleton de carregamento ──────────────────────────────────────────────

function FormularioSkeleton() {
  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={{ backgroundColor: '#FAF6F0' }}
    >
      <div
        className="w-full max-w-lg space-y-0"
        aria-busy="true"
        aria-label="Carregando formulário"
      >
        <Skeleton className="h-32 w-full rounded-t-xl rounded-b-none" />
        <div className="space-y-4 p-6 bg-white rounded-b-xl border border-t-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full mt-2" />
        </div>
      </div>
    </div>
  );
}

// ── Widget Turnstile ──────────────────────────────────────────────────────

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire: () => void;
}

function TurnstileWidget({ siteKey, onToken, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const mount = useCallback(() => {
    if (!containerRef.current || mountedRef.current) return;
    if (!window.turnstile) return;
    mountedRef.current = true;
    window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      'expired-callback': onExpire,
    });
  }, [siteKey, onToken, onExpire]);

  useEffect(() => {
    if (window.turnstile) {
      mount();
    } else {
      window.onTurnstileLoad = mount;
      if (!document.querySelector('script[data-turnstile]')) {
        const s = document.createElement('script');
        s.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
        s.defer = true;
        s.setAttribute('data-turnstile', '1');
        document.head.appendChild(s);
      }
    }
  }, [mount]);

  return <div ref={containerRef} className="mt-2" />;
}

// ── Capa do formulário ─────────────────────────────────────────────────────

interface CapaProps {
  titulo: string;
  descricao: string | null;
  capaUrl: string | null;
  cor: string;
  raio: string;
}

function Capa({ titulo, descricao, capaUrl, cor, raio }: CapaProps) {
  return (
    <>
      <div
        className="relative overflow-hidden flex items-end p-5"
        style={{
          borderRadius: `${raio} ${raio} 0 0`,
          minHeight: 120,
          background: capaUrl
            ? undefined
            : `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`,
        }}
      >
        {capaUrl && (
          <img
            src={capaUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {capaUrl && (
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
        )}
        <h1
          className="relative z-10 text-xl font-bold text-white leading-tight"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        >
          {titulo}
        </h1>
      </div>
      {descricao && (
        <div className="px-6 pt-4 pb-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
        </div>
      )}
    </>
  );
}

// ── Corpo do formulário ────────────────────────────────────────────────────

interface FormularioCorpoProps {
  formulario: FormularioPublico;
  slug: string;
  onSucesso: () => void;
  /** EM087: chamado quando o envio é bloqueado por duplicidade (já respondeu). */
  onBloqueado: (mensagem: string | null) => void;
}

/**
 * Lê o corpo JSON de uma resposta de erro do functions.invoke.
 * Em não-2xx, supabase-js entrega `data` null e o corpo fica em `error.context`
 * (um Response). Tenta `data` primeiro, depois clona o Response e faz .json().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerCorpoErro(error: any, data: any): Promise<Record<string, unknown> | null> {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
      return (await ctx.clone().json()) as Record<string, unknown>;
    }
  } catch {
    /* corpo não-JSON ou já consumido — ignora */
  }
  return null;
}

type ValoresMap = Record<string, string | string[]>;
type ErrosMap = Record<string, string | null>;

function FormularioCorpo({ formulario, slug, onSucesso, onBloqueado }: FormularioCorpoProps) {
  const { tema, campos } = formulario;
  const cor = tema.cor || '#7B1E2E';
  const raio = raioParaCss(tema.cantos);

  // Inicializa valores por tipo de campo
  const [valores, setValores] = useState<ValoresMap>(() => {
    const v: ValoresMap = {};
    campos.forEach((c) => {
      if (c.tipo === 'checkboxes') v[c.id] = [];
      else if (!FIELD_TYPES_DECORATIVOS.includes(c.tipo)) v[c.id] = '';
    });
    return v;
  });

  const [erros, setErros] = useState<ErrosMap>({});
  const [enviando, setEnviando] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const atualizarCampo = useCallback((id: string, valor: string | string[]) => {
    setValores((prev) => ({ ...prev, [id]: valor }));
    setErros((prev) => ({ ...prev, [id]: null }));
  }, []);

  const validarTudo = useCallback((): ErrosMap | null => {
    const novosErros: ErrosMap = {};
    let valido = true;
    campos.forEach((campo) => {
      if (FIELD_TYPES_DECORATIVOS.includes(campo.tipo)) return;
      const err = validarCampo(campo, valores[campo.id] ?? '');
      novosErros[campo.id] = err;
      if (err) valido = false;
    });
    setErros(novosErros);
    return valido ? null : novosErros;
  }, [campos, valores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Usa o retorno direto (não o estado `erros`, que é atualizado de forma
    // assíncrona pelo setErros e estaria defasado neste mesmo tick).
    const errosNovos = validarTudo();
    if (errosNovos) {
      const primeiro = campos.find(
        (c) => !FIELD_TYPES_DECORATIVOS.includes(c.tipo) && errosNovos[c.id]
      );
      if (primeiro) {
        document.getElementById(`campo-${primeiro.id}`)?.focus();
      }
      return;
    }

    if (TURNSTILE_KEY && !captchaToken) {
      toast.error('Complete a verificação de segurança antes de enviar.');
      return;
    }

    // Monta payload excluindo campos decorativos
    const dados: Record<string, string | string[]> = {};
    campos.forEach((campo) => {
      if (FIELD_TYPES_DECORATIVOS.includes(campo.tipo)) return;
      dados[campo.id] = valores[campo.id] ?? '';
    });

    setEnviando(true);
    try {
      const body: Record<string, unknown> = { slug, dados };
      if (captchaToken) body.captchaToken = captchaToken;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, data } = await (supabase as any).functions.invoke(
        'formularios-public-submit',
        { body },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status: number = (error as any)?.context?.status ?? (data as any)?.status ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isOk = !error && (data as any)?.ok === true;

      if (!isOk) {
        if (status === 429) {
          toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
          return;
        }
        if (status === 410) {
          toast.error('Este formulário já foi encerrado.');
          return;
        }
        if (status === 409) {
          // EM087: 409 pode ser limite_atingido OU ja_respondeu (bloqueio por duplicidade).
          // Distingue pelo campo `error` no corpo da resposta.
          const corpo = await lerCorpoErro(error, data);
          if (corpo?.error === 'ja_respondeu') {
            const msg = typeof corpo.mensagem === 'string' ? corpo.mensagem : null;
            onBloqueado(msg);
            return;
          }
          toast.error('O limite de respostas foi atingido.');
          return;
        }
        if (status === 425) {
          toast.error('Este formulário ainda não está disponível.');
          return;
        }
        if (status === 403) {
          toast.error('Verificação de segurança falhou. Recarregue a página e tente novamente.');
          return;
        }
        const msg =
          (error as { message?: string })?.message ?? 'Erro ao enviar. Tente novamente.';
        toast.error(msg);
        return;
      }

      onSucesso();
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // Renderiza campos respeitando layout de 50% em grid
  const renderCampos = () => {
    const elementos: React.ReactNode[] = [];
    let i = 0;

    const pode50 = (c: CampoPublico) =>
      c.largura === '50' &&
      c.tipo !== 'secao' &&
      c.tipo !== 'imagem' &&
      c.tipo !== 'paragrafo' &&
      c.tipo !== 'escolha_unica' &&
      c.tipo !== 'checkboxes';

    while (i < campos.length) {
      const campo = campos[i];
      const proximo = campos[i + 1];

      if (pode50(campo) && proximo && pode50(proximo)) {
        elementos.push(
          <div key={`row-${campo.id}`} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoPublicoRender
              campo={campo}
              valor={valores[campo.id] ?? ''}
              erro={erros[campo.id] ?? null}
              corPrimaria={cor}
              raio={raio}
              onChange={(v) => atualizarCampo(campo.id, v)}
            />
            <CampoPublicoRender
              campo={proximo}
              valor={valores[proximo.id] ?? ''}
              erro={erros[proximo.id] ?? null}
              corPrimaria={cor}
              raio={raio}
              onChange={(v) => atualizarCampo(proximo.id, v)}
            />
          </div>
        );
        i += 2;
      } else {
        elementos.push(
          <CampoPublicoRender
            key={campo.id}
            campo={campo}
            valor={valores[campo.id] ?? ''}
            erro={erros[campo.id] ?? null}
            corPrimaria={cor}
            raio={raio}
            onChange={(v) => atualizarCampo(campo.id, v)}
          />
        );
        i += 1;
      }
    }

    return elementos;
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        {renderCampos()}

        {TURNSTILE_KEY && (
          <TurnstileWidget
            siteKey={TURNSTILE_KEY}
            onToken={setCaptchaToken}
            onExpire={handleCaptchaExpire}
          />
        )}

        <Button
          type="submit"
          disabled={enviando}
          className="w-full py-3 text-base font-semibold flex items-center justify-center gap-2"
          style={{ backgroundColor: cor, borderColor: cor, borderRadius: raio, color: '#fff' }}
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar resposta
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-1">
          Dados tratados conforme a{' '}
          <abbr title="Lei Geral de Proteção de Dados">LGPD</abbr>.
          {tema.mostrar_logo && <span className="ml-1 font-medium">· Mandato Desk</span>}
        </p>
      </div>
    </form>
  );
}

// ── Wrappers de layout standalone ─────────────────────────────────────────

function PaginaShell({
  children,
  fundoStyle,
}: {
  children: React.ReactNode;
  fundoStyle: React.CSSProperties;
}) {
  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={fundoStyle}
    >
      {children}
    </div>
  );
}

function CardShell({ children, raio }: { children: React.ReactNode; raio: string }) {
  return (
    <div
      className="w-full max-w-lg bg-card border shadow-md"
      style={{ borderRadius: raio }}
    >
      {children}
    </div>
  );
}

// ── Estados de tela ───────────────────────────────────────────────────────

type EstadoTela =
  | 'carregando'
  | 'formulario'
  | 'sucesso'
  | 'encerrado'
  | 'nao_iniciado'
  | 'limite_atingido'
  | 'ja_respondeu'
  | 'nao_encontrado';

// ── Página pública ─────────────────────────────────────────────────────────

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();

  const [tela, setTela] = useState<EstadoTela>('carregando');
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);
  const [agradecimento, setAgradecimento] = useState<AgradecimentoFormulario | null>(null);
  const [tituloEncerrado, setTituloEncerrado] = useState<string | undefined>();
  const [abreEm, setAbreEm] = useState<string | undefined>();
  // EM087: mensagem mostrada na tela de bloqueio por duplicidade.
  const [mensagemBloqueio, setMensagemBloqueio] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setTela('nao_encontrado');
      return;
    }

    let cancelado = false;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc(
          'formulario_obter_publico',
          { _slug: slug }
        );

        if (cancelado) return;
        if (error) {
          setTela('nao_encontrado');
          return;
        }

        const retorno = data as RetornoPublico;

        if ('erro' in retorno) {
          switch (retorno.erro) {
            case 'encerrado':
              setTituloEncerrado(retorno.titulo);
              setTela('encerrado');
              break;
            case 'nao_iniciado':
              setAbreEm(retorno.abre_em);
              setTela('nao_iniciado');
              break;
            case 'limite_atingido':
              setTela('limite_atingido');
              break;
            default:
              setTela('nao_encontrado');
          }
        } else {
          const f = retorno as FormularioPublico;
          setFormulario(f);
          setAgradecimento(f.agradecimento);
          setTela('formulario');
        }
      } catch {
        if (!cancelado) setTela('nao_encontrado');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [slug]);

  // Parâmetros de tema derivados (têm fallbacks para telas de resultado sem formulário)
  const cor = formulario?.tema?.cor ?? '#7B1E2E';
  const raio = raioParaCss(formulario?.tema?.cantos ?? 'arredondado');
  const fundoStyle = fundoParaEstilo(formulario?.tema?.fundo ?? 'bege', cor);

  // ── Carregando ────────────────────────────────────────────────────────
  if (tela === 'carregando') {
    return <FormularioSkeleton />;
  }

  // ── Telas de estado sem formulário ────────────────────────────────────
  if (tela === 'encerrado') {
    return (
      <PaginaShell fundoStyle={fundoStyle}>
        <CardShell raio={raio}>
          <TelaEncerrado titulo={tituloEncerrado} corPrimaria={cor} raio={raio} />
        </CardShell>
      </PaginaShell>
    );
  }

  if (tela === 'nao_iniciado') {
    return (
      <PaginaShell fundoStyle={fundoStyle}>
        <CardShell raio={raio}>
          <TelaNaoIniciado abreEm={abreEm} corPrimaria={cor} raio={raio} />
        </CardShell>
      </PaginaShell>
    );
  }

  if (tela === 'limite_atingido') {
    return (
      <PaginaShell fundoStyle={fundoStyle}>
        <CardShell raio={raio}>
          <TelaLimite corPrimaria={cor} raio={raio} />
        </CardShell>
      </PaginaShell>
    );
  }

  if (tela === 'ja_respondeu') {
    return (
      <PaginaShell fundoStyle={fundoStyle}>
        <CardShell raio={raio}>
          <TelaBloqueado mensagem={mensagemBloqueio} corPrimaria={cor} raio={raio} />
        </CardShell>
      </PaginaShell>
    );
  }

  if (tela === 'nao_encontrado') {
    return (
      <PaginaShell fundoStyle={{ backgroundColor: '#FAF6F0' }}>
        <CardShell raio="12px">
          <TelaNotFound corPrimaria="#7B1E2E" raio="12px" />
        </CardShell>
      </PaginaShell>
    );
  }

  // ── Sucesso ───────────────────────────────────────────────────────────
  if (tela === 'sucesso') {
    return (
      <PaginaShell fundoStyle={fundoStyle}>
        <CardShell raio={raio}>
          <TelaAgradecimento
            agradecimento={
              agradecimento ?? {
                titulo: 'Obrigado pela sua participação!',
                mensagem: 'Sua resposta foi registrada com sucesso.',
              }
            }
            corPrimaria={cor}
            raio={raio}
          />
          {formulario?.tema?.mostrar_logo && (
            <p className="text-center text-xs text-muted-foreground pb-4">Mandato Desk</p>
          )}
        </CardShell>
      </PaginaShell>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────
  if (!formulario) return null;

  return (
    <PaginaShell fundoStyle={fundoStyle}>
      <div
        className="w-full max-w-lg overflow-hidden border bg-card shadow-md"
        style={{ borderRadius: raio }}
        role="main"
        aria-label={formulario.titulo}
      >
        <Capa
          titulo={formulario.titulo}
          descricao={formulario.descricao}
          capaUrl={formulario.capa_url}
          cor={cor}
          raio={raio}
        />
        <div className="px-6 py-5">
          <FormularioCorpo
            formulario={formulario}
            slug={slug!}
            onSucesso={() => setTela('sucesso')}
            onBloqueado={(msg) => {
              setMensagemBloqueio(msg);
              setTela('ja_respondeu');
            }}
          />
        </div>
      </div>
    </PaginaShell>
  );
}
