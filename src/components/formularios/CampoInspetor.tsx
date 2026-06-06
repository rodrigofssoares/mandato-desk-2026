// EM054 — Inspetor de propriedades do campo selecionado no studio
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Type, AlignLeft, Phone, Mail, CreditCard, CircleDot,
  CheckSquare, List, Calendar, Image as ImageIcon, Video as VideoIcon, Heading,
  GitMerge, Palette, Plus, X, Upload, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ICONS,
  FIELD_TYPES_COM_OPCOES,
  DESTINOS_CONTATO,
  DESTINOS_DEMANDA,
  type FormularioCampo,
  type FieldType,
  type OpcaoCampo,
} from '@/types/formularios';

// ── Ícones dos tipos de campo ─────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Type, AlignLeft, Phone, Mail, CreditCard, CircleDot, CheckSquare,
  List, Calendar, Image: ImageIcon, Video: VideoIcon, Heading,
};

export function FieldIcon({ tipo, className = 'h-4 w-4' }: { tipo: FieldType; className?: string }) {
  const name = FIELD_TYPE_ICONS[tipo];
  const Icon = ICON_MAP[name] ?? Type;
  return <Icon className={className} />;
}

// ── Edição de opções (para escolha_unica, checkboxes, lista) ─────────────────

interface InspetorOpcoesProps {
  opcoes: OpcaoCampo[];
  onChange: (novas: OpcaoCampo[]) => void;
}

function InspetorOpcoes({ opcoes, onChange }: InspetorOpcoesProps) {
  const [novaOpcao, setNovaOpcao] = useState('');

  function adicionar() {
    if (!novaOpcao.trim()) return;
    onChange([
      ...opcoes,
      { label: novaOpcao.trim(), value: novaOpcao.trim().toLowerCase().replace(/\s+/g, '_') },
    ]);
    setNovaOpcao('');
  }

  function remover(i: number) {
    onChange(opcoes.filter((_, idx) => idx !== i));
  }

  function editar(i: number, label: string) {
    const novas = [...opcoes];
    novas[i] = { ...novas[i], label, value: label.toLowerCase().replace(/\s+/g, '_') };
    onChange(novas);
  }

  return (
    <div className="space-y-1.5">
      {opcoes.map((op, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <CircleDot className="h-3 w-3 text-muted-foreground shrink-0" />
          <Input
            value={op.label}
            onChange={(e) => editar(i, e.target.value)}
            className="h-7 text-xs flex-1"
            aria-label={`Opção ${i + 1}`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => remover(i)}
            aria-label={`Remover opção ${op.label}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-1.5 mt-1">
        <Input
          value={novaOpcao}
          onChange={(e) => setNovaOpcao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder="Nova opção..."
          className="h-7 text-xs flex-1"
          aria-label="Nova opção"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={adicionar}
          aria-label="Adicionar opção"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Inspetor principal (wrapper que escolhe vazio x formulário) ───────────────

interface CampoInspetorProps {
  campo: FormularioCampo | null;
  /** Salva um patch do campo no servidor (mutate direto — o debounce vive aqui dentro). */
  onSave: (campoId: string, patch: Partial<FormularioCampo>) => void;
  /** Faz upload de uma mídia (imagem ou vídeo) e retorna a URL pública. */
  onUploadMidia: (file: File) => Promise<string>;
  /** Se o formulário cria demanda — controla a exibição do mapeamento de demanda. */
  criarDemanda?: boolean;
}

export function CampoInspetor({ campo, onSave, onUploadMidia, criarDemanda }: CampoInspetorProps) {
  if (!campo) {
    return (
      <aside className="w-72 border-l bg-card overflow-y-auto shrink-0 p-4 flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center">
          Clique num campo na prévia para editar suas propriedades.
        </p>
      </aside>
    );
  }
  // key por campo.id → remonta (e re-inicializa o estado local) ao trocar de campo.
  return (
    <CampoInspetorForm key={campo.id} campo={campo} onSave={onSave} onUploadMidia={onUploadMidia} criarDemanda={criarDemanda} />
  );
}

// ── Form interno (sempre com campo não-nulo, estado local p/ digitação fluida) ─

interface CampoInspetorFormProps {
  campo: FormularioCampo;
  onSave: (campoId: string, patch: Partial<FormularioCampo>) => void;
  onUploadMidia: (file: File) => Promise<string>;
  criarDemanda?: boolean;
}

function CampoInspetorForm({ campo, onSave, onUploadMidia, criarDemanda }: CampoInspetorFormProps) {
  // Cópia de trabalho local — dá feedback instantâneo enquanto digita,
  // sem esperar o round-trip ao servidor (que é debounced).
  const [local, setLocal] = useState<FormularioCampo>(campo);
  const pendingRef = useRef<Partial<FormularioCampo>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (Object.keys(pendingRef.current).length > 0) {
      onSave(campo.id, pendingRef.current);
      pendingRef.current = {};
    }
  }, [campo.id, onSave]);

  // Flush ao desmontar (= ao trocar de campo), pra não perder edições pendentes.
  useEffect(() => flush, [flush]);

  const apply = useCallback((patch: Partial<FormularioCampo>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 500);
  }, [flush]);

  async function handleSelecionarMidia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUploadMidia(file);
      apply({ config: { ...(local.config ?? {}), url } });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const ehMidia = local.tipo === 'imagem' || local.tipo === 'video';
  const ehDecorativo = local.tipo === 'secao' || ehMidia;
  const ehVideo = local.tipo === 'video';
  const temOpcoes = FIELD_TYPES_COM_OPCOES.includes(local.tipo);
  const midiaUrl = typeof local.config?.url === 'string' ? (local.config.url as string) : null;

  return (
    <aside className="w-72 border-l bg-card overflow-y-auto shrink-0 p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2.5 pb-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
          <FieldIcon tipo={local.tipo} className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <strong className="text-sm block">{local.rotulo || '(sem rótulo)'}</strong>
          <span className="text-[11px] text-muted-foreground">{FIELD_TYPE_LABELS[local.tipo]}</span>
        </div>
      </div>

      {/* Upload de mídia (imagem ou vídeo) */}
      {ehMidia && (
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {ehVideo ? 'Vídeo' : 'Imagem'}
          </Label>
          {midiaUrl && (
            ehVideo ? (
              <video
                src={midiaUrl}
                controls
                className="w-full max-h-40 rounded border bg-muted/30"
              />
            ) : (
              <img
                src={midiaUrl}
                alt="Prévia"
                className="w-full max-h-32 object-contain rounded border bg-muted/30"
              />
            )
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ehVideo ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif'}
            className="hidden"
            onChange={handleSelecionarMidia}
            aria-label={ehVideo ? 'Selecionar vídeo do campo' : 'Selecionar imagem do campo'}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1.5" /> {midiaUrl ? `Trocar ${ehVideo ? 'vídeo' : 'imagem'}` : `Enviar ${ehVideo ? 'vídeo' : 'imagem'}`}</>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            {ehVideo ? 'MP4, WebM ou MOV até 50MB.' : 'JPEG, PNG, WebP ou GIF até 5MB.'}
          </p>
        </div>
      )}

      {/* Rótulo (opcional — deixe vazio para não exibir rótulo no formulário) */}
      <div className="space-y-1.5">
        <Label htmlFor="rotulo" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {local.tipo === 'secao' ? 'Título da seção' : ehMidia ? 'Legenda (opcional)' : 'Rótulo da pergunta (opcional)'}
        </Label>
        <Input
          id="rotulo"
          value={local.rotulo}
          onChange={(e) => apply({ rotulo: e.target.value })}
          placeholder={local.tipo === 'secao' ? 'Ex.: Seus dados' : 'Deixe vazio para não exibir rótulo'}
          className="h-8 text-xs"
          aria-label="Rótulo do campo"
        />
      </div>

      {/* Ajuda */}
      {!ehDecorativo && (
        <div className="space-y-1.5">
          <Label htmlFor="ajuda" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Texto de ajuda
          </Label>
          <Textarea
            id="ajuda"
            value={local.ajuda ?? ''}
            onChange={(e) => apply({ ajuda: e.target.value || null })}
            placeholder="Instrução opcional para quem preenche"
            className="text-xs min-h-[54px] resize-y"
            aria-label="Texto de ajuda do campo"
          />
        </div>
      )}

      {/* Min / Max chars */}
      {['texto_curto', 'paragrafo', 'email', 'cpf', 'telefone'].includes(local.tipo) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="min_chars" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Mín. chars
            </Label>
            <Input
              id="min_chars"
              type="number"
              min={0}
              value={local.min_chars ?? ''}
              onChange={(e) => apply({ min_chars: e.target.value ? parseInt(e.target.value) : null })}
              className="h-8 text-xs"
              aria-label="Mínimo de caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_chars" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Máx. chars
            </Label>
            <Input
              id="max_chars"
              type="number"
              min={0}
              value={local.max_chars ?? ''}
              onChange={(e) => apply({ max_chars: e.target.value ? parseInt(e.target.value) : null })}
              className="h-8 text-xs"
              aria-label="Máximo de caracteres"
            />
          </div>
        </div>
      )}

      {/* Toggles: Obrigatório / Validar formato */}
      {!ehDecorativo && (
        <div className="divide-y">
          <div className="flex items-center justify-between py-2.5">
            <div>
              <strong className="text-xs">Obrigatório</strong>
              <p className="text-[11px] text-muted-foreground">Não envia sem preencher</p>
            </div>
            <Switch
              checked={local.obrigatorio}
              onCheckedChange={(v) => apply({ obrigatorio: v })}
              aria-label="Campo obrigatório"
            />
          </div>
          {['telefone', 'email', 'cpf'].includes(local.tipo) && (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <strong className="text-xs">Validar formato</strong>
                <p className="text-[11px] text-muted-foreground">Telefone, e-mail, CPF</p>
              </div>
              <Switch
                checked={local.validar_formato}
                onCheckedChange={(v) => apply({ validar_formato: v })}
                aria-label="Validar formato"
              />
            </div>
          )}
        </div>
      )}

      {/* Opções editáveis */}
      {temOpcoes && (
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Opções
          </Label>
          <InspetorOpcoes
            opcoes={local.opcoes ?? []}
            onChange={(novas) => apply({ opcoes: novas })}
          />
        </div>
      )}

      {/* Mapeamento */}
      {!ehDecorativo && (
        <>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-600 flex items-center gap-1.5 pt-2">
            <GitMerge className="h-3 w-3" />
            Mapeamento deste campo
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="destino1" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Salvar em (destino 1)
            </Label>
            <Select
              value={local.mapear_destino_1 ?? '__none__'}
              onValueChange={(v) => apply({ mapear_destino_1: v === '__none__' ? null : v })}
            >
              <SelectTrigger id="destino1" className="h-8 text-xs" aria-label="Destino 1">
                <SelectValue placeholder="— nenhum —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— nenhum —</SelectItem>
                {DESTINOS_CONTATO.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destino2" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Também em (destino 2)
            </Label>
            <Select
              value={local.mapear_destino_2 ?? '__none__'}
              onValueChange={(v) => apply({ mapear_destino_2: v === '__none__' ? null : v })}
            >
              <SelectTrigger id="destino2" className="h-8 text-xs" aria-label="Destino 2">
                <SelectValue placeholder="— nenhum —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— nenhum —</SelectItem>
                {DESTINOS_CONTATO.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Mapear na demanda — só quando o formulário cria demanda */}
      {!ehDecorativo && criarDemanda && (
        <div className="space-y-1.5">
          <Label htmlFor="mapear_demanda" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Salvar também na demanda
          </Label>
          <Select
            value={local.mapear_demanda ?? '__none__'}
            onValueChange={(v) => apply({ mapear_demanda: v === '__none__' ? null : v })}
          >
            <SelectTrigger id="mapear_demanda" className="h-8 text-xs" aria-label="Destino na demanda">
              <SelectValue placeholder="— nenhum —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— nenhum —</SelectItem>
              {DESTINOS_DEMANDA.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Aparência */}
      {!ehDecorativo && (
        <>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-600 flex items-center gap-1.5 pt-2">
            <Palette className="h-3 w-3" />
            Aparência do campo
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="largura" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Largura
            </Label>
            <Select
              value={local.largura ?? '100'}
              onValueChange={(v) => apply({ largura: v as '100' | '50' })}
            >
              <SelectTrigger id="largura" className="h-8 text-xs" aria-label="Largura do campo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100% — largura total</SelectItem>
                <SelectItem value="50">50% — meia largura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </aside>
  );
}
