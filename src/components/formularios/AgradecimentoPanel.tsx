// EM054-v2 — Seção "Tela de agradecimento" dentro da aba Pública
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Instagram, MessageCircle, Music2, Youtube, Facebook, Globe,
  Upload, Trash2, Plus, X, GripVertical, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useUpdateFormulario, useUploadFormularioMidia } from '@/hooks/useFormularios';
import {
  REDES_SOCIAIS,
  type Formulario,
  type AgradecimentoFormulario,
  type BotaoSocial,
  type RedeSocial,
} from '@/types/formularios';

// ── Mapa de ícones por nome ───────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Instagram,
  MessageCircle,
  Music2,
  Youtube,
  Facebook,
  Globe,
};

function RedeIcon({
  rede,
  className = 'h-4 w-4',
}: {
  rede: RedeSocial;
  className?: string;
}) {
  const icone = REDES_SOCIAIS[rede]?.icone ?? 'Globe';
  const Icon = ICON_MAP[icone] ?? Globe;
  return <Icon className={className} />;
}

// ── Validação de URL ──────────────────────────────────────────────────────────

function urlSegura(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgradecimentoPanelProps {
  formulario: Formulario;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function AgradecimentoPanel({ formulario }: AgradecimentoPanelProps) {
  const updateMutation = useUpdateFormulario();
  const uploadMidia = useUploadFormularioMidia();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Cópia local do agradecimento para digitação fluida (sem spinner a cada keystroke)
  const [local, setLocal] = useState<AgradecimentoFormulario>(() => ({
    titulo: '',
    mensagem: '',
    midia_url: null,
    midia_tipo: null,
    botoes: [],
    ...formulario.agradecimento,
  }));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza se o formulário recarregar de cima (ex.: invalidação de query)
  useEffect(() => {
    setLocal((prev) => {
      const base: AgradecimentoFormulario = {
        titulo: '',
        mensagem: '',
        midia_url: null,
        midia_tipo: null,
        botoes: [],
        ...formulario.agradecimento,
      };
      // Preserva botões editados localmente se ainda não foram salvos
      base.botoes = formulario.agradecimento?.botoes ?? prev.botoes;
      return base;
    });
  // Só re-sync quando o formulário mudar vindo do servidor (id estável)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulario.id]);

  const salvar = useCallback(
    (patch: AgradecimentoFormulario) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateMutation.mutate({
          id: formulario.id,
          patch: { agradecimento: patch },
        });
      }, 600);
    },
    [formulario.id, updateMutation]
  );

  function aplicar(patch: Partial<AgradecimentoFormulario>) {
    const novo = { ...local, ...patch };
    setLocal(novo);
    salvar(novo);
  }

  // ── Upload de mídia ──────────────────────────────────────────────────────────

  async function handleUploadMidia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMidia.mutateAsync({ formId: formulario.id, file });
      aplicar({ midia_url: result.url, midia_tipo: result.kind });
    } catch {
      // toast já disparado pelo hook
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removerMidia() {
    aplicar({ midia_url: null, midia_tipo: null });
  }

  // ── Botões sociais ───────────────────────────────────────────────────────────

  function adicionarBotao(rede: RedeSocial) {
    const preset = REDES_SOCIAIS[rede];
    const novosBotoes: BotaoSocial[] = [
      ...(local.botoes ?? []),
      { rede, label: preset.label, url: '' },
    ];
    aplicar({ botoes: novosBotoes });
  }

  function editarBotao(index: number, patch: Partial<BotaoSocial>) {
    const novosBotoes = (local.botoes ?? []).map((b, i) =>
      i === index ? { ...b, ...patch } : b
    );
    aplicar({ botoes: novosBotoes });
  }

  function removerBotao(index: number) {
    const novosBotoes = (local.botoes ?? []).filter((_, i) => i !== index);
    aplicar({ botoes: novosBotoes });
  }

  // Move botão para cima/baixo
  function moverBotao(index: number, direcao: -1 | 1) {
    const arr = [...(local.botoes ?? [])];
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= arr.length) return;
    [arr[index], arr[alvo]] = [arr[alvo], arr[index]];
    aplicar({ botoes: arr });
  }

  const botoes = local.botoes ?? [];
  const redesJaAdicionadas = new Set(botoes.map((b) => b.rede));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Tela de agradecimento</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Aparece após o envio do formulário. Personalize título, mensagem e links de redes sociais.
        </p>
      </div>

      {/* Título e mensagem */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="agr-titulo" className="text-xs">Título</Label>
          <Input
            id="agr-titulo"
            value={local.titulo}
            onChange={(e) => aplicar({ titulo: e.target.value })}
            placeholder="Obrigado pela sua participação!"
            className="text-sm"
            aria-label="Título da tela de agradecimento"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agr-mensagem" className="text-xs">Mensagem</Label>
          <Textarea
            id="agr-mensagem"
            value={local.mensagem}
            onChange={(e) => aplicar({ mensagem: e.target.value })}
            placeholder="Sua resposta foi registrada com sucesso."
            className="text-sm min-h-[72px] resize-y"
            aria-label="Mensagem da tela de agradecimento"
          />
        </div>
      </div>

      <Separator />

      {/* Mídia */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Mídia (imagem ou vídeo)</Label>

        {local.midia_url ? (
          <div className="space-y-2">
            {local.midia_tipo === 'video' ? (
              <video
                src={local.midia_url}
                controls
                className="w-full max-h-48 rounded-lg border bg-muted/30"
                aria-label="Prévia do vídeo de agradecimento"
              />
            ) : (
              <img
                src={local.midia_url}
                alt="Prévia da imagem de agradecimento"
                className="w-full max-h-40 object-contain rounded-lg border bg-muted/30"
              />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                aria-label="Trocar mídia"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                Trocar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={removerMidia}
                aria-label="Remover mídia"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            aria-label="Adicionar imagem ou vídeo à tela de agradecimento"
          >
            {uploading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1.5" /> Adicionar imagem ou vídeo</>
            )}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleUploadMidia}
          aria-label="Selecionar arquivo de mídia"
        />
        <p className="text-[11px] text-muted-foreground">
          Imagem: JPEG/PNG/WebP/GIF até 5MB. Vídeo: MP4/WebM/MOV até 50MB.
        </p>
      </div>

      <Separator />

      {/* Botões de redes sociais */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold">Botões de redes sociais</Label>
        <p className="text-[11px] text-muted-foreground">
          Exibidos na tela de agradecimento para o respondente seguir seu perfil ou entrar em contato.
        </p>

        {/* Botões já adicionados */}
        {botoes.length > 0 && (
          <div className="space-y-2" role="list" aria-label="Botões de redes sociais configurados">
            {botoes.map((botao, index) => {
              const preset = REDES_SOCIAIS[botao.rede];
              const urlInvalida = botao.url.trim() !== '' && !urlSegura(botao.url.trim());
              return (
                <div
                  key={index}
                  role="listitem"
                  className="flex items-start gap-2 p-2.5 border rounded-lg bg-card"
                >
                  {/* Handle de reordenação */}
                  <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                    <button
                      type="button"
                      onClick={() => moverBotao(index, -1)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Mover ${botao.label} para cima`}
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Ícone da rede */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: preset?.cor ?? '#888' }}
                    aria-hidden="true"
                  >
                    <RedeIcon rede={botao.rede} className="h-4 w-4 text-white" />
                  </div>

                  {/* Campos */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Input
                      value={botao.label}
                      onChange={(e) => editarBotao(index, { label: e.target.value })}
                      placeholder={preset?.label ?? 'Rótulo'}
                      className="h-7 text-xs"
                      aria-label={`Rótulo do botão ${preset?.label}`}
                    />
                    <div className="space-y-0.5">
                      <Input
                        value={botao.url}
                        onChange={(e) => editarBotao(index, { url: e.target.value })}
                        placeholder={preset?.placeholder ?? 'https://...'}
                        className={`h-7 text-xs ${urlInvalida ? 'border-destructive' : ''}`}
                        type="url"
                        aria-label={`URL do botão ${preset?.label}`}
                        aria-invalid={urlInvalida}
                        aria-describedby={urlInvalida ? `url-erro-${index}` : undefined}
                      />
                      {urlInvalida && (
                        <p id={`url-erro-${index}`} className="text-[10px] text-destructive" role="alert">
                          URL inválida — deve começar com https://
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Controles direita */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removerBotao(index)}
                      aria-label={`Remover botão ${botao.label}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => moverBotao(index, 1)}
                      disabled={index === botoes.length - 1}
                      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Mover ${botao.label} para baixo`}
                    >
                      <GripVertical className="h-3 w-3 rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Presets para adicionar */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Clique para adicionar:</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REDES_SOCIAIS) as RedeSocial[]).map((rede) => {
              const preset = REDES_SOCIAIS[rede];
              const jaAdicionado = redesJaAdicionadas.has(rede);
              return (
                <button
                  key={rede}
                  type="button"
                  onClick={() => adicionarBotao(rede)}
                  disabled={jaAdicionado}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: preset.cor }}
                  aria-label={`Adicionar botão ${preset.label}${jaAdicionado ? ' (já adicionado)' : ''}`}
                  aria-disabled={jaAdicionado}
                >
                  <RedeIcon rede={rede} className="h-3.5 w-3.5 text-white" />
                  {preset.label}
                  {!jaAdicionado && <Plus className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
