// EM054 — Inspetor de propriedades do campo selecionado no studio
import { useState } from 'react';
import {
  Type, AlignLeft, Phone, Mail, CreditCard, CircleDot,
  CheckSquare, List, Calendar, Image as ImageIcon, Heading,
  GitMerge, Palette, Plus, X,
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
  type FormularioCampo,
  type FieldType,
  type OpcaoCampo,
} from '@/types/formularios';

// ── Ícones dos tipos de campo ─────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Type, AlignLeft, Phone, Mail, CreditCard, CircleDot, CheckSquare,
  List, Calendar, Image: ImageIcon, Heading,
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

// ── Inspetor principal ────────────────────────────────────────────────────────

interface CampoInspetorProps {
  campo: FormularioCampo | null;
  onUpdate: (patch: Partial<FormularioCampo>) => void;
}

export function CampoInspetor({ campo, onUpdate }: CampoInspetorProps) {
  if (!campo) {
    return (
      <aside className="w-72 border-l bg-card overflow-y-auto shrink-0 p-4 flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center">
          Clique num campo na prévia para editar suas propriedades.
        </p>
      </aside>
    );
  }

  const temOpcoes = FIELD_TYPES_COM_OPCOES.includes(campo.tipo);

  return (
    <aside className="w-72 border-l bg-card overflow-y-auto shrink-0 p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2.5 pb-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
          <FieldIcon tipo={campo.tipo} className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <strong className="text-sm block">{campo.rotulo || '(sem rótulo)'}</strong>
          <span className="text-[11px] text-muted-foreground">{FIELD_TYPE_LABELS[campo.tipo]}</span>
        </div>
      </div>

      {/* Rótulo */}
      <div className="space-y-1.5">
        <Label htmlFor="rotulo" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Rótulo da pergunta
        </Label>
        <Input
          id="rotulo"
          value={campo.rotulo}
          onChange={(e) => onUpdate({ rotulo: e.target.value })}
          className="h-8 text-xs"
          aria-label="Rótulo do campo"
        />
      </div>

      {/* Ajuda */}
      {campo.tipo !== 'secao' && (
        <div className="space-y-1.5">
          <Label htmlFor="ajuda" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Texto de ajuda
          </Label>
          <Textarea
            id="ajuda"
            value={campo.ajuda ?? ''}
            onChange={(e) => onUpdate({ ajuda: e.target.value || null })}
            placeholder="Instrução opcional para quem preenche"
            className="text-xs min-h-[54px] resize-y"
            aria-label="Texto de ajuda do campo"
          />
        </div>
      )}

      {/* Min / Max chars */}
      {['texto_curto', 'paragrafo', 'email', 'cpf', 'telefone'].includes(campo.tipo) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="min_chars" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Mín. chars
            </Label>
            <Input
              id="min_chars"
              type="number"
              min={0}
              value={campo.min_chars ?? ''}
              onChange={(e) =>
                onUpdate({ min_chars: e.target.value ? parseInt(e.target.value) : null })
              }
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
              value={campo.max_chars ?? ''}
              onChange={(e) =>
                onUpdate({ max_chars: e.target.value ? parseInt(e.target.value) : null })
              }
              className="h-8 text-xs"
              aria-label="Máximo de caracteres"
            />
          </div>
        </div>
      )}

      {/* Toggles: Obrigatório / Validar formato */}
      {campo.tipo !== 'secao' && (
        <div className="divide-y">
          <div className="flex items-center justify-between py-2.5">
            <div>
              <strong className="text-xs">Obrigatório</strong>
              <p className="text-[11px] text-muted-foreground">Não envia sem preencher</p>
            </div>
            <Switch
              checked={campo.obrigatorio}
              onCheckedChange={(v) => onUpdate({ obrigatorio: v })}
              aria-label="Campo obrigatório"
            />
          </div>
          {['telefone', 'email', 'cpf'].includes(campo.tipo) && (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <strong className="text-xs">Validar formato</strong>
                <p className="text-[11px] text-muted-foreground">Telefone, e-mail, CPF</p>
              </div>
              <Switch
                checked={campo.validar_formato}
                onCheckedChange={(v) => onUpdate({ validar_formato: v })}
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
            opcoes={campo.opcoes ?? []}
            onChange={(novas) => onUpdate({ opcoes: novas })}
          />
        </div>
      )}

      {/* Mapeamento */}
      {campo.tipo !== 'secao' && campo.tipo !== 'imagem' && (
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
              value={campo.mapear_destino_1 ?? '__none__'}
              onValueChange={(v) => onUpdate({ mapear_destino_1: v === '__none__' ? null : v })}
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
              value={campo.mapear_destino_2 ?? '__none__'}
              onValueChange={(v) => onUpdate({ mapear_destino_2: v === '__none__' ? null : v })}
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

      {/* Aparência */}
      <p className="text-[10px] uppercase tracking-widest font-bold text-amber-600 flex items-center gap-1.5 pt-2">
        <Palette className="h-3 w-3" />
        Aparência do campo
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="largura" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Largura
        </Label>
        <Select
          value={campo.largura ?? '100'}
          onValueChange={(v) => onUpdate({ largura: v as '100' | '50' })}
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
    </aside>
  );
}
